BEGIN;

INSERT INTO lead_contacts
  (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
VALUES
  ('contact-bath-depot-marc-nadeau','importer:bain-d-p-t','linkedin','https://www.linkedin.com/in/marc-nadeau-b3455645/','Marc Nadeau — President & Founder','https://www.linkedin.com/in/marc-nadeau-b3455645/','website_scrape','2026-08-08','verified','Bath Depot official current company activity identifies Marc Nadeau as President; public company and case-study evidence independently identifies him as President and Founder. Use LinkedIn only; no email or phone inferred.','2026-08-08','2026-08-08')
ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
  label=COALESCE(lead_contacts.label,excluded.label),
  source_url=COALESCE(lead_contacts.source_url,excluded.source_url),
  verified_at=COALESCE(lead_contacts.verified_at,excluded.verified_at),
  verification_status=CASE WHEN lead_contacts.verification_status='bounced' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
  notes=CASE WHEN length(lead_contacts.notes)>=length(excluded.notes) THEN lead_contacts.notes ELSE excluded.notes END,
  updated_at=excluded.updated_at;

UPDATE lead_contact_research SET
  next_action='Review Marc Nadeau''s current public President and Founder evidence, then send a concise Bath Depot private-label faucet and shower-system fit note on LinkedIn; retain the official company form as the parallel routing path.',
  evidence_urls='["https://www.bathdepot.com/","https://www.bathdepot.com/contact-us","https://www.linkedin.com/company/baindepot-bathdepot","https://www.linkedin.com/in/marc-nadeau-b3455645/","https://www.akeneo.com/wp-content/uploads/2023/07/Bath-Depot-2024.pdf"]',
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id='importer:bain-d-p-t';

UPDATE lead_outreach_drafts SET
  personalization_notes='Decision-owner research added: review Marc Nadeau''s current public President and Founder evidence before choosing the recipient. Do not infer an email or personal phone. Use a concise LinkedIn note or retain the official Bath Depot form as the parallel route. Lead with private-label faucets, shower systems and scalable product-launch support.',
  updated_at=updated_at
WHERE company_id='importer:bain-d-p-t' AND status IN ('draft','approved');

COMMIT;
