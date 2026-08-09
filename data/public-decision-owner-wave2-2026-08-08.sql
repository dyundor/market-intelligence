BEGIN;

INSERT INTO lead_contacts
  (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
VALUES
  ('contact-bk-gustavo-garcia-de-alba','importer:b-k','linkedin','https://www.linkedin.com/in/gustavo-garcia-de-alba-ontiveros-13846a13','Gustavo Garcia de Alba Ontiveros — Director, Sourcing & Product Management','https://www.linkedin.com/in/gustavo-garcia-de-alba-ontiveros-13846a13','website_scrape','2026-08-08','verified','Current public BK Products profile cross-validated against a public organization profile identifying responsibility for sourcing, product management and valve-category development. Use LinkedIn only; no email or phone inferred.','2026-08-08','2026-08-08'),
  ('contact-bk-roshelle-hernandez','importer:b-k','linkedin','https://www.linkedin.com/in/roshellehernandez-78b6b4252','Roshelle Hernandez — Product Manager, Growth Categories','https://www.linkedin.com/in/roshellehernandez-78b6b4252','website_scrape','2026-08-08','verified','Current public BK Products profile describes ownership of Growth Categories as Product Manager. Use LinkedIn only; no email or phone inferred.','2026-08-08','2026-08-08')
ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
  label=COALESCE(lead_contacts.label,excluded.label),
  source_url=COALESCE(lead_contacts.source_url,excluded.source_url),
  verified_at=COALESCE(lead_contacts.verified_at,excluded.verified_at),
  verification_status=CASE WHEN lead_contacts.verification_status='bounced' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
  notes=CASE WHEN length(lead_contacts.notes)>=length(excluded.notes) THEN lead_contacts.notes ELSE excluded.notes END,
  updated_at=excluded.updated_at;

UPDATE lead_contact_research SET
  next_action=CASE company_id
    WHEN 'importer:b-k' THEN 'Review Gustavo Garcia de Alba Ontiveros and Roshelle Hernandez on LinkedIn, then send a concise faucet, shower-system and global-sourcing fit note to the best role; retain the official BK Products company route as backup.'
    WHEN 'importer:bath-authority' THEN 'Public organization evidence surfaces Vadym M. as DreamLine Director of Product Development, but a current direct public profile or contact route remains unresolved. Use the official DreamLine corporate route to request the current product-development owner; do not infer an email or personal phone.'
    ELSE next_action END,
  evidence_urls=CASE company_id
    WHEN 'importer:b-k' THEN '["https://www.importyeti.com/company/b-k","https://www.linkedin.com/company/bkproducts","https://www.linkedin.com/in/gustavo-garcia-de-alba-ontiveros-13846a13","https://theorg.com/org/bk-products/org-chart/gustavo-garcia-de-alba-ontiveros","https://www.linkedin.com/in/roshellehernandez-78b6b4252"]'
    WHEN 'importer:bath-authority' THEN '["https://www.importyeti.com/company/bath-authority","https://dreamline.com/pages/contact-us","https://theorg.com/org/dreamline-1","https://theorg.com/org/dreamline-1/offices/hq"]'
    ELSE evidence_urls END,
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id IN ('importer:b-k','importer:bath-authority');

UPDATE lead_outreach_drafts SET
  personalization_notes=CASE company_id
    WHEN 'importer:b-k' THEN 'Decision-owner research added: review Gustavo Garcia de Alba Ontiveros (sourcing and product management) and Roshelle Hernandez (growth-category product management) before choosing a recipient. Do not infer email addresses or personal phones. Lead with faucet, shower-system and global-sourcing fit.'
    WHEN 'importer:bath-authority' THEN 'Public organization evidence names a DreamLine product-development director, but no current direct public contact route has been verified. Do not invent a recipient or infer contact details. Use the official DreamLine route to request the current product-development owner and lead with shower-system fit.'
    ELSE personalization_notes END,
  updated_at=updated_at
WHERE company_id IN ('importer:b-k','importer:bath-authority') AND status IN ('draft','approved');

COMMIT;
