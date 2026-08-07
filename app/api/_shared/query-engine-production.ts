import { QueryEngine, type Budget, type QueryLogger } from "../../../lib/query/engine.ts";
import { SimpleProviderRegistry } from "../../../lib/providers/registry.ts";
import { comtradeProvider, importYetiProvider } from "../../../lib/providers/mock/registry.ts";
import { ComtradeProvider } from "../../../lib/providers/comtrade/provider.ts";
import { ImportYetiWebProvider } from "../../../lib/providers/importyeti-web/provider.ts";
import type { DbLike } from "../../../lib/db/types.ts";
import { comtradeCapability, importYetiCapability, importYetiWebCapability } from "../../../lib/providers/mock/capabilities.ts";
import { CacheResolver, type CacheAdapter } from "../../../lib/cache/resolver.ts";
import { persistMonthlyRankings } from "../../../lib/ranking/persist.ts";
import type { Provider } from "../../../lib/providers/types.ts";
import type { PlannedQuery, QueryRequest } from "../../../lib/query/types.ts";

export class MemoryCache implements CacheAdapter {
  private readonly store = new Map<string, unknown>();

  async read(cacheKey: string) {
    return this.store.has(cacheKey) ? { hit: true, raw: this.store.get(cacheKey) } : null;
  }

  async write(cacheKey: string, raw: unknown) {
    this.store.set(cacheKey, raw);
  }
}

export class NoopLogger implements QueryLogger {
  async log() {}
}

export class FixedBudget implements Budget {
  private readonly approvalThreshold: number;

  constructor(approvalThreshold = 0) {
    this.approvalThreshold = approvalThreshold;
  }

  estimate(credits: number) {
    return { estimatedCredits: credits, percentOfTotal: credits / 100, approved: credits <= this.approvalThreshold };
  }
}

export interface ProductionOptions {
  db?: DbLike;
  apiKey?: string;
  providers?: Provider[];
  cache?: CacheAdapter;
  logger?: QueryLogger;
  budget?: Budget;
}

export function createQueryEngine(options: ProductionOptions = {}) {
  const providers = options.providers || [
    new ComtradeProvider({ apiKey: options.apiKey }),
    options.db ? new ImportYetiWebProvider({ db: options.db }) : null,
    importYetiProvider,
  ].filter((provider): provider is Provider => provider !== null);
  const cache = options.cache || new MemoryCache();
  const logger = options.logger || new NoopLogger();
  const budget = options.budget || new FixedBudget(0);
  const registry = new SimpleProviderRegistry(providers);

  const route = (query: QueryRequest) => registry.providerFor(query);
  const resolver = new CacheResolver({ cache, providers, resolveProvider: route });

  return new QueryEngine({
    capabilities: [comtradeCapability, importYetiWebCapability, importYetiCapability],
    registry,
    resolver,
    budget,
    logger,
    persistRanking: options.db
      ? async ranking => {
          await persistMonthlyRankings({ db: options.db, ranking });
        }
      : undefined,
  });
}

export function createPreviewQueryEngine(options: ProductionOptions = {}) {
  return createQueryEngine(options);
}

export { comtradeProvider, importYetiProvider };

export type { PlannedQuery };
