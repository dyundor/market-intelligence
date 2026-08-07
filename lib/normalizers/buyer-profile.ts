import type { NormalizedData } from "../query/types.ts";
import type { CompanyProfile } from "../intelligence/company-profile.ts";

export function normalizeBuyerProfile(raw: unknown): NormalizedData {
  if (raw && typeof raw === "object" && "profile" in raw) {
    const profile = (raw as { profile: CompanyProfile | null }).profile;
    return { kind: "buyer_profile", profile };
  }
  return { kind: "buyer_profile", profile: null };
}
