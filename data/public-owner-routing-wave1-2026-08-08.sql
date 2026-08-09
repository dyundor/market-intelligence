BEGIN;

UPDATE lead_contact_research SET
  next_action=CASE company_id
    WHEN 'importer:posey-supply' THEN 'Posey Supply officially identifies Chris Posey and Don Posey as current Co-Presidents. Use the verified business form to request routing to either Co-President for manufactured-housing faucet, shower-arm and bath-hardware sourcing; do not infer personal contact details.'
    WHEN 'importer:therma-glass' THEN 'Current public business and municipal evidence identifies Brad Roberts as Therma-Glass owner. Use info@therma-glass.com to request Brad Roberts or the current product-sourcing owner for shower bases, doors and coordinated hardware; do not infer personal contact details.'
    ELSE next_action END,
  evidence_urls=CASE company_id
    WHEN 'importer:posey-supply' THEN '["https://www.poseysupply.com/","https://www.poseysupply.com/aboutus","https://www.poseysupply.com/contact-us","https://doublespringsareachamberofcommerce.com/products/posey-supply","https://safer.fmcsa.dot.gov/query.asp?query_param=USDOT&query_string=176081&query_type=queryCarrierSnapshot&searchtype=ANY"]'
    WHEN 'importer:therma-glass' THEN '["https://www.therma-glass.com/","https://www.therma-glass.com/specifications","https://www.bbb.org/us/or/portland/profile/shower-doors/therma-glass-1296-82000145","https://www.canbyoregon.gov/sites/default/files/fileattachments/planning_commission/meeting/24308/8-22-22_pc_appvd_minutest.pdf"]'
    ELSE evidence_urls END,
  researched_at='2026-08-08',updated_at='2026-08-08'
WHERE company_id IN ('importer:posey-supply','importer:therma-glass');

UPDATE lead_outreach_drafts SET
  personalization_notes=CASE company_id
    WHEN 'importer:posey-supply' THEN 'Named owner-routing evidence added: the official company history identifies Chris Posey and Don Posey as current Co-Presidents. Do not invent personal contact details. Use the verified business form to request either Co-President and lead with manufactured-housing faucets, shower arms, bath hardware and dependable national fulfillment.'
    WHEN 'importer:therma-glass' THEN 'Named owner-routing evidence added: current public business and municipal evidence identifies Brad Roberts as Therma-Glass owner. Do not invent personal contact details. Use the verified company inbox to request Brad Roberts or the current product-sourcing owner and lead with coordinated shower bases, doors and hardware.'
    ELSE personalization_notes END,
  updated_at=updated_at
WHERE company_id IN ('importer:posey-supply','importer:therma-glass') AND status IN ('draft','approved');

COMMIT;
