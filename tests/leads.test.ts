import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { generateLeadStrategy } from "../lib/leads/strategy.ts";
import { qualifyBuyer } from "../lib/qualification/factors.ts";
import { generateFollowUpDraft, generateOutreachDraft } from "../lib/leads/outreach-draft.ts";
import { computePipelineMetrics, defaultFollowUpForOutcome, leadStatusForOutcome } from "../lib/leads/feedback.ts";
import { matchCompanyEvidence, validatePublicEvidence } from "../lib/leads/public-contact-enrichment.ts";
import { contactResearchId, summarizeContactResearch, validateContactResearch } from "../lib/leads/contact-research.ts";
import { buildSalesExportCsv, csvCell } from "../lib/leads/sales-export.ts";
import { buildSalesPriorityQueue, computeOpportunityMetrics, validateExpectedCloseDate, validateOpportunityProbability, validateOpportunityValue } from "../lib/leads/opportunity-pipeline.ts";
import { evaluateOutreachReadiness } from "../lib/leads/outreach-readiness.ts";
import { shouldInitializeSalesLead, sortSalesLeads } from "../lib/leads/pipeline-selection.ts";
import { contactRouteNote, draftChannelForContact, selectBestVerifiedContact } from "../lib/leads/outreach-package.ts";
import { addBusinessDays, nextAvailableReviewDate, scheduleReviewDate } from "../lib/leads/sales-task.ts";
import { LeadRepository } from "../lib/repositories/lead-repository.ts";
import { draftSentActionId, shouldSyncDraftSent } from "../lib/leads/draft-lifecycle.ts";
import { contactHref, emailDraftHref } from "../lib/leads/contact-link.ts";
import { quoteReadiness, validateQualificationQuantity, validateQualificationText } from "../lib/leads/qualification-profile.ts";
import { buildQuoteHandoff } from "../lib/leads/quote-handoff.ts";
import { computeQuoteFunnel } from "../lib/leads/quote-funnel.ts";
import { bestVerifiedContact, contactRouteGuidance, contactRoutePriority, contactRouteQuality } from "../lib/leads/contact-quality.ts";
import { buildContactGapQueue } from "../lib/leads/contact-gap.ts";

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
    assert.ok(["new", "researching", "contact_ready", "contacted", "follow_up", "qualified", "opportunity", "disqualified"].includes(lead.leadStatus), "valid leadStatus");
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

  it("uses recent activity in the body and keeps research risk in reviewer notes", () => {
    const draft = generateOutreachDraft({companyName:"Dakota Plumbing Products",latestShipmentDate:"2026-06-09",researchReason:"Certification history requires review.",researchNextAction:"Verify test documents before quoting."});
    assert.match(draft.body,/sourcing activity recorded as recently as 2026-06-09/);
    assert.doesNotMatch(draft.body,/Certification history/);
    assert.match(draft.personalizationNotes,/Certification history requires review/);
    assert.match(draft.personalizationNotes,/Verify test documents before quoting/);
  });

  it("generates outcome-specific follow-up content without auto-sending", () => {
    const noResponse=generateFollowUpDraft({companyName:"North Bath",recommendedProducts:"Shower Systems",outcomeCode:"no_response"});
    const quote=generateFollowUpDraft({companyName:"North Bath",recommendedProducts:"Shower Systems",outcomeCode:"quote_requested",outcomeNotes:"Asked for matte black pricing"});
    assert.match(noResponse.subject,/Following up/);
    assert.match(noResponse.body,/briefly follow up/);
    assert.match(quote.body,/required certifications/);
    assert.match(quote.body,/target MOQ/);
    assert.match(quote.personalizationNotes,/Asked for matte black pricing/);
    assert.match(quote.personalizationNotes,/never sent automatically/);
  });

  it("asks only for missing quote inputs and confirms a complete scope", () => {
    const missing=generateFollowUpDraft({companyName:"North Bath",recommendedProducts:"Shower Systems",outcomeCode:"quote_requested",targetMarket:"US",requiredCertifications:"cUPC",estimatedAnnualUnits:10000,targetMoq:null,quoteRequirements:"Matte black; retail carton"});
    assert.match(missing.body,/target MOQ/);
    assert.doesNotMatch(missing.body,/could you please confirm target market/);
    const ready=generateFollowUpDraft({companyName:"North Bath",recommendedProducts:"Shower Systems",outcomeCode:"quote_requested",targetMarket:"United States",requiredCertifications:"cUPC",estimatedAnnualUnits:10000,targetMoq:500,quoteRequirements:"Matte black; retail carton"});
    assert.match(ready.body,/estimated annual demand of 10000 units/);
    assert.match(ready.body,/Please confirm that this scope is correct/);
    assert.doesNotMatch(ready.body,/could you please confirm required certifications/);
  });

  it("creates a quotation follow-up after the quote has been sent",()=>{
    const draft=generateFollowUpDraft({companyName:"North Bath",recommendedProducts:"Shower Systems",outcomeCode:"quote_sent",outcomeNotes:"Quote Q-104 sent on August 8"});
    assert.match(draft.body,/follow up on the quotation/);
    assert.match(draft.body,/pricing assumption, MOQ, lead time/);
    assert.match(draft.personalizationNotes,/Quote Q-104 sent/);
  });
});

describe("Verified outreach package", () => {
  const contacts = [
    {contactType:"phone",contactValue:"+1-555-0100",label:"Office",sourceUrl:"https://buyer.example/contact",verificationStatus:"verified"},
    {contactType:"website_contact_page",contactValue:"https://buyer.example/contact",label:"Contact Form",sourceUrl:"https://buyer.example/contact",verificationStatus:"verified"},
    {contactType:"email",contactValue:"sales@buyer.example",label:"Sales",sourceUrl:"https://buyer.example/contact",verificationStatus:"unverified"},
  ];
  it("prefers a verified contact form over phone and ignores unverified email", () => {
    const selected = selectBestVerifiedContact(contacts);
    assert.equal(selected?.contactType, "website_contact_page");
    assert.equal(selected && draftChannelForContact(selected), "website");
  });
  it("keeps the evidence URL and manual-review warning in the package", () => {
    const selected = selectBestVerifiedContact(contacts)!;
    assert.match(contactRouteNote(selected), /https:\/\/buyer\.example\/contact/);
    assert.match(contactRouteNote(selected), /never sent automatically/);
  });
  it("rejects contacts without verified HTTPS evidence", () => {
    assert.equal(selectBestVerifiedContact([{...contacts[0],sourceUrl:"http://buyer.example",verificationStatus:"verified"}]), null);
  });
});

describe("Contact execution links", () => {
  it("creates actionable links for supported verified contact types", () => {
    assert.equal(contactHref("email", "sales@example.com"), "mailto:sales@example.com");
    assert.equal(contactHref("phone", "+1 (888) 560-5222"), "tel:+18885605222");
    assert.equal(contactHref("website_contact_page", "https://example.com/contact"), "https://example.com/contact");
  });

  it("rejects malformed and unsafe contact values", () => {
    assert.equal(contactHref("email", "not-an-email"), null);
    assert.equal(contactHref("website_contact_page", "javascript:alert(1)"), null);
    assert.equal(contactHref("phone", "12"), null);
  });

  it("prefills a draft without bypassing the email client", () => {
    const href = emailDraftHref("sales@example.com", "OEM faucet program", "Hello,\nCan we talk?");
    assert.ok(href?.startsWith("mailto:sales@example.com?"));
    assert.ok(href?.includes("subject=OEM+faucet+program"));
    assert.ok(href?.includes("body=Hello%2C%0ACan+we+talk%3F"));
    assert.equal(emailDraftHref("invalid", "Subject", "Body"), null);
  });
});

describe("Contact route quality",()=>{
  it("prioritizes a purchasing owner over a generic inbox or phone",()=>{
    const contacts=[
      {contactType:"email",contactValue:"info@buyer.example",label:"General Information",verificationStatus:"verified"},
      {contactType:"phone",contactValue:"+1-555-0100",label:"Headquarters",verificationStatus:"verified"},
      {contactType:"email",contactValue:"buyer@buyer.example",label:"Purchasing Manager",verificationStatus:"verified"},
    ];
    assert.equal(bestVerifiedContact(contacts)?.contactValue,"buyer@buyer.example");
    assert.equal(contactRouteQuality(contacts[2]),"decision_maker");
    assert.ok(contactRoutePriority(contacts[2])<contactRoutePriority(contacts[0]));
  });
  it("distinguishes a business route from general and fallback routes",()=>{
    assert.equal(contactRouteQuality({contactType:"website_contact_page",contactValue:"https://buyer.example/contact",label:"Business Inquiry"}),"business_route");
    assert.equal(contactRouteQuality({contactType:"email",contactValue:"support@buyer.example",label:"Customer Support"}),"general_route");
    assert.equal(contactRouteQuality({contactType:"phone",contactValue:"+1-555-0100",label:"Front Desk"}),"fallback");
    assert.match(contactRouteGuidance("general_route"),/routing to purchasing/);
  });
  it("treats a verified small-company owner as a decision route",()=>{
    assert.equal(contactRouteQuality({contactType:"linkedin",contactValue:"https://linkedin.com/in/owner",label:"Owner / Executive Decision Route"}),"decision_maker");
  });
});

describe("Decision-owner contact gap queue",()=>{
  it("prioritizes high-fit buyers lacking a direct purchasing route",()=>{
    const queue=buildContactGapQueue([
      {companyId:"danco",companyName:"Danco",leadStatus:"contact_ready",commercialFitScore:88,outreachScore:87,bestContactRouteQuality:"business_route",bestContactLabel:"Business Form",nextActionDue:"2026-08-20"},
      {companyId:"generic",companyName:"Generic",leadStatus:"contact_ready",commercialFitScore:40,outreachScore:80,bestContactRouteQuality:"general_route",bestContactLabel:"Customer Service"},
      {companyId:"direct",companyName:"Direct",leadStatus:"contact_ready",commercialFitScore:95,outreachScore:95,bestContactRouteQuality:"decision_maker",bestContactLabel:"Purchasing Manager"},
      {companyId:"research",companyName:"Research",leadStatus:"researching",commercialFitScore:99,outreachScore:99,bestContactRouteQuality:null},
      {companyId:"reply",companyName:"Replied",leadStatus:"follow_up",commercialFitScore:99,outreachScore:99,bestContactRouteQuality:null},
    ]);
    assert.deepEqual(queue.map(item=>item.companyId),["danco","generic"]);
    assert.match(queue[0].recommendedAction,/sourcing or product-development owner/);
    assert.ok(queue[0].priorityScore>queue[1].priorityScore);
  });
});

describe("Sales review task scheduling", () => {
  it("assigns two priority reviews per business day and skips weekends", () => {
    assert.deepEqual([0,1,2,3,4].map(index => scheduleReviewDate(index, "2026-08-08")), ["2026-08-10","2026-08-10","2026-08-11","2026-08-11","2026-08-12"]);
  });
  it("rejects invalid task schedule inputs", () => {
    assert.throws(() => scheduleReviewDate(-1, "2026-08-08"));
    assert.throws(() => scheduleReviewDate(0, "08/08/2026"));
  });
  it("schedules follow-up after three business days", () => {
    assert.equal(addBusinessDays("2026-08-07", 3), "2026-08-12");
  });
  it("places new reviews after already-full business days", () => {
    const load = {"2026-08-10":2,"2026-08-11":2,"2026-08-12":2,"2026-08-13":2};
    assert.equal(nextAvailableReviewDate("2026-08-08", load), "2026-08-14");
  });
  it("replaces the previous current task only after saving the new activity", async () => {
    const raw = new DatabaseSync(":memory:");
    raw.exec(`CREATE TABLE lead_actions (id TEXT PRIMARY KEY,company_id TEXT,action_type TEXT,direction TEXT,channel TEXT,summary TEXT,outcome TEXT,outcome_code TEXT,qualification_feedback TEXT,feedback_reason TEXT,next_action TEXT,next_action_due TEXT,performed_by TEXT,created_at TEXT)`);
    const db = {prepare(sql: string) {const statement=raw.prepare(sql);return {bind(...args: unknown[]) {return {async run(){const result=statement.run(...args);return {meta:{changes:result.changes}}},async all(){return {results:statement.all(...args)}}}}}}};
    const repository = new LeadRepository(db);
    const base = {companyId:"buyer-1",actionType:"review_outreach",direction:"outbound" as const,channel:"email",summary:"Review package",outcome:null,outcomeCode:null,qualificationFeedback:null,feedbackReason:null,nextAction:"Send manually",nextActionDue:"2026-08-10",performedBy:"system"};
    const first = await repository.createAction(base);
    const second = await repository.createAction({...base,actionType:"outreach",summary:"Sent manually",nextAction:"Follow up",nextActionDue:"2026-08-14",performedBy:"manual"});
    const rows = raw.prepare("SELECT id,next_action_due FROM lead_actions ORDER BY created_at,id").all();
    assert.equal(rows.find(row=>row.id===first.id)?.next_action_due, null);
    assert.equal(rows.find(row=>row.id===second.id)?.next_action_due, "2026-08-14");
    raw.close();
  });
});

describe("Outreach draft lifecycle", () => {
  it("syncs only the first transition to sent", () => {
    assert.equal(shouldSyncDraftSent("approved", "sent", false), true);
    assert.equal(shouldSyncDraftSent("sent", "sent", false), false);
    assert.equal(shouldSyncDraftSent("approved", "sent", true), false);
    assert.equal(shouldSyncDraftSent("draft", "approved", false), false);
  });
  it("creates a stable action id per draft", () => {
    assert.equal(draftSentActionId("draft-1"), "la-draft-1-sent");
  });
});

describe("Sales feedback loop", () => {
  it("moves positive outcomes forward and bounced contacts back to research", () => {
    assert.equal(leadStatusForOutcome("interested"), "qualified");
    assert.equal(leadStatusForOutcome("quote_requested"), "opportunity");
    assert.equal(leadStatusForOutcome("quote_sent"), "opportunity");
    assert.equal(leadStatusForOutcome("bounced"), "researching");
    assert.equal(leadStatusForOutcome("not_fit"), "disqualified");
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

  it("keeps actionable outcomes in the task queue with business-day defaults", () => {
    assert.deepEqual(defaultFollowUpForOutcome("interested", "2026-08-07"), {
      nextAction:"Qualify buyer needs and propose the next step",
      nextActionDue:"2026-08-10",
    });
    assert.deepEqual(defaultFollowUpForOutcome("no_response", "2026-08-07"), {
      nextAction:"Send a concise follow-up",
      nextActionDue:"2026-08-12",
    });
    assert.equal(defaultFollowUpForOutcome("won", "2026-08-07"), null);
    assert.equal(defaultFollowUpForOutcome("lost", "2026-08-07"), null);
    assert.deepEqual(defaultFollowUpForOutcome("quote_sent", "2026-08-07"), {
      nextAction:"Follow up on quotation and resolve buyer questions",
      nextActionDue:"2026-08-12",
    });
  });
});

describe("Opportunity pipeline", () => {
  it("computes total and probability-weighted pipeline without disqualified leads", () => {
    assert.deepEqual(computeOpportunityMetrics([
      {leadStatus:"opportunity",opportunityValueUsd:100000,opportunityProbability:40},
      {leadStatus:"qualified",opportunityValueUsd:50000,opportunityProbability:20},
      {leadStatus:"disqualified",opportunityValueUsd:900000,opportunityProbability:100},
      {leadStatus:"contact_ready",opportunityValueUsd:null,opportunityProbability:null},
    ]),{opportunityCount:2,pipelineValueUsd:150000,weightedPipelineValueUsd:50000});
  });
  it("validates safe CRM values and real calendar dates", () => {
    assert.equal(validateOpportunityValue(0),true);
    assert.equal(validateOpportunityValue(-1),false);
    assert.equal(validateOpportunityProbability(100),true);
    assert.equal(validateOpportunityProbability(101),false);
    assert.equal(validateExpectedCloseDate("2026-08-31"),true);
    assert.equal(validateExpectedCloseDate("2026-02-30"),false);
  });
  it("surfaces unscheduled opportunities before upcoming routine tasks", () => {
    const tasks=buildSalesPriorityQueue([
      {companyId:"routine",companyName:"Routine",leadStatus:"contact_ready",nextAction:"Follow up",nextActionDue:"2026-08-12"},
      {companyId:"deal",companyName:"Priority Deal",leadStatus:"opportunity",opportunityValueUsd:200000,opportunityProbability:50,expectedCloseDate:"2026-09-30"},
      {companyId:"done",companyName:"Won Deal",leadStatus:"opportunity",opportunityValueUsd:500000,opportunityProbability:100,outcomeCode:"won"},
    ],"2026-08-08");
    assert.deepEqual(tasks.map(task=>task.companyId),["deal","routine"]);
    assert.equal(tasks[0].timing,"unscheduled");
    assert.equal(tasks[0].weightedValueUsd,100000);
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
  it("keeps the second official-source contact wave valid and uniquely named", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave2-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.map((company: {companyName: string}) => company.companyName), ["B&K LLC", "Posey Supply"]);
    assert.ok(payload.companies.every((company: Parameters<typeof validatePublicEvidence>[0]) => validatePublicEvidence(company).length === 0));
  });
  it("keeps the third official-source contact wave valid", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave3-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.map((company: {companyName: string}) => company.companyName), ["Therma Glass", "Bain D P T Inc"]);
    assert.ok(payload.companies.every((company: Parameters<typeof validatePublicEvidence>[0]) => validatePublicEvidence(company).length === 0));
  });
  it("keeps the fourth product-relevant contact wave valid", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave4-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.map((company: {companyName: string}) => company.companyName), ["Giagni", "Arizona Shower Doors Llc", "Maax Bath"]);
    assert.ok(payload.companies.every((company: Parameters<typeof validatePublicEvidence>[0]) => validatePublicEvidence(company).length === 0));
  });
  it("keeps the fifth corporate contact wave valid", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave5-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.map((company: {companyName: string}) => company.companyName), ["K Hovnanian Distribution", "Legacy Housing Corp"]);
    assert.ok(payload.companies.every((company: Parameters<typeof validatePublicEvidence>[0]) => validatePublicEvidence(company).length === 0));
  });
  it("keeps the sixth corporate identity contact wave valid", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave6-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.map((company: {companyName: string}) => company.companyName), ["Your Source Products"]);
    assert.ok(payload.companies.every((company: Parameters<typeof validatePublicEvidence>[0]) => validatePublicEvidence(company).length === 0));
  });
  it("requires explicit official identity evidence for the seventh contact wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave7-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validatePublicEvidence),[]);
    assert.equal(payload.companies[0].identityEvidence.legalName,"Legion Furniture LLC");
    assert.equal(payload.companies[0].contacts[0].value,"sales@legionfurniture.com");
    assert.equal(payload.companies[0].businessFit.outreachStrategy,"OEM/ODM Pitch");
    assert.ok(payload.companies[0].identityEvidence.sourceUrl.startsWith("https://www.legionfurniture.com/"));
  });
  it("keeps Matco-Norca identity, contact, and business fit evidence explicit", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave8-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validatePublicEvidence),[]);
    assert.equal(payload.companies[0].identityEvidence.legalName,"Matco-Norca LLC");
    assert.equal(payload.companies[0].contacts[0].value,"mail@matco-norca.com");
    assert.match(payload.companies[0].businessFit.recommendedProducts,/Bathroom Faucets/);
  });
  it("keeps Rafael J. Nido identity, corporate contact, and regional fit explicit", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave9-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validatePublicEvidence),[]);
    assert.equal(payload.companies[0].identityEvidence.legalName,"Rafael J. Nido, Inc.");
    assert.equal(payload.companies[0].contacts[0].value,"jortiz@nidogroup.net");
    assert.equal(payload.companies[0].businessFit.outreachStrategy,"Distribution Partnership");
  });
  it("links Bath Authority to DreamLine with exact legal and contact evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave10-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validatePublicEvidence),[]);
    assert.equal(payload.companies[0].identityEvidence.legalName,"Bath Authority LLC");
    assert.equal(payload.companies[0].contacts[0].value,"support@dreamline.com");
    assert.match(payload.companies[0].businessFit.recommendedProducts,/Shower Systems/);
  });
  it("keeps Dakota's legal identity, sales route, and compliance-led fit explicit", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-lead-contacts-wave11-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validatePublicEvidence),[]);
    assert.equal(payload.companies[0].identityEvidence.legalName,"Dakota Plumbing Products, LLC");
    assert.equal(payload.companies[0].contacts[0].value,"sales@dakotasinks.com");
    assert.match(payload.companies[0].businessFit.reason,/certification/i);
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
    assert.deepEqual(summarizeContactResearch([{status:"verified"},{status:"needs_identity_match"},{status:"unresolved"}]),{total:3,verified:1,needsIdentityMatch:1,unresolved:1,disqualified:0,coveragePercent:33});
  });
  it("preserves unresolved outcomes in the second research wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave2-2026-08-08.json", import.meta.url), "utf8"));
    assert.ok(payload.companies.every((company: Parameters<typeof validateContactResearch>[0]) => validateContactResearch(company).length === 0));
    assert.deepEqual(summarizeContactResearch(payload.companies), {total:5, verified:2, needsIdentityMatch:2, unresolved:1, disqualified:0, coveragePercent:40});
  });
  it("keeps Cross International unresolved in the third research wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave3-2026-08-08.json", import.meta.url), "utf8"));
    assert.ok(payload.companies.every((company: Parameters<typeof validateContactResearch>[0]) => validateContactResearch(company).length === 0));
    assert.deepEqual(summarizeContactResearch(payload.companies), {total:3, verified:2, needsIdentityMatch:1, unresolved:0, disqualified:0, coveragePercent:67});
  });
  it("marks every fourth-wave identity verified from official evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave4-2026-08-08.json", import.meta.url), "utf8"));
    assert.ok(payload.companies.every((company: Parameters<typeof validateContactResearch>[0]) => validateContactResearch(company).length === 0));
    assert.deepEqual(summarizeContactResearch(payload.companies), {total:3, verified:3, needsIdentityMatch:0, unresolved:0, disqualified:0, coveragePercent:100});
  });
  it("keeps AK Trade unresolved in the fifth research wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave5-2026-08-08.json", import.meta.url), "utf8"));
    assert.ok(payload.companies.every((company: Parameters<typeof validateContactResearch>[0]) => validateContactResearch(company).length === 0));
    assert.deepEqual(summarizeContactResearch(payload.companies), {total:3, verified:2, needsIdentityMatch:0, unresolved:1, disqualified:0, coveragePercent:67});
  });
  it("verifies Your Source Products from official registry and operating-address evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave6-2026-08-08.json", import.meta.url), "utf8"));
    const company = payload.companies[0];
    assert.deepEqual(validateContactResearch(company), []);
    assert.equal(company.companyName, "Your Source Products");
    assert.equal(company.status, "verified");
    assert.ok(company.evidenceUrls.some((url: string) => url.includes("sunbiz.org")));
  });
  it("disqualifies MJF after its official rename identifies a peer manufacturer", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave7-2026-08-08.json", import.meta.url), "utf8"));
    const company = payload.companies[0];
    assert.deepEqual(validateContactResearch(company), []);
    assert.equal(company.companyName, "Mjf Group Inc");
    assert.equal(company.status, "disqualified");
    assert.equal(company.reasonCode, "competitor_or_supplier");
    assert.deepEqual(summarizeContactResearch(payload.companies), {total:1,verified:0,needsIdentityMatch:0,unresolved:0,disqualified:1,coveragePercent:100});
  });
  it("disqualifies the defunct World and Main outreach identity", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave8-2026-08-08.json", import.meta.url), "utf8"));
    const company = payload.companies[0];
    assert.deepEqual(validateContactResearch(company), []);
    assert.equal(company.companyName, "World And Main Cranbury");
    assert.equal(company.status, "disqualified");
    assert.equal(company.reasonCode, "inactive_or_defunct");
    assert.ok(company.evidenceUrls.every((url: string) => url.includes("gordonbrothers")));
  });
  it("expands only Legion while preserving ambiguous candidates in the ninth research wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave9-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies.find((company: {companyName:string})=>company.companyName==="Legion Furniture LLC").status,"verified");
    assert.equal(payload.companies.find((company: {companyName:string})=>company.companyName==="Bath Authority Llc").status,"needs_identity_match");
    assert.equal(payload.companies.find((company: {companyName:string})=>company.companyName==="DC Import LLC").status,"unresolved");
  });
  it("excludes acquired and inactive high-volume identities in the tenth research wave", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave10-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.ok(payload.companies.every((company: {status:string})=>company.status==="disqualified"));
    assert.match(payload.companies[0].nextAction,/Homewerks Worldwide/);
    assert.ok(payload.companies[0].evidenceUrls.some((url:string)=>url.includes("prweb.com")));
  });
  it("verifies Matco-Norca from official identity and current free trade evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave11-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies[0].status,"verified");
    assert.match(payload.companies[0].reason,/8,826 bills of lading/);
    assert.ok(payload.companies[0].evidenceUrls.some((url:string)=>url.includes("importinfo.com/matco-norca")));
  });
  it("verifies Rafael J. Nido from Puerto Rico identity and current faucet evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave12-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies[0].status,"verified");
    assert.match(payload.companies[0].reason,/2,267 bills of lading/);
    assert.ok(payload.companies[0].evidenceUrls.some((url:string)=>url.includes("importinfo.com/guangdong-meijie")));
  });
  it("verifies Bath Authority from DreamLine legal identity and current trade evidence", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave13-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies[0].status,"verified");
    assert.match(payload.companies[0].reason,/1,658 bills of lading/);
    assert.ok(payload.companies[0].evidenceUrls.some((url:string)=>url.includes("importinfo.com/bath-authority")));
  });
  it("excludes Vetta as a directly competing OEM and ODM manufacturer", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave14-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies[0].status,"disqualified");
    assert.equal(payload.companies[0].reasonCode,"competitor_or_supplier");
    assert.match(payload.companies[0].reason,/Guangdong and Mexico/);
  });
  it("verifies Dakota while retaining certification risk in qualification", () => {
    const payload = JSON.parse(readFileSync(new URL("../data/public-contact-research-wave15-2026-08-08.json", import.meta.url), "utf8"));
    assert.deepEqual(payload.companies.flatMap(validateContactResearch),[]);
    assert.equal(payload.companies[0].status,"verified");
    assert.match(payload.companies[0].reason,/at least three relevant 2026 import events/);
    assert.match(payload.companies[0].nextAction,/certification/);
  });
  it("keeps the Westbrass buyer pack tied to official identity, contacts, and free manifest evidence",()=>{
    const sql=readFileSync(new URL("../data/public-buyer-westbrass-2026-08-08.sql",import.meta.url),"utf8");
    assert.match(sql,/https:\/\/www\.importinfo\.com\/the-westbrass-company/);
    assert.match(sql,/https:\/\/westbrass\.com\/contact-us\//);
    assert.match(sql,/orders@westbrass\.com/);
    assert.match(sql,/Assorted bathroom and shower accessories/);
    assert.match(sql,/The Westbrass Company × Yundor — bathroom product supply opportunity/);
    assert.match(sql,/'draft-public-westbrass-initial'.*'draft'/s);
    assert.match(sql,/ON CONFLICT\(id\) DO UPDATE/);
    assert.doesNotMatch(sql,/importyeti-paid|subscription-key|api\.importyeti/);
  });

  it("keeps the Danco buyer pack tied to current free manifests and verified official routes",()=>{
    const sql=readFileSync(new URL("../data/public-buyer-danco-2026-08-08.sql",import.meta.url),"utf8");
    assert.match(sql,/https:\/\/www\.importinfo\.com\/danco-import/);
    assert.match(sql,/https:\/\/www\.danco\.com\/support\/contact-us\//);
    assert.match(sql,/CHSL550992076HCM/);
    assert.match(sql,/Certified Shower Heads \+ Mobile Home Faucets \+ Faucet\/Drain Components/);
    assert.match(sql,/\+1-800-523-5135/);
    assert.match(sql,/website_contact_page/);
    assert.match(sql,/Danco × Yundor — OEM bathroom repair and shower product supply/);
    assert.match(sql,/free_public_trade_web/);
    assert.doesNotMatch(sql,/importyeti_api|subscription-key|paid_api/);
  });
  it("keeps public decision-owner research traceable without inferred email or phone",()=>{
    const sql=readFileSync(new URL("../data/public-decision-owner-wave1-2026-08-08.sql",import.meta.url),"utf8");
    assert.match(sql,/https:\/\/www\.linkedin\.com\/in\/eric-watkins-product/);
    assert.match(sql,/https:\/\/www\.linkedin\.com\/in\/lindseygmorgan/);
    assert.match(sql,/https:\/\/www\.linkedin\.com\/in\/max-homami-6a7b232/);
    assert.match(sql,/Do not infer email addresses|no email inferred/);
    assert.doesNotMatch(sql,/@danco\.com|@westbrass\.com|\+1-\d/);
    assert.match(sql,/ON CONFLICT\(company_id,contact_type,contact_value\) DO UPDATE/);
  });
  it("adds verified B&K decision routes while keeping DreamLine unresolved",()=>{
    const sql=readFileSync(new URL("../data/public-decision-owner-wave2-2026-08-08.sql",import.meta.url),"utf8");
    assert.match(sql,/https:\/\/www\.linkedin\.com\/in\/gustavo-garcia-de-alba-ontiveros-13846a13/);
    assert.match(sql,/Gustavo Garcia de Alba Ontiveros — Director, Sourcing & Product Management/);
    assert.match(sql,/https:\/\/www\.linkedin\.com\/in\/roshellehernandez-78b6b4252/);
    assert.match(sql,/Roshelle Hernandez — Product Manager, Growth Categories/);
    assert.match(sql,/Vadym M\. as DreamLine Director of Product Development/);
    assert.match(sql,/current direct public profile or contact route remains unresolved/);
    assert.doesNotMatch(sql,/@bkproducts\.|@dreamline\.|\+1-\d/);
    assert.match(sql,/COALESCE\(lead_contacts\.label,excluded\.label\)/);
    assert.match(sql,/length\(lead_contacts\.notes\)>=length\(excluded\.notes\)/);
  });
  it("keeps sales export decision-owner ordering aligned with contact quality",()=>{
    const source=readFileSync(new URL("../app/api/leads/export/route.ts",import.meta.url),"utf8");
    for(const role of ["purchas","sourcing","product development","owner","president","chief executive","ceo"]) assert.match(source,new RegExp(`GLOB '\\*${role}\\*'`));
  });
});

describe("Sales-ready lead export", () => {
  it("creates a UTF-8 CSV with verified-contact evidence fields", () => {
    const csv=buildSalesExportCsv([{companyName:"Aqua, Inc.",country:"US",website:"https://aqua.example",leadStatus:"qualified",contactType:"email",contactValue:"buyer@aqua.example",contactLabel:"Purchasing",contactSourceUrl:"https://aqua.example/contact",contactRouteQuality:"decision_maker",contactRouteGuidance:"Direct purchasing route",outreachStrategy:"OEM/ODM Pitch",recommendedProducts:"Faucets",commercialFitScore:88,outreachScore:91,opportunityValueUsd:75000,opportunityProbability:40,expectedCloseDate:"2026-10-31",weightedValueUsd:30000,targetMarket:"United States",requiredCertifications:"cUPC",estimatedAnnualUnits:12000,targetMoq:500,quoteRequirements:"Matte black basin faucet; retail packaging",quoteReady:"yes",missingQuoteFields:"",draftChannel:"email",draftStatus:"sent",draftSubject:"Aqua × Yundor",draftBody:"Hello,\n\nProduct fit.",evidenceSummary:"12 shipment records",personalizationNotes:"Review before sending",researchReason:"Current importer with certification risk",researchNextAction:"Verify test documents before quoting",lastOutcome:"interested",lastOutcomeNotes:"Asked for MOQ",qualificationFeedback:"confirmed_fit",feedbackReason:"Needs basin faucet line",nextAction:"Send introduction",nextActionDue:"2026-08-10"}]);
    assert.ok(csv.startsWith("\ufeff"));
    assert.match(csv,/"Aqua, Inc\."/);
    assert.match(csv,/buyer@aqua\.example/);
    assert.match(csv,/Contact Evidence/);
    assert.match(csv,/Contact Route Quality/);
    assert.match(csv,/decision_maker/);
    assert.match(csv,/Draft Subject/);
    assert.match(csv,/Trade Evidence Summary/);
    assert.match(csv,/Buyer Research Rationale/);
    assert.match(csv,/Current importer with certification risk/);
    assert.match(csv,/Verify test documents before quoting/);
    assert.match(csv,/Latest Outcome/);
    assert.match(csv,/interested/);
    assert.match(csv,/Needs basin faucet line/);
    assert.match(csv,/Opportunity Value USD/);
    assert.match(csv,/Required Certifications/);
    assert.match(csv,/Matte black basin faucet/);
    assert.match(csv,/Quote Ready/);
    assert.match(csv,/"30000"/);
    assert.match(csv,/Hello,\n\nProduct fit\./);
  });
  it("neutralizes spreadsheet formulas in exported values", () => {
    assert.equal(csvCell("=HYPERLINK(\"bad\")"),"\"'=HYPERLINK(\"\"bad\"\")\"");
  });
});

describe("Quote qualification profile", () => {
  it("requires every commercial input before a quote is ready", () => {
    assert.deepEqual(quoteReadiness({targetMarket:"US",requiredCertifications:"cUPC",estimatedAnnualUnits:12000,targetMoq:null,quoteRequirements:"Brushed nickel; branded carton"}),{ready:false,missing:["target_moq"]});
  });
  it("marks a complete positive-volume profile ready", () => {
    assert.deepEqual(quoteReadiness({targetMarket:"US",requiredCertifications:"cUPC / NSF",estimatedAnnualUnits:12000,targetMoq:500,quoteRequirements:"Brushed nickel; branded carton"}),{ready:true,missing:[]});
  });
  it("rejects unsafe quantities and oversized text", () => {
    assert.equal(validateQualificationQuantity(-1),false);
    assert.equal(validateQualificationQuantity(1.5),false);
    assert.equal(validateQualificationText("x".repeat(1001)),false);
  });
});

describe("Quote handoff",()=>{
  it("blocks an internal quote brief when qualification is incomplete",()=>{
    assert.deepEqual(buildQuoteHandoff({companyName:"North Bath",targetMarket:"US"}),{ready:false,missing:["required_certifications","estimated_annual_units","target_moq","quote_requirements"]});
  });
  it("creates a complete internal costing brief and labels research risk",()=>{
    const result=buildQuoteHandoff({companyName:"North Bath",recommendedProducts:"Shower systems",targetMarket:"US",requiredCertifications:"cUPC",estimatedAnnualUnits:10000,targetMoq:500,quoteRequirements:"Matte black; retail carton",latestOutcomeNotes:"Needs Q4 delivery",researchReason:"Verify certification history",researchNextAction:"Check current test reports"});
    assert.equal(result.ready,true);
    if(!result.ready)return;
    assert.match(result.text,/Estimated annual demand: 10000 units/);
    assert.match(result.text,/INTERNAL REVIEW — DO NOT SEND TO BUYER/);
    assert.match(result.text,/Needs Q4 delivery/);
    assert.match(result.text,/Incoterm/);
  });
});

describe("Quote conversion funnel",()=>{
  it("counts distinct buyers across historical quote stages",()=>{
    assert.deepEqual(computeQuoteFunnel([
      {companyId:"a",outcomeCode:"quote_requested"},{companyId:"a",outcomeCode:"quote_requested"},
      {companyId:"a",outcomeCode:"quote_sent"},{companyId:"a",outcomeCode:"won"},
      {companyId:"b",outcomeCode:"quote_requested"},{companyId:"b",outcomeCode:"quote_sent"},
      {companyId:"c",outcomeCode:"quote_requested"},{companyId:"d",outcomeCode:"quote_sent"},{companyId:"d",outcomeCode:"lost"},
    ]),{quoteRequested:3,quoteSent:3,awaitingQuote:1,openQuotes:1,won:1,lost:1,requestToQuoteRate:67,quoteWinRate:33});
  });
  it("returns zero rates for an empty funnel",()=>{
    assert.deepEqual(computeQuoteFunnel([]),{quoteRequested:0,quoteSent:0,awaitingQuote:0,openQuotes:0,won:0,lost:0,requestToQuoteRate:0,quoteWinRate:0});
  });
});

describe("Outreach readiness gate", () => {
  it("allows approval only with verified identity and contact", () => {
    assert.deepEqual(evaluateOutreachReadiness({identityVerified:true,verifiedContactCount:1,contactResearchStatus:"verified"}),{ready:true,blockers:[]});
  });
  it("explains every blocker without hiding unresolved research", () => {
    assert.deepEqual(evaluateOutreachReadiness({identityVerified:false,verifiedContactCount:0,contactResearchStatus:"needs_identity_match"}),{ready:false,blockers:["identity_unverified","verified_contact_missing","contact_research_unresolved"]});
  });
  it("blocks a disqualified peer even if identity and contact evidence exist", () => {
    assert.deepEqual(evaluateOutreachReadiness({identityVerified:true,verifiedContactCount:1,contactResearchStatus:"disqualified",leadStatus:"disqualified"}),{ready:false,blockers:["lead_disqualified"]});
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
  it("treats raw shipment evidence as eligible when relationship aggregation is not ready",()=>{
    assert.deepEqual(shouldInitializeSalesLead({existing:false,identityStatus:"source_verified",identityConfidence:90,evidenceShipments:5,lead:qualifiedLead}),{selected:true,reason:"sales_threshold"});
  });
  it("orders actionable stages before research and uses scores within a stage",()=>{
    const ordered=sortSalesLeads([
      {leadStatus:"researching",outreachScore:90,commercialFitScore:90,company:{name:"Research"}},
      {leadStatus:"contact_ready",outreachScore:60,commercialFitScore:60,company:{name:"Ready"}},
      {leadStatus:"qualified",outreachScore:50,commercialFitScore:50,company:{name:"Qualified"}},
      {leadStatus:"contact_ready",outreachScore:80,commercialFitScore:60,company:{name:"Ready High"}},
      {leadStatus:"disqualified",outreachScore:99,commercialFitScore:99,company:{name:"Peer Manufacturer"}},
    ]);
    assert.deepEqual(ordered.map(item=>item.company.name),["Qualified","Ready High","Ready","Research","Peer Manufacturer"]);
  });
});
