-- MJF's stored website incorrectly pointed to its supplier. Unknown stays empty until independently verified.
UPDATE importyeti_web_entities SET website=NULL,website_status='unknown',website_source_url=NULL,website_verified_at=NULL WHERE id='importer:mjf-group' AND website='https://www.meijiefaucet.com';
