import { env } from "cloudflare:workers";
import { buildSalesExportCsv, type SalesExportRow } from "../../../../lib/leads/sales-export.ts";

export async function GET() {
  if (!env.DB) return Response.json({error:"Database unavailable"},{status:503});
  const rows = await env.DB.prepare(
    `SELECT e.name company_name,e.country,e.website,w.lead_status,
      c.contact_type,c.contact_value,c.label contact_label,c.source_url contact_source_url,
      w.outreach_strategy,w.recommended_products,w.commercial_fit_score,w.outreach_score,
      w.opportunity_value_usd,w.opportunity_probability,w.expected_close_date,
      d.channel draft_channel,d.status draft_status,d.subject draft_subject,d.body draft_body,
      d.evidence_summary,d.personalization_notes,
      r.reason research_reason,r.next_action research_next_action,
      (SELECT outcome_code FROM lead_actions a WHERE a.company_id=w.company_id AND a.outcome_code IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) last_outcome,
      (SELECT outcome FROM lead_actions a WHERE a.company_id=w.company_id AND a.outcome_code IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) last_outcome_notes,
      (SELECT qualification_feedback FROM lead_actions a WHERE a.company_id=w.company_id AND a.qualification_feedback IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) qualification_feedback,
      (SELECT feedback_reason FROM lead_actions a WHERE a.company_id=w.company_id AND a.qualification_feedback IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) feedback_reason,
      (SELECT next_action FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action,
      (SELECT next_action_due FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action_due IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action_due
     FROM buyer_watchlist w
     JOIN importyeti_web_entities e ON e.id=w.company_id
     JOIN lead_contacts c ON c.id=(SELECT best.id FROM lead_contacts best
       WHERE best.company_id=w.company_id AND best.verification_status='verified'
       ORDER BY CASE best.contact_type WHEN 'email' THEN 0 WHEN 'website_contact_page' THEN 1 WHEN 'linkedin' THEN 2 WHEN 'phone' THEN 3 ELSE 9 END,
         best.verified_at DESC,best.created_at DESC LIMIT 1)
     LEFT JOIN lead_outreach_drafts d ON d.id=(SELECT latest.id FROM lead_outreach_drafts latest
       WHERE latest.company_id=w.company_id AND latest.status<>'archived' ORDER BY latest.updated_at DESC LIMIT 1)
     LEFT JOIN lead_contact_research r ON r.company_id=w.company_id
     WHERE w.lead_status NOT IN ('new','researching','disqualified')
       AND e.identity_status='source_verified'
       AND (r.id IS NULL OR r.status='verified')
     ORDER BY COALESCE(w.outreach_score,0) DESC,e.name,c.contact_type,c.contact_value`,
  ).bind().all();
  const items: SalesExportRow[] = (rows.results||[]).map(row=>({
    companyName:String(row.company_name||""),country:String(row.country||""),website:String(row.website||""),leadStatus:String(row.lead_status||""),
    contactType:String(row.contact_type||""),contactValue:String(row.contact_value||""),contactLabel:String(row.contact_label||""),contactSourceUrl:String(row.contact_source_url||""),
    outreachStrategy:String(row.outreach_strategy||""),recommendedProducts:String(row.recommended_products||""),
    commercialFitScore:row.commercial_fit_score==null?null:Number(row.commercial_fit_score),outreachScore:row.outreach_score==null?null:Number(row.outreach_score),
    opportunityValueUsd:row.opportunity_value_usd==null?null:Number(row.opportunity_value_usd),opportunityProbability:row.opportunity_probability==null?null:Number(row.opportunity_probability),
    expectedCloseDate:String(row.expected_close_date||""),weightedValueUsd:row.opportunity_value_usd==null||row.opportunity_probability==null?null:Math.round(Number(row.opportunity_value_usd)*Number(row.opportunity_probability)/100),
    draftChannel:String(row.draft_channel||""),draftStatus:String(row.draft_status||""),draftSubject:String(row.draft_subject||""),draftBody:String(row.draft_body||""),
    evidenceSummary:String(row.evidence_summary||""),personalizationNotes:String(row.personalization_notes||""),
    researchReason:String(row.research_reason||""),researchNextAction:String(row.research_next_action||""),
    lastOutcome:String(row.last_outcome||""),lastOutcomeNotes:String(row.last_outcome_notes||""),
    qualificationFeedback:String(row.qualification_feedback||""),feedbackReason:String(row.feedback_reason||""),
    nextAction:String(row.next_action||""),nextActionDue:String(row.next_action_due||""),
  }));
  return new Response(buildSalesExportCsv(items),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="yundor-sales-ready-leads-${new Date().toISOString().slice(0,10)}.csv"`,"X-Exported-Leads":String(new Set(items.map(item=>item.companyName)).size)}});
}
