export type ContactRouteQuality = "decision_maker" | "business_route" | "general_route" | "fallback";

export interface ContactRouteInput {
  contactType: string;
  contactValue: string;
  label?: string | null;
  verificationStatus?: string | null;
}

const DECISION_OWNER = /\b(purchas(?:e|ing)?|procurement|sourcing|buyer|product development|supply chain|vendor|category manager|owner|president|chief executive|ceo)\b/i;
const BUSINESS_ROUTE = /\b(sales?|orders?|business|subcontractor|wholesale|dealer|corporate|meeting|commercial)\b/i;

export function contactRouteQuality(contact: ContactRouteInput): ContactRouteQuality {
  const description = contact.label?.trim() || contact.contactValue.split("@")[0];
  if (DECISION_OWNER.test(description)) return "decision_maker";
  if (BUSINESS_ROUTE.test(description)) return "business_route";
  if (contact.contactType === "website_contact_page" || contact.contactType === "email" || contact.contactType === "linkedin") return "general_route";
  return "fallback";
}

export function contactRoutePriority(contact: ContactRouteInput): number {
  if (contact.verificationStatus && contact.verificationStatus !== "verified") return 99;
  const qualityRank: Record<ContactRouteQuality, number> = {decision_maker:0,business_route:10,general_route:20,fallback:30};
  const typeRank: Record<string, number> = {email:0,website_contact_page:1,linkedin:2,phone:3};
  return qualityRank[contactRouteQuality(contact)] + (typeRank[contact.contactType] ?? 9);
}

export function bestVerifiedContact<T extends ContactRouteInput>(contacts: T[]): T | null {
  return contacts
    .filter(contact => !contact.verificationStatus || contact.verificationStatus === "verified")
    .sort((a,b)=>contactRoutePriority(a)-contactRoutePriority(b))[0] ?? null;
}

export function contactRouteGuidance(quality: ContactRouteQuality): string {
  if (quality === "decision_maker") return "Direct purchasing or product owner route — personalize and review before outreach.";
  if (quality === "business_route") return "Business-facing route — ask for the sourcing or product-development owner.";
  if (quality === "general_route") return "General company route — request internal routing to purchasing before qualification.";
  return "Fallback route only — use the call to identify and verify the purchasing owner.";
}
