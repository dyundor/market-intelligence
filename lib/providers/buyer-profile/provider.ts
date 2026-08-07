import type { Provider } from "../types.ts";
import { buyerProfileCapability } from "../mock/capabilities.ts";
import type { QueryRequest } from "../../query/types.ts";
import type { DbLike } from "../../db/types.ts";
import { ShipmentRepository } from "../../repositories/shipment-repository.ts";
import { CompanyRepository } from "../../repositories/company-repository.ts";
import { buildCompanyProfile, resolveCompanyId, type CompanyProfileDeps } from "../../intelligence/company-profile.ts";

export class BuyerProfileProvider implements Provider {
  readonly capability = buyerProfileCapability;
  private readonly deps: CompanyProfileDeps;

  constructor(options: { db: DbLike }) {
    this.deps = {
      shipments: new ShipmentRepository(options.db),
      companies: new CompanyRepository(options.db),
    };
  }

  async fetch(query: QueryRequest): Promise<unknown> {
    const company = query.company || query.subject;
    const companyId = await resolveCompanyId(this.deps, company);
    if (!companyId) return { profile: null, company };
    const profile = await buildCompanyProfile(this.deps, companyId);
    return { profile, company };
  }
}
