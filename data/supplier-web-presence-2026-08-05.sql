-- Only high-confidence independent sites populate website. Marketplace profiles remain separate evidence.
UPDATE importyeti_web_entities SET
  website='https://www.kkfaucet.com/', website_status='verified_successor_site',
  website_source_url='https://www.buildingclean.org/manufacturers/facility/10634', website_verified_at='2026-08-05',
  chinese_name='佛山市顺德区康康卫浴有限公司',
  marketplace_urls='[{"label":"Alibaba","url":"https://annie413.en.alibaba.com/"}]'
WHERE id='supplier:foshan-shunde-kangkang-plumbing';

UPDATE importyeti_web_entities SET
  website_status='verified_company_site', website_source_url='https://www.linkedin.com/company/ningbo-waltmal-sanitary-wares', website_verified_at='2026-08-05',
  chinese_name='宁波市沃特玛洁具有限公司',
  marketplace_urls='[{"label":"Alibaba","url":"https://waltmalchina.en.alibaba.com/"}]'
WHERE id='supplier:ningbo-waltmal-sanitary-wares';

UPDATE importyeti_web_entities SET
  website_status='marketplace_only', website_source_url='https://www.made-in-china.com/showroom/liqianzi2010', website_verified_at='2026-08-05',
  marketplace_urls='[{"label":"Made-in-China","url":"https://www.made-in-china.com/showroom/liqianzi2010"}]'
WHERE id='supplier:fufeng-hardware-manufactory';

UPDATE importyeti_web_entities SET
  website_status='marketplace_only', website_source_url='https://fr.made-in-china.com/co_kitchensink/', website_verified_at='2026-08-05',
  marketplace_urls='[{"label":"Made-in-China","url":"https://fr.made-in-china.com/co_kitchensink/"}]'
WHERE id='supplier:zhongshan-x-crafter-metal-products';

UPDATE importyeti_web_entities SET website_status='verified_company_site', website_source_url=source_url, website_verified_at='2026-08-05'
WHERE id IN ('supplier:guangdong-meijie-faucet','supplier:globe-union-industrial') AND website IS NOT NULL;
