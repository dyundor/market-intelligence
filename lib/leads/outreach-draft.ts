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

export type FollowUpOutcome = "no_response" | "replied" | "interested" | "meeting_booked" | "quote_requested";

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

export function generateFollowUpDraft(input: OutreachDraftInput & {outcomeCode: FollowUpOutcome; outcomeNotes?: string | null}): GeneratedOutreachDraft {
  const initial = generateOutreachDraft(input);
  const company = input.companyName.trim() || "your company";
  const products = input.recommendedProducts?.trim() || "bathroom faucets and shower systems";
  const messages: Record<FollowUpOutcome,string> = {
    no_response: `I wanted to briefly follow up on my earlier note about Yundor's ${products} capabilities. If this category is relevant to your current sourcing plans, I can send a focused introduction rather than a broad catalog.`,
    replied: `Thank you for your reply. To keep the next step useful, we can focus on the ${products} requirements most relevant to ${company}, including target specifications, finishes, certification needs, volume, and timeline.`,
    interested: `Thank you for your interest. We can prepare a focused product-fit proposal for ${products}, including suitable specifications, finish options, certification support, indicative MOQ, and development timing.`,
    meeting_booked: `Thank you for arranging time with us. For a productive discussion, we propose covering your priority ${products} requirements, target market and certifications, expected volume, finish direction, and development timeline.`,
    quote_requested: `Thank you for the quotation request. Before finalizing pricing, could you confirm the target models or specifications, required certifications, finishes, estimated order quantity, packaging needs, and preferred delivery timing for ${products}?`,
  };
  const outcomeContext = input.outcomeNotes?.trim() ? ` Reviewer context from the latest result: ${input.outcomeNotes.trim()}` : "";
  return {
    subject: `Following up — ${company} × Yundor`,
    body: `${greeting(input.contactName)}\n\n${messages[input.outcomeCode]}\n\nPlease let me know the best next step, or who on your sourcing or product team I should coordinate with.\n\nBest regards,\nYundor Business Development`,
    evidenceSummary: `${initial.evidenceSummary} Follow-up basis: ${input.outcomeCode}.`,
    personalizationNotes: `${initial.personalizationNotes}${outcomeContext} Confirm the latest conversation before approval; this follow-up is never sent automatically.`,
  };
}
