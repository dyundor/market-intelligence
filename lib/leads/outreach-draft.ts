export interface OutreachDraftInput {
  companyName: string;
  contactName?: string | null;
  totalShipments?: number | null;
  latestShipmentDate?: string | null;
  outreachStrategy?: string | null;
  recommendedProducts?: string | null;
  companyType?: string | null;
  researchReason?: string | null;
  researchNextAction?: string | null;
}

export interface GeneratedOutreachDraft {
  subject: string;
  body: string;
  evidenceSummary: string;
  personalizationNotes: string;
}

function greeting(contactName?: string | null): string {
  return contactName?.trim() ? `Hi ${contactName.trim()},` : "Hello,";
}

function offerFor(strategy?: string | null): string {
  if (strategy === "Private Label Pitch") return "private-label bathroom collections with flexible branding, finishes, and packaging";
  if (strategy === "Distribution Partnership") return "a distribution-ready range of bathroom faucets and shower systems";
  return "OEM/ODM bathroom faucets and shower systems tailored to your product roadmap";
}

export function generateOutreachDraft(input: OutreachDraftInput): GeneratedOutreachDraft {
  const company = input.companyName.trim() || "your company";
  const products = input.recommendedProducts?.trim() || "bathroom faucets and shower systems";
  const strategy = input.outreachStrategy?.trim() || "OEM/ODM Pitch";
  const shipmentEvidence = input.totalShipments && input.totalShipments > 0
    ? `${input.totalShipments} historical shipment records${input.latestShipmentDate ? `, with the latest activity recorded on ${input.latestShipmentDate.slice(0, 10)}` : ""}`
    : "stored trade and company evidence";
  const evidenceSummary = `${company}: ${shipmentEvidence}. Recommended approach: ${strategy}. Recommended products: ${products}.`;
  const recentActivity = input.latestShipmentDate
    ? ` We noticed relevant sourcing activity recorded as recently as ${input.latestShipmentDate.slice(0, 10)}.`
    : "";
  const researchReview = [input.researchReason?.trim(), input.researchNextAction?.trim()].filter(Boolean).join(" Recommended next step: ");
  const personalizationNotes = `Confirm the recipient's role and the cited company evidence before approval. Replace generic greeting when a verified contact name is available.${researchReview ? ` Buyer research for reviewer: ${researchReview}` : ""}`;

  return {
    subject: `${company} × Yundor — bathroom product supply opportunity`,
    body: `${greeting(input.contactName)}\n\nI’m reaching out from Yundor, a bathroom-product manufacturing partner supporting international brands and distributors. Based on our review of ${company}’s public company and trade activity, your business appears relevant to our ${products} capabilities.${recentActivity}\n\nWe can support ${offerFor(strategy)}, with OEM/ODM development, coordinated finishes, quality control, and export-ready fulfillment from China.\n\nWould a short introduction and product fit review be useful? If you are not the right contact, I would appreciate being directed to the person responsible for sourcing or product development.\n\nBest regards,\nYundor Business Development`,
    evidenceSummary,
    personalizationNotes,
  };
}
