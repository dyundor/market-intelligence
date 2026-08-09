BEGIN;

INSERT INTO lead_contacts
  (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
VALUES
  ('contact-danco-eric-watkins','importer:danco-inc','linkedin','https://www.linkedin.com/in/eric-watkins-product','Eric Watkins — Senior Director, Product Management','https://www.linkedin.com/in/eric-watkins-product','website_scrape','2026-08-08','verified','Current public Danco profile. Recent activity specifically recruits product-management and engineering leadership for the Danco division; independent public organization profile identifies Senior Director of Product Management. Use LinkedIn only; no email inferred.','2026-08-08','2026-08-08'),
  ('contact-danco-lindsey-morgan','importer:danco-inc','linkedin','https://www.linkedin.com/in/lindseygmorgan','Lindsey Morgan — Product Development Manager','https://www.linkedin.com/in/lindseygmorgan','website_scrape','2026-08-08','verified','Current public Danco profile describes product design and development expertise including sourcing and direct supplier collaboration. Use LinkedIn only; no email inferred.','2026-08-08','2026-08-08'),
  ('contact-westbrass-max-homami','importer:the-westbrass-company','linkedin','https://www.linkedin.com/in/max-homami-6a7b232','Max Homami — Owner / Executive Decision Route','https://www.linkedin.com/in/max-homami-6a7b232','website_scrape','2026-08-08','verified','Westbrass public company history identifies Max Homami as the owner who acquired the company; current public professional activity remains tied to Westbrass. Use LinkedIn only; no email or personal phone inferred.','2026-08-08','2026-08-08')
ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
  label=COALESCE(lead_contacts.label,excluded.label),
  source_url=COALESCE(lead_contacts.source_url,excluded.source_url),
  verified_at=COALESCE(lead_contacts.verified_at,excluded.verified_at),
  verification_status=CASE WHEN lead_contacts.verification_status='bounced' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
  notes=CASE WHEN length(lead_contacts.notes)>=length(excluded.notes) THEN lead_contacts.notes ELSE excluded.notes END,
  updated_at=excluded.updated_at;

UPDATE lead_contact_research SET
  next_action=CASE company_id
    WHEN 'importer:danco-inc' THEN 'Review the public product-leadership profiles, then approach Eric Watkins or Lindsey Morgan on LinkedIn with a concise certified showerhead and repair-component fit note; retain the official business form as the parallel company route.'
    WHEN 'importer:the-westbrass-company' THEN 'Review the public owner profile, then request supplier-fit routing from Max Homami or use the official orders inbox; focus on shower systems, coordinated finishes and certification support.'
    ELSE next_action END,
  evidence_urls=CASE company_id
    WHEN 'importer:danco-inc' THEN '["https://www.importinfo.com/danco-import","https://www.danco.com/","https://www.danco.com/support/contact-us/","https://www.linkedin.com/in/eric-watkins-product","https://www.linkedin.com/in/lindseygmorgan"]'
    WHEN 'importer:the-westbrass-company' THEN '["https://www.importinfo.com/the-westbrass-company","https://westbrass.com/","https://westbrass.com/contact-us/","https://www.linkedin.com/company/westbrass","https://www.linkedin.com/in/max-homami-6a7b232"]'
    ELSE evidence_urls END,
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id IN ('importer:danco-inc','importer:the-westbrass-company');

UPDATE lead_outreach_drafts SET
  personalization_notes=CASE company_id
    WHEN 'importer:danco-inc' THEN 'Decision-owner research added: review Eric Watkins (product management) and Lindsey Morgan (product development) public profiles before choosing a recipient. Do not infer email addresses. Use a concise LinkedIn note or retain the official business form as the parallel route. Lead with compliance-ready showerhead and repair-component support.'
    WHEN 'importer:the-westbrass-company' THEN 'Decision-owner research added: review Max Homami''s public owner profile before choosing a recipient. Do not infer an email or personal phone. Use LinkedIn for executive routing or retain the official orders inbox. Lead with shower systems, coordinated finishes and certification support.'
    ELSE personalization_notes END,
  updated_at=updated_at
WHERE company_id IN ('importer:danco-inc','importer:the-westbrass-company') AND status IN ('draft','approved');

COMMIT;
