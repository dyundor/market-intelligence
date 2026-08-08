-- MJF's stored website could not be independently verified.
-- Data preservation rule: never delete existing data; mark unverified instead.
UPDATE importyeti_web_entities SET website_status='unverified',website_source_url=source_url,website_verified_at=NULL WHERE id='importer:mjf-group' AND website='https://www.meijiefaucet.com' AND website_status<>'unverified';
