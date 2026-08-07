import type { NormalizedData, QueryLogEntry, QueryRequest, QueryResult, QueryStatus } from "./types.ts";
import { normalizeQuery, queryHash } from "./hash.ts";
import { validateQuery } from "./validator.ts";
import { planQuery } from "./planner.ts";
import type { CacheResolver } from "../cache/resolver.ts";
import type { ProviderCapability, ProviderRegistry } from "../providers/types.ts";
import { normalizeTrade, normalizeRanking, normalizeCompanies } from "../normalizers/trade.ts";
import type { BuyerRanking } from "../ranking/types.ts";

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
  persistRanking?: (ranking: BuyerRanking) => Promise<void>;
}

export class QueryEngine {
  private readonly deps: QueryEngineDeps;

  constructor(deps: QueryEngineDeps) {
    this.deps = deps;
  }

  async execute(rawQuery: unknown): Promise<QueryResult> {
    const validation = validateQuery(rawQuery);
    if (!validation.ok) return { queryId: "", intent: "trade_trend", source: [], cached: false, cost: { estimated: 0, percentOfTotal: 0 }, metadata: {}, status: "failed", reason: validation.errors.join("; ") };

    const raw = rawQuery as QueryRequest;
    const query = normalizeQuery(raw);
    const requestedLimit = raw.ranking?.limit && raw.ranking.limit >= 1 ? raw.ranking.limit : 20;
    const requestedMetric = raw.ranking?.metric || "shipment_count";
    const queryId = await queryHash(query);
    const plan = planQuery(query, this.deps.capabilities);
    if (!plan.requiredProviders.length) {
      await this.log({ queryId, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: null, status: "failed", cost: null });
      return { queryId, intent: query.intent, source: [], cached: false, cost: { estimated: 0, percentOfTotal: 0 }, metadata: {}, status: "failed", reason: plan.summary };
    }

    const provider = this.deps.registry.route(plan);
    if (!provider) {
      await this.log({ queryId, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: null, status: "failed", cost: null });
      return { queryId, intent: query.intent, source: [], cached: false, cost: { estimated: 0, percentOfTotal: 0 }, metadata: {}, status: "failed", reason: "Planned provider is not registered" };
    }

    const primary = plan.requiredProviders[0];
    const budget = this.deps.budget.estimate(primary.estimatedCredits);
    const cost = { estimated: primary.kind === "paid" ? primary.estimatedCredits : 0, percentOfTotal: budget.percentOfTotal };

    let status: QueryStatus = "completed";
    let data: NormalizedData | undefined;
    let cacheHit = false;
    let resolvedMeta: { source: string; storedAt: string; expiresAt: string } | undefined;

    if (primary.kind === "paid" && !budget.approved) {
      status = "awaiting_approval";
    } else {
      try {
        const resolved = await this.deps.resolver.resolve(query, queryId);
        cacheHit = resolved.cacheHit;
        resolvedMeta = resolved.meta;
        status = cacheHit ? "cache_hit" : "completed";
        data = this.normalize(provider.capability.id, resolved.raw, { ...query, ranking: { limit: requestedLimit, metric: requestedMetric } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown query error";
        await this.log({ queryId, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: provider.capability.id, status: "failed", cost: null });
        return { queryId, intent: query.intent, source: [provider.capability.id], cached: false, cost, metadata: {}, status: "failed", reason: message };
      }
    }

    const source = [provider.capability.id];
    const metadata: Record<string, unknown> = {
      provider: source[0],
      cached: cacheHit,
      fetchedAt: new Date().toISOString(),
      cacheStorage: resolvedMeta?.source || null,
      cacheStoredAt: resolvedMeta?.storedAt || null,
      cacheExpiresAt: resolvedMeta?.expiresAt || null,
    };
    if (data?.kind === "trade") metadata.trade = { availabilityStatus: data.metric.availabilityStatus, requestedPeriod: data.metric.requestedPeriod, period: data.metric.period, recordCount: data.metric.recordCount };
    if (data?.kind === "ranking") metadata.ranking = { metric: data.ranking.metric, productCategory: data.ranking.productCategory, topLimit: data.ranking.topLimit, topCount: data.ranking.topCount, totalCount: data.ranking.totalCount };

    if (data?.kind === "ranking" && !cacheHit && this.deps.persistRanking) {
      try {
        await this.deps.persistRanking(data.ranking);
      } catch {
        // Persistence must never fail a query.
      }
    }

    await this.log({ queryId, intent: query.intent, subject: query.subject, market: query.market, period: query.period, provider: source[0], status, cost: cost.estimated });

    return { queryId, intent: query.intent, source, cached: cacheHit, cost, data, metadata, status };
  }

  private normalize(providerId: string, raw: unknown, query: QueryRequest): NormalizedData {
    if (providerId === "comtrade") return normalizeTrade(raw as Parameters<typeof normalizeTrade>[0]);
    if (providerId === "importyeti_web") return normalizeRanking(raw as Parameters<typeof normalizeRanking>[0], query);
    return this.sliceCompanies(normalizeCompanies(raw), query.ranking?.limit);
  }

  private sliceCompanies(data: NormalizedData, limit?: number): NormalizedData {
    if (data.kind !== "companies" || !limit) return data;
    return { kind: "companies", companies: data.companies.slice(0, limit) };
  }

  private async log(entry: QueryLogEntry) {
    try {
      await this.deps.logger.log(entry);
    } catch {
      // Logging must never fail a query.
    }
  }
}
