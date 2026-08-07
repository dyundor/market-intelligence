import type { QueryRequest } from "../query/types.ts";
import type { Provider } from "../providers/types.ts";

export type ResolveResult = {
  source: "cache" | "provider";
  cacheHit: boolean;
  raw: unknown;
};

export interface CacheAdapter {
  read(cacheKey: string): Promise<{ hit: boolean; raw: unknown } | null>;
  write(cacheKey: string, raw: unknown): Promise<void>;
}

export interface CacheResolverDeps {
  cache: CacheAdapter;
  providers: Provider[];
  resolveProvider: (query: QueryRequest) => Provider | null;
}

export class CacheResolver {
  private readonly cache: CacheAdapter;
  private readonly providers: Provider[];
  private readonly resolveProvider: (query: QueryRequest) => Provider | null;

  constructor(deps: CacheResolverDeps) {
    this.cache = deps.cache;
    this.providers = deps.providers;
    this.resolveProvider = deps.resolveProvider;
  }
  async resolve(query: QueryRequest, cacheKey: string): Promise<ResolveResult> {
    const cached = await this.cache.read(cacheKey);
    if (cached?.hit) return { source: "cache", cacheHit: true, raw: cached.raw };

    const provider = this.resolveProvider(query);
    if (!provider) throw new Error("No provider selected for this query");

    const raw = await provider.fetch(query);
    await this.cache.write(cacheKey, raw);
    return { source: "provider", cacheHit: false, raw };
  }
}
