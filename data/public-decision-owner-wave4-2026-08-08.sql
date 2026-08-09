BEGIN;

INSERT INTO lead_contacts
  (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
VALUES
  ('contact-chadwell-john-janis','importer:your-source-products','linkedin','https://www.linkedin.com/in/john-janis-39a54212','John Janis — Vice President, Purchasing','https://www.linkedin.com/in/john-janis-39a54212','website_scrape','2026-08-08','verified','Chadwell Supply official leadership page identifies John Janis as Vice President, Purchasing. His current public profile and recent activity remain tied to Chadwell and its purchasing team. Use LinkedIn only; no email or phone inferred.','2026-08-08','2026-08-08')
ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
  label=COALESCE(lead_contacts.label,excluded.label),
  source_url=COALESCE(lead_contacts.source_url,excluded.source_url),
  verified_at=COALESCE(lead_contacts.verified_at,excluded.verified_at),
  verification_status=CASE WHEN lead_contacts.verification_status='bounced' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
  notes=CASE WHEN length(lead_contacts.notes)>=length(excluded.notes) THEN lead_contacts.notes ELSE excluded.notes END,
  updated_at=excluded.updated_at;

UPDATE lead_contact_research SET
  next_action='Review John Janis''s current public purchasing leadership evidence, then approach him on LinkedIn with a multifamily MRO faucet and shower-system supplier-fit note; retain the official Chadwell corporate form as the parallel route.',
  evidence_urls='["https://www.chadwellsupply.com/","https://www.chadwellsupply.com/contactus","https://www.chadwellsupply.com/about-us/leadership/","https://www.linkedin.com/company/chadwellsupply","https://www.linkedin.com/in/john-janis-39a54212"]',
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id='importer:your-source-products';

UPDATE lead_outreach_drafts SET
  personalization_notes='Decision-owner research added: review John Janis''s current public Vice President, Purchasing evidence before choosing the recipient. Do not infer an email or personal phone. Use a concise LinkedIn note or retain the official Chadwell corporate form as the parallel route. Lead with multifamily MRO faucets, shower systems, fill-rate reliability and compliance support.',
  updated_at=updated_at
WHERE company_id='importer:your-source-products' AND status IN ('draft','approved');

COMMIT;
