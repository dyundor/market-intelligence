import type { QueryLogEntry, QueryRequest, QueryResult, QueryStatus } from "./types.ts";
import { normalizeQuery, queryHash } from "./hash.ts";
import { validateQuery } from "./validator.ts";
import { planQuery } from "./planner.ts";
import type { CacheResolver } from "../cache/resolver.ts";
import type { ProviderCapability, ProviderRegistry } from "../providers/types.ts";
import { normalizeTrade, normalizeCompanies } from "../normalizers/trade.ts";

export interface Budget {
  estimate(credits: number): { estimatedCredits: number; percentOfTotal: number; approved: boolean };
}

export interface QueryLogger {
  log(entry: QueryLogEntry): Promise<void>;
}

export interface QueryEngineDeps {
  capabilities: ProviderCapability[];
  registry: ProviderRegistry;
  resolver: CacheResolver;
  budget: Budget;
  logger: QueryLogger;
}

export class QueryEngine {
  private readonly deps: QueryEngineDeps;

  constructor(deps: QueryEngineDeps) {
    this.deps = deps;
  }

  async execute(rawQuery: unknown): Promise<QueryResult> {
    const validation = validateQuery(rawQuery);
    if (!validation.ok) return { queryHash: "", query: rawQuery as QueryRequest, status: "failed", reason: validation.errors.join("; ") };

    const query = normalizeQuery(rawQuery as QueryRequest);
    const hash = await queryHash(query);
    const plan = planQuery(query, this.deps.capabilities);
    if (!plan.requiredProviders.length) {
      await this.log({ queryHash: hash, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: null, status: "failed", credits: null });
      return { queryHash: hash, query, status: "failed", reason: plan.summary };
    }

    const provider = this.deps.registry.route(plan);
    if (!provider) {
      await this.log({ queryHash: hash, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: null, status: "failed", credits: null });
      return { queryHash: hash, query, status: "failed", reason: "Planned provider is not registered" };
    }

    const primary = plan.requiredProviders[0];
    const budget = this.deps.budget.estimate(primary.estimatedCredits);

    let status: QueryStatus = "completed";
    let data: QueryResult["data"];

    try {
      const resolved = await this.deps.resolver.resolve(query, hash);
      status = resolved.cacheHit ? "cache_hit" : "completed";
            data = this.normalize(query, resolved.raw);      if (primary.kind === "paid" && !budget.approved) {
        status = "awaiting_approval";
        data = undefined;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown query error";
      await this.log({ queryHash: hash, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: provider.capability.id, status: "failed", credits: null });
      return { queryHash: hash, query, status: "failed", provider: provider.capability.id, reason: message };
    }

    await this.log({ queryHash: hash, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: provider.capability.id, status, credits: primary.kind === "paid" ? primary.estimatedCredits : 0 });

    return { queryHash: hash, query, status, provider: provider.capability.id, data, credits: primary.kind === "paid" ? primary.estimatedCredits : 0 };
  }

  private normalize(query: QueryRequest, raw: unknown): QueryResult["data"] {
    return query.intent === "trade_trend" ? normalizeTrade(raw) : normalizeCompanies(raw);
  }

  private async log(entry: QueryLogEntry) {
    try {
      await this.deps.logger.log(entry);
    } catch {
      // Logging must never fail a query.
    }
  }
}
