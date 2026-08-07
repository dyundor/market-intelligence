import type { ProviderCapability } from "../providers/types.ts";
import type { PlannedQuery, ProviderPlan, QueryRequest, RejectedProvider } from "./types.ts";

export function planQuery(query: QueryRequest, providers: ProviderCapability[]): PlannedQuery {
  const candidates: ProviderPlan[] = [];
  const rejectedProviders: RejectedProvider[] = [];

  for (const provider of providers) {
    if (provider.canHandle(query)) {
      candidates.push({
        providerId: provider.id,
        kind: provider.kind,
        reason: `Provider ${provider.id} can answer intent ${query.intent}`,
        estimatedCredits: provider.estimateCredits(query),
        required: false,
      });
    } else {
      const reason = provider.rejectReason(query);
      rejectedProviders.push({ providerId: provider.id, reason: reason || `Provider ${provider.id} cannot answer intent ${query.intent}` });
    }
  }

  candidates.sort((left, right) => Number(left.kind === "paid") - Number(right.kind === "paid"));
  const primary = candidates[0] || null;

  const requiredProviders: ProviderPlan[] = primary ? [{ ...primary, required: true }] : [];
  for (const alternative of candidates.slice(1)) {
    rejectedProviders.push({ providerId: alternative.providerId, reason: `Covered by preferred provider ${primary?.providerId} (${alternative.kind === "paid" ? "paid alternative" : "free provider"})` });
  }

  const summary = primary
    ? `Query will use: ${primary.providerId}`
    : "No provider can answer this query with current sources";

  return { query, requiredProviders, rejectedProviders, summary };
}
