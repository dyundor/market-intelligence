BEGIN;

UPDATE importyeti_web_entities SET
  address=COALESCE(address,'90 Matawan Road, Matawan, NJ 07747'),
  website=COALESCE(website,'https://www.khov.com/'),
  admin1_code=COALESCE(admin1_code,'US-NJ'),
  admin1_name=COALESCE(admin1_name,'New Jersey'),
  city_name=COALESCE(city_name,'Matawan'),
  location_names=COALESCE(location_names,'{"zh-CN":{"admin1":"新泽西州","city":"马塔万"},"en":{"admin1":"New Jersey","city":"Matawan"}}'),
  location_precision=CASE WHEN location_precision IS NULL OR location_precision IN ('unknown','country') THEN 'address' ELSE location_precision END,
  location_source=COALESCE(location_source,'official_company_profile'),
  website_status=CASE WHEN website_status IS NULL OR website_status='not_checked' THEN 'verified' ELSE website_status END,
  website_source_url=COALESCE(website_source_url,'https://www.linkedin.com/company/k--hovnanian-homes'),
  website_verified_at=COALESCE(website_verified_at,'2026-08-08'),
  updated_at='2026-08-08'
WHERE id='importer:k-hovnanian-distribution-services';

UPDATE lead_contact_research SET
  next_action='PCBC officially identifies Kyle Laska as K. Hovnanian National Purchasing Manager. Use the verified K. Hovnanian subcontractor/business form to request Kyle Laska or the national contracts team, referencing the current shower-tray and shower-door import program; do not infer a personal email, phone or LinkedIn profile.',
  evidence_urls='["https://www.pcbc.com/pcbc2025/Public/Content.aspx?ID=2766","https://www.pcbc.com/PCBC2024/CUSTOM/Exhibits/2024/2023PCBC.KBCRegistrants.pdf","https://www.khov.com/contact-us/","https://www.linkedin.com/company/k--hovnanian-homes","https://www.importyeti.com/company/k-hovnanian-distribution-services"]',
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id='importer:k-hovnanian-distribution-services';

UPDATE lead_outreach_drafts SET
  personalization_notes='Named national-purchasing evidence added: PCBC officially identifies Kyle Laska as K. Hovnanian National Purchasing Manager, while K. Hovnanian public company data matches the importer at 90 Matawan Road. Do not invent personal contact details. Use the verified subcontractor/business form to request Kyle Laska or the national contracts team and lead with the observed shower-tray and shower-door program, compliance support and dependable OEM capacity.',
  updated_at=updated_at
WHERE company_id='importer:k-hovnanian-distribution-services' AND status IN ('draft','approved');

COMMIT;
