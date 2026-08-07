import { env } from "cloudflare:workers";

type CacheSource = "database" | "coalesced" | "upstream" | "stale" | "memory";
type CacheResult<T> = { value:T; cache:{ hit:boolean; source:CacheSource; storedAt:string; expiresAt:string } };
type CacheOptions = {
  provider:string;
  cacheKey:string;
  ttlMs:number;
  staleTtlMs?:number;
  leaseMs?:number;
  requirePersistent?:boolean;
};

export function canonicalCacheKey(endpoint:string,parameters:Record<string,string|number|boolean|undefined|null>) {
  const normalized = Object.entries(parameters)
    .filter((entry):entry is [string,string|number|boolean] => entry[1] !== undefined && entry[1] !== null)
    .map(([key,value]) => [key.trim().toLowerCase(),String(value).trim().toLowerCase()] as const)
    .sort(([left],[right]) => left.localeCompare(right));
  return `${endpoint.trim().toLowerCase()}?${new URLSearchParams(normalized).toString()}`;
}

const inFlight = new Map<string,Promise<CacheResult<unknown>>>();
const memory = new Map<string,{value:unknown;storedAt:number;expiresAt:number}>();
let schemaReady: Promise<void> | null = null;

function initializeSchema() {
  if (!schemaReady) schemaReady = (async () => {
    if (!env.DB) throw new Error("Persistent cache database is unavailable");
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS paid_api_cache (cache_key TEXT PRIMARY KEY, provider TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'ready', payload TEXT, fetched_at INTEGER, expires_at INTEGER NOT NULL DEFAULT 0, stale_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, last_error TEXT)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS paid_api_cache_provider_expiry_idx ON paid_api_cache(provider, expires_at)"),
    ]);
  })().catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}

const wait = (milliseconds:number) => new Promise(resolve => setTimeout(resolve,milliseconds));
const iso = (timestamp:number) => new Date(timestamp).toISOString();

async function readRow<T>(cacheKey:string) {
  return env.DB.prepare("SELECT state, payload, fetched_at, expires_at, stale_until, lease_token, lease_until FROM paid_api_cache WHERE cache_key = ?")
    .bind(cacheKey).first<{state:string;payload:string|null;fetched_at:number|null;expires_at:number;stale_until:number;lease_token:string|null;lease_until:number}>() as Promise<{state:string;payload:string|null;fetched_at:number|null;expires_at:number;stale_until:number;lease_token:string|null;lease_until:number}|null>;
}

async function databaseRequest<T>(options:CacheOptions,fetcher:()=>Promise<T>,retry=0):Promise<CacheResult<T>> {
  await initializeSchema();
  const now = Date.now();
  const existing = await readRow<T>(options.cacheKey);
  if (existing?.state === "ready" && existing.payload && existing.expires_at > now) {
    return { value:JSON.parse(existing.payload) as T, cache:{hit:true,source:"database",storedAt:iso(existing.fetched_at || now),expiresAt:iso(existing.expires_at)} };
  }

  const leaseToken = crypto.randomUUID();
  const leaseUntil = now + (options.leaseMs || 90_000);
  await env.DB.prepare("INSERT INTO paid_api_cache (cache_key, provider, state, expires_at, stale_until, lease_token, lease_until) VALUES (?, ?, 'pending', 0, 0, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET provider=excluded.provider, state='pending', lease_token=excluded.lease_token, lease_until=excluded.lease_until, last_error=NULL WHERE paid_api_cache.expires_at <= ? AND (paid_api_cache.state != 'pending' OR paid_api_cache.lease_until <= ?)")
    .bind(options.cacheKey,options.provider,leaseToken,leaseUntil,now,now).run();
  const leased = await readRow<T>(options.cacheKey);

  if (leased?.lease_token === leaseToken) {
    try {
      const value = await fetcher();
      const storedAt = Date.now();
      const expiresAt = storedAt + options.ttlMs;
      const staleUntil = expiresAt + (options.staleTtlMs || 0);
      await env.DB.prepare("UPDATE paid_api_cache SET state='ready', payload=?, fetched_at=?, expires_at=?, stale_until=?, lease_token=NULL, lease_until=0, last_error=NULL WHERE cache_key=? AND lease_token=?")
        .bind(JSON.stringify(value),storedAt,expiresAt,staleUntil,options.cacheKey,leaseToken).run();
      return {value,cache:{hit:false,source:"upstream",storedAt:iso(storedAt),expiresAt:iso(expiresAt)}};
    } catch (error) {
      const fallback = await readRow<T>(options.cacheKey);
      await env.DB.prepare("UPDATE paid_api_cache SET state='error', lease_token=NULL, lease_until=0, last_error=? WHERE cache_key=? AND lease_token=?")
        .bind(error instanceof Error ? error.message : "Unknown upstream error",options.cacheKey,leaseToken).run();
      if (fallback?.payload && fallback.stale_until > Date.now()) {
        return {value:JSON.parse(fallback.payload) as T,cache:{hit:true,source:"stale",storedAt:iso(fallback.fetched_at || now),expiresAt:iso(fallback.expires_at)}};
      }
      throw error;
    }
  }

  for (let index=0;index<50;index+=1) {
    await wait(200);
    const completed = await readRow<T>(options.cacheKey);
    if (completed?.state === "ready" && completed.payload && completed.expires_at > Date.now()) {
      return {value:JSON.parse(completed.payload) as T,cache:{hit:true,source:"coalesced",storedAt:iso(completed.fetched_at || now),expiresAt:iso(completed.expires_at)}};
    }
    if (!completed || completed.lease_until <= Date.now()) break;
  }
  if (retry < 1) return databaseRequest(options,fetcher,retry+1);
  throw new Error("A matching paid API request is still in progress");
}

async function memoryRequest<T>(options:CacheOptions,fetcher:()=>Promise<T>):Promise<CacheResult<T>> {
  const existing = memory.get(options.cacheKey);
  if (existing && existing.expiresAt > Date.now()) return {value:existing.value as T,cache:{hit:true,source:"memory",storedAt:iso(existing.storedAt),expiresAt:iso(existing.expiresAt)}};
  const value = await fetcher();
  const storedAt = Date.now();
  const expiresAt = storedAt + options.ttlMs;
  memory.set(options.cacheKey,{value,storedAt,expiresAt});
  return {value,cache:{hit:false,source:"memory",storedAt:iso(storedAt),expiresAt:iso(expiresAt)}};
}

export function cachedApiRequest<T>(options:CacheOptions,fetcher:()=>Promise<T>):Promise<CacheResult<T>> {
  const namespacedKey = `${options.provider}|${options.cacheKey}`;
  const running = inFlight.get(namespacedKey) as Promise<CacheResult<T>>|undefined;
  if (running) return running;
  const promise = databaseRequest({...options,cacheKey:namespacedKey},fetcher).catch(error => {
    if (options.requirePersistent !== false) throw error;
    return memoryRequest({...options,cacheKey:namespacedKey},fetcher);
  }).finally(() => inFlight.delete(namespacedKey));
  inFlight.set(namespacedKey,promise as Promise<CacheResult<unknown>>);
  return promise;
}
