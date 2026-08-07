import { env } from "cloudflare:workers";
import { cachedApiRequest, readCachedApiValue } from "./paid-cache";
import type { CacheAdapter } from "../../../lib/cache/resolver.ts";

export class D1CacheAdapter implements CacheAdapter {
  private readonly provider: string;
  private readonly ttlMs: number;
  private readonly staleTtlMs: number;

  constructor(provider: string, ttlMs: number, staleTtlMs = 0) {
    this.provider = provider;
    this.ttlMs = ttlMs;
    this.staleTtlMs = staleTtlMs;
  }

  async read(cacheKey: string) {
    const cached = await readCachedApiValue<unknown>(this.provider, cacheKey);
    if (!cached) return null;
    return {
      hit: true,
      raw: cached.value,
      meta: { source: cached.cache.source, storedAt: cached.cache.storedAt, expiresAt: cached.cache.expiresAt },
    };
  }

  async write(cacheKey: string, raw: unknown) {
    if (!env.DB) return;
    await cachedApiRequest({ provider: this.provider, cacheKey, ttlMs: this.ttlMs, staleTtlMs: this.staleTtlMs }, async () => raw);
  }
}
