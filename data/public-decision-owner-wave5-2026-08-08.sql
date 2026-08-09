BEGIN;

INSERT INTO lead_contacts
  (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
VALUES
  ('contact-giagni-vincent-giagni','importer:giagni','linkedin','https://www.linkedin.com/in/vincent-giagni-ab0255243','Vincent Giagni — CEO / Owner Decision Route','https://www.linkedin.com/in/vincent-giagni-ab0255243','website_scrape','2026-08-08','verified','New York public corporate records identify Vincent Giagni as Giagni Inc CEO at the exact Mount Vernon company address. His public professional profile identifies Giagni Enterprises, and a current 2025 bathroom-industry interview identifies him as an owner navigating fixture supply-chain and tariff decisions. Use LinkedIn only; no email or phone inferred.','2026-08-08','2026-08-08')
ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
  label=COALESCE(lead_contacts.label,excluded.label),
  source_url=COALESCE(lead_contacts.source_url,excluded.source_url),
  verified_at=COALESCE(lead_contacts.verified_at,excluded.verified_at),
  verification_status=CASE WHEN lead_contacts.verification_status='bounced' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
  notes=CASE WHEN length(lead_contacts.notes)>=length(excluded.notes) THEN lead_contacts.notes ELSE excluded.notes END,
  updated_at=excluded.updated_at;

UPDATE lead_contact_research SET
  next_action='Review Vincent Giagni''s public CEO and current bathroom-fixture owner evidence, then approach him on LinkedIn with a concise faucet OEM and tariff-resilient supply proposal; retain the official Giagni customer-service route as backup.',
  evidence_urls='["https://giagni.com/","https://giagni.com/wp-content/uploads/2018/02/CC1-Install-English-Jan-2108.pdf","https://apps.dos.ny.gov/publicInquiry/","https://www.linkedin.com/in/vincent-giagni-ab0255243","https://www.linkedin.com/pulse/tariffs-qa-vincent-giagni-sisto-martello-kohee"]',
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id='importer:giagni';

UPDATE lead_outreach_drafts SET
  personalization_notes='Decision-owner research added: review Vincent Giagni''s public CEO and current bathroom-fixture owner evidence before choosing the recipient. Do not infer an email or personal phone. Use LinkedIn or retain the official Giagni customer-service route as backup. Lead with faucet OEM capability, compliance documentation and tariff-resilient supply planning.',
  updated_at=updated_at
WHERE company_id='importer:giagni' AND status IN ('draft','approved');

COMMIT;
