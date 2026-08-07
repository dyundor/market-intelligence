import type { PlannedQuery, QueryRequest } from "../query/types.ts";
import type { Provider, ProviderRegistry } from "./types.ts";

export class SimpleProviderRegistry implements ProviderRegistry {
  private readonly providers: Provider[];

  constructor(providers: Provider[]) {
    this.providers = providers;
  }

  list(): Provider[] {
    return this.providers;
  }

  route(plan: PlannedQuery): Provider | null {
    const primary = plan.requiredProviders[0];
    if (!primary) return null;
    return this.providers.find(provider => provider.capability.id === primary.providerId) || null;
  }

  providerFor(query: QueryRequest): Provider | null {
    return this.providers.find(provider => provider.capability.canHandle(query)) || null;
  }
}
