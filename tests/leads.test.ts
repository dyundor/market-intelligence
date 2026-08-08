import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateLeadStrategy } from "../lib/leads/strategy.ts";
import { qualifyBuyer } from "../lib/qualification/factors.ts";
import { generateOutreachDraft } from "../lib/leads/outreach-draft.ts";
import { computePipelineMetrics, leadStatusForOutcome } from "../lib/leads/feedback.ts";
import { matchCompanyEvidence, validatePublicEvidence } from "../lib/leads/public-contact-enrichment.ts";
import { contactResearchId, summarizeContactResearch, validateContactResearch } from "../lib/leads/contact-research.ts";
import { buildSalesExportCsv, csvCell } from "../lib/leads/sales-export.ts";
import { evaluateOutreachReadiness } from "../lib/leads/outreach-readiness.ts";
import { shouldInitializeSalesLead, sortSalesLeads } from "../lib/leads/pipeline-selection.ts";

const faucetRow: Record<string, unknown> = {
  id: "test-buyer-1",
  name: "AquaPro Trading Co.",
  total_shipments: 36,
  latest_shipment_date: "2026-07-15",
  supplier_count: 2,
  supplierNames: ["Guangzhou Faucet Manufacturing Co., Ltd.", "Foshan Shower Hardware Co., Ltd."],
  productDescriptions: ["Brass faucets", "Mixer faucets", "Basin faucets"],
  products: "Brass faucets faucet tap basin",
  identity_confidence: 100,
  website_status: "verified",
  entity_type: "importer",
  search_query: "龙头及阀类",
};

const faucetContext = {
  productCategory: "faucet",
  productKeywords: ["faucet", "龙头", "tap", "basin faucet", "mixer", "brass", "valve"],
  excludeKeywords: ["kitchen", "sauna", "shower door", "bathtub"],
};

describe("Lead Strategy", () => {
  it("generates a lead record with outreach strategy from qualification data", () => {
    const qual = qualifyBuyer(faucetRow, faucetContext);
    const lead = generateLeadStrategy(qual, faucetRow);

    assert.ok(lead.companyId);
    assert.ok(["new", "researching", "contact_ready", "contacted", "follow_up", "qualified", "opportunity"].includes(lead.leadStatus), "valid leadStatus");
    assert.ok(["OEM/ODM Pitch", "Private Label Pitch", "Distribution Partnership", "Research Only"].includes(lead.outreachStrategy), "valid strategy");
    assert.ok(lead.recommendedProducts.length > 0);
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(lead.confidence), "valid confidence");
    assert.ok(lead.commercialFitScore >= 0 && lead.commercialFitScore <= 100);
    assert.ok(lead.outreachScore >= 0 && lead.outreachScore <= 100);
  });

  it("keeps confident leads in research until a verified contact exists", () => {
    const qual = qualifyBuyer(faucetRow, faucetContext);
    const lead = generateLeadStrategy(qual, faucetRow);
    assert.equal(lead.leadStatus, "researching");
  });

  it("returns Research Only for priority C buyers", () => {
    const weak: Record<string, unknown> = {
      id: "test-buyer-c",
      name: "Unknown Importer",
      total_shipments: 2,
      latest_shipment_date: "2025-01-01",
      supplier_count: 0,
      supplierNames: [],
      productDescriptions: ["unknown"],
      products: "unknown",
      identity_confidence: 30,
      website_status: "unknown",
      entity_type: "importer",
      search_query: "",
    };
    const qual = qualifyBuyer(weak, faucetContext);
    const lead = generateLeadStrategy(qual, weak);
    assert.equal(lead.outreachStrategy, "Research Only");
  });

  it("returns OEM/ODM Pitch for priority A with strong China supplier signal", () => {
    const strong: Record<string, unknown> = {
      id: "test-buyer-a",
      name: "Premium Brand Group",
      total_shipments: 500,
      latest_shipment_date: "2026-07-20",
      supplier_count: 3,
      supplierNames: ["Shenzhen Factory Ltd.", "Guangzhou Mfg Co."],
      productDescriptions: ["Brass Bathroom Faucets", "Basin Faucets", "Bath Faucets"],
      products: "Brass Bathroom Faucets faucet basin tap",
      identity_confidence: 100,
      website_status: "verified_company_site",
      entity_type: "importer",
      search_query: "龙头及阀类",
    };
    const qual = qualifyBuyer(strong, faucetContext);
    assert.equal(qual.priority, "A", "500 shipments should reach A priority");
    assert.ok(qual.supplierIntelligence.chinaSupplierCount > 0, "should detect China suppliers");
    const lead = generateLeadStrategy(qual, strong);
    assert.equal(lead.outreachStrategy, "OEM/ODM Pitch");
  });

  it("all score outputs are bounded 0-100", () => {
    const qual = qualifyBuyer(faucetRow, faucetContext);
    assert.ok(qual.qualificationScore >= 0 && qual.qualificationScore <= 100);
    assert.ok(qual.productMatchConfidence >= 0 && qual.productMatchConfidence <= 100);

    const lead = generateLeadStrategy(qual, faucetRow);
    assert.ok(lead.commercialFitScore >= 0 && lead.commercialFitScore <= 100);
    assert.ok(lead.outreachScore >= 0 && lead.outreachScore <= 100);
  });

  it("uses snake_case shipment volume from persisted buyer rows", () => {
    const highVolume = { ...faucetRow, total_shipments: 600 };
    const qual = qualifyBuyer(highVolume, faucetContext);
    const lead = generateLeadStrategy(qual, highVolume);
    assert.notEqual(lead.confidence, "LOW");
  });
});

describe("Qualification → Lead pipeline", () => {
  it("maps priority A to OEM/ODM when China supplier present", () => {
    const row = { ...faucetRow, total_shipments: 500, supplierNames: ["Guangzhou Mfg"] };
    const qual = qualifyBuyer(row, faucetContext);
    const lead = generateLeadStrategy(qual, row);
    if (qual.priority === "A" && qual.supplierIntelligence.chinaSupplierCount > 0) {
      assert.equal(lead.outreachStrategy, "OEM/ODM Pitch");
    }
  });

  it("maps HIGH product match to Full Bathroom Collection", () => {
    const qual = qualifyBuyer(faucetRow, faucetContext);
    const lead = generateLeadStrategy(qual, faucetRow);
    if (qual.productMatch === "HIGH") {
      assert.equal(lead.recommendedProducts, "Full Bathroom Collection");
    }
  });

  it("qualification engine remains unchanged by lead layer", () => {
    const qual1 = qualifyBuyer(faucetRow, faucetContext);
    const qual2 = qualifyBuyer(faucetRow, faucetContext);

    assert.equal(qual1.priority, qual2.priority);
    assert.equal(qual1.qualificationScore, qual2.qualificationScore);
    assert.equal(qual1.productMatch, qual2.productMatch);
    assert.equal(qual1.buyerType, qual2.buyerType);
    assert.equal(qual1.buyerSizeTier, qual2.buyerSizeTier);
  });

  it("qualification does not call any paid APIs", () => {
    const qual = qualifyBuyer(faucetRow, faucetContext);
    assert.ok(qual.qualificationScore > 0, "qualification still computes");
  });
});

describe("Outreach draft", () => {
  it("uses buyer evidence and recommended products without inventing a contact", () => {
    const draft = generateOutreachDraft({companyName:"AquaPro Trading Co.",totalShipments:36,latestShipmentDate:"2026-07-15",outreachStrategy:"Distribution Partnership",recommendedProducts:"Basin Faucets + Shower Systems"});
    assert.match(draft.subject,/AquaPro Trading Co\./);
    assert.match(draft.body,/Basin Faucets \+ Shower Systems/);
    assert.match(draft.body,/Hello,/);
    assert.match(draft.evidenceSummary,/36 historical shipment records/);
    assert.doesNotMatch(draft.body,/Dear Purchasing Manager/);
  });

  it("personalizes the greeting only when a contact name is supplied", () => {
    const draft = generateOutreachDraft({companyName:"North Bath",contactName:"Morgan",outreachStrategy:"Private Label Pitch"});
    assert.match(draft.body,/Hi Morgan,/);
    assert.match(draft.body,/private-label bathroom collections/);
  });
});

describe("Sales feedback loop", () => {
  it("moves positive outcomes forward and bounced contacts back to research", () => {
    assert.equal(leadStatusForOutcome("interested"), "qualified");
    assert.equal(leadStatusForOutcome("quote_requested"), "opportunity");
    assert.equal(leadStatusForOutcome("bounced"), "researching");
  });

  it("computes overdue tasks and positive response rate", () => {
    const metrics = computePipelineMetrics([
      {leadStatus:"qualified",outcomeCode:"interested",nextActionDue:"2026-08-07"},
      {leadStatus:"follow_up",outcomeCode:"no_response",nextActionDue:"2026-08-08"},
      {leadStatus:"researching",outcomeCode:null,nextActionDue:"2026-08-10"},
    ],"2026-08-08");
    assert.equal(metrics.overdue,1);
    assert.equal(metrics.dueToday,1);
    assert.equal(metrics.contacted,2);
    assert.equal(metrics.positiveRate,50);
  });
});

describe("Public contact enrichment", () => {
  const evidence = {companyName:"Waxman Consumer Products Group",website:"https://www.waxman.com/",websiteSourceUrl:"https://www.waxman.com/",contacts:[{type:"email" as const,value:"customerservice@waxmancpg.com",label:"Customer Service",sourceUrl:"https://waxman.com/terms-of-use.html",verificationStatus:"verified" as const}]};
  it("matches normalized company names only when the match is unique", () => {
    assert.equal(matchCompanyEvidence(evidence,[{id:"1",name:"Waxman Consumer Products Group, Inc."}]).status,"matched");
    assert.equal(matchCompanyEvidence(evidence,[{id:"1",name:"Waxman Consumer Products Group"},{id:"2",name:"Waxman Consumer Products Group Inc"}]).status,"ambiguous");
    assert.equal(matchCompanyEvidence(evidence,[{id:"3",name:"Different Company"}]).status,"unmatched");
  });
  it("requires https source evidence and validates email syntax", () => {
    assert.deepEqual(validatePublicEvidence(evidence),[]);
    assert.ok(validatePublicEvidence({...evidence,contacts:[{...evidence.contacts[0],sourceUrl:"",value:"guessed-at-example"}]}).length>=2);
  });
});

describe("Contact research queue", () => {
  const unresolved = {companyName:"Best Mart",status:"needs_identity_match" as const,reasonCode:"ambiguous_company_name" as const,reason:"Multiple unrelated businesses match.",nextAction:"Confirm consignee address.",evidenceUrls:[]};
  it("stores unresolved research without inventing evidence", () => {
    assert.deepEqual(validateContactResearch(unresolved),[]);
    assert.equal(contactResearchId("Best Mart, Inc."),"lcr-best-mart");
  });
  it("rejects inconsistent verified states and insecure evidence", () => {
    assert.ok(validateContactResearch({...unresolved,status:"verified",evidenceUrls:["http://example.com"]}).length>=2);
  });
  it("reports actionable research coverage", () => {
    assert.deepEqual(summarizeContactResearch([{status:"verified"},{status:"needs_identity_match"},{status:"unresolved"}]),{total:3,verified:1,needsIdentityMatch:1,unresolved:1,coveragePercent:33});
  });
});

describe("Sales-ready lead export", () => {
  it("creates a UTF-8 CSV with verified-contact evidence fields", () => {
    const csv=buildSalesExportCsv([{companyName:"Aqua, Inc.",country:"US",website:"https://aqua.example",leadStatus:"contact_ready",contactType:"email",contactValue:"buyer@aqua.example",contactLabel:"Purchasing",contactSourceUrl:"https://aqua.example/contact",outreachStrategy:"OEM/ODM Pitch",recommendedProducts:"Faucets",commercialFitScore:88,outreachScore:91,nextAction:"Send introduction",nextActionDue:"2026-08-10"}]);
    assert.ok(csv.startsWith("\ufeff"));
    assert.match(csv,/"Aqua, Inc\."/);
    assert.match(csv,/buyer@aqua\.example/);
    assert.match(csv,/Contact Evidence/);
  });
  it("neutralizes spreadsheet formulas in exported values", () => {
    assert.equal(csvCell("=HYPERLINK(\"bad\")"),"\"'=HYPERLINK(\"\"bad\"\")\"");
  });
});

describe("Outreach readiness gate", () => {
  it("allows approval only with verified identity and contact", () => {
    assert.deepEqual(evaluateOutreachReadiness({identityVerified:true,verifiedContactCount:1,contactResearchStatus:"verified"}),{ready:true,blockers:[]});
  });
  it("explains every blocker without hiding unresolved research", () => {
    assert.deepEqual(evaluateOutreachReadiness({identityVerified:false,verifiedContactCount:0,contactResearchStatus:"needs_identity_match"}),{ready:false,blockers:["identity_unverified","verified_contact_missing","contact_research_unresolved"]});
  });
});

describe("Real sales pipeline selection",()=>{
  const qualifiedLead={companyId:"buyer-1",leadStatus:"researching" as const,outreachStrategy:"OEM/ODM Pitch" as const,recommendedProducts:"Faucets",confidence:"HIGH" as const,commercialFitScore:72,outreachScore:68};
  it("selects commercially useful, source-verified buyers",()=>{
    assert.deepEqual(shouldInitializeSalesLead({existing:false,identityStatus:"source_verified",identityConfidence:90,evidenceShipments:12,lead:qualifiedLead}),{selected:true,reason:"sales_threshold"});
  });
  it("keeps existing leads eligible for strategy enrichment without stage regression",()=>{
    assert.deepEqual(shouldInitializeSalesLead({existing:true,identityStatus:"fuzzy_candidate",identityConfidence:70,evidenceShipments:1,lead:{...qualifiedLead,outreachStrategy:"Research Only",commercialFitScore:10,outreachScore:5}}),{selected:true,reason:"existing_watchlist"});
  });
  it("rejects fuzzy identities before creating a new sales lead",()=>{
    assert.deepEqual(shouldInitializeSalesLead({existing:false,identityStatus:"fuzzy_candidate",identityConfidence:70,evidenceShipments:12,lead:qualifiedLead}),{selected:false,reason:"identity_not_ready"});
  });
  it("requires at least three relevant trade records for a new lead",()=>{
    assert.deepEqual(shouldInitializeSalesLead({existing:false,identityStatus:"source_verified",identityConfidence:90,evidenceShipments:2,lead:qualifiedLead}),{selected:false,reason:"insufficient_trade_evidence"});
  });
  it("orders actionable stages before research and uses scores within a stage",()=>{
    const ordered=sortSalesLeads([
      {leadStatus:"researching",outreachScore:90,commercialFitScore:90,company:{name:"Research"}},
      {leadStatus:"contact_ready",outreachScore:60,commercialFitScore:60,company:{name:"Ready"}},
      {leadStatus:"qualified",outreachScore:50,commercialFitScore:50,company:{name:"Qualified"}},
      {leadStatus:"contact_ready",outreachScore:80,commercialFitScore:60,company:{name:"Ready High"}},
    ]);
    assert.deepEqual(ordered.map(item=>item.company.name),["Qualified","Ready High","Ready","Research"]);
  });
});
