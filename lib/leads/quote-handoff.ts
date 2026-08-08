import { quoteReadiness } from "./qualification-profile.ts";

export interface QuoteHandoffInput {
  companyName: string;
  recommendedProducts?: string | null;
  targetMarket?: string | null;
  requiredCertifications?: string | null;
  estimatedAnnualUnits?: number | null;
  targetMoq?: number | null;
  quoteRequirements?: string | null;
  researchReason?: string | null;
  researchNextAction?: string | null;
  latestOutcomeNotes?: string | null;
}

export function buildQuoteHandoff(input: QuoteHandoffInput): {ready:true;text:string}|{ready:false;missing:string[]} {
  const readiness=quoteReadiness(input);
  if(!readiness.ready)return {ready:false,missing:readiness.missing};
  const lines=[
    `QUOTE HANDOFF — ${input.companyName.trim()}`,
    "",
    `Recommended products: ${input.recommendedProducts?.trim()||"Bathroom faucets and shower systems"}`,
    `Target market: ${input.targetMarket!.trim()}`,
    `Required certifications: ${input.requiredCertifications!.trim()}`,
    `Estimated annual demand: ${input.estimatedAnnualUnits} units`,
    `Target MOQ: ${input.targetMoq} units`,
    `Specifications / finishes / packaging: ${input.quoteRequirements!.trim()}`,
  ];
  if(input.latestOutcomeNotes?.trim())lines.push("",`Latest buyer request: ${input.latestOutcomeNotes.trim()}`);
  if(input.researchReason?.trim()||input.researchNextAction?.trim()){
    lines.push("","INTERNAL REVIEW — DO NOT SEND TO BUYER");
    if(input.researchReason?.trim())lines.push(`Buyer qualification / risk: ${input.researchReason.trim()}`);
    if(input.researchNextAction?.trim())lines.push(`Required review action: ${input.researchNextAction.trim()}`);
  }
  lines.push("","Confirm unit pricing, tooling, sample cost, lead time, Incoterm, payment terms, quote validity, and certification scope before release.");
  return {ready:true,text:lines.join("\n")};
}
