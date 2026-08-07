import type { ProviderCapability } from "../providers/types.ts";
import type { PlannedQuery, ProviderPlan, QueryRequest, RejectedProvider } from "./types.ts";

export function planQuery(query: QueryRequest, providers: ProviderCapability[]): PlannedQuery {
  const requiredProviders: ProviderPlan[] = [];
  const rejectedProviders: RejectedProvider[] = [];
  const handled: string[] = [];

  for (const provider of providers) {
    if (provider.canHandle(query)) {
      handled.push(provider.id);
      requiredProviders.push({
        providerId: provider.id,
        kind: provider.kind,
        reason: `Provider ${provider.id} can answer intent ${query.intent}`,
        estimatedCredits: provider.estimateCredits(query),
        required: true,
      });
    } else {
      const reason = provider.rejectReason(query);
      rejectedProviders.push({ providerId: provider.id, reason: reason || `Provider ${provider.id} cannot answer intent ${query.intent}` });
    }
  }

  const summary = handled.length
    ? `Query will use: ${handled.join(", ")}`
    : "No provider can answer this query with current sources";

  return { query, requiredProviders, rejectedProviders, summary };
}
