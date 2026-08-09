"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";
import { formatCopy, getCopy, localeOptions, type Locale } from "./i18n";
import { LeadWorkbench, type WatchlistItem } from "./components/LeadWorkbench";
import { calculateHsEvidence } from "../lib/trade/hs-evidence";

type Market = "中国" | "美国" | "加拿大" | "阿联酋" | "沙特阿拉伯" | "卡塔尔" | "科威特" | "阿曼" | "巴林" | "澳大利亚" | "英国" | "德国" | "法国" | "意大利" | "西班牙" | "荷兰" | "比利时" | "日本" | "韩国";
type Product = "龙头及阀类" | "龙头阀门零件" | "塑料浴缸及淋浴盆" | "瓷制陶瓷洁具" | "其他陶瓷洁具" | "钢铁卫浴制品" | "铜制卫浴制品";
type WorkspaceView = "global-map" | "market-analysis" | "competitor-analysis" | "data-sources" | "watchlist";
type ImporterRanking = "composite" | "containers" | "weight" | "shipments" | "suppliers" | "history" | "freight";
type LocationFields={country_code:string|null;admin1_code:string|null;admin1_name:string|null;city_name:string|null;location_names:string|null;location_precision:string};
type LiveTrade = {
  source: string; access: string; period: string; requestedPeriod: string; latestReportedPeriod: string; recordCount: number; hsCode: string; tradeValue: number;
  availabilityStatus: "available" | "fallback" | "not_released" | "no_trade_record";
  netWeightKg: number; isNetWeightEstimated: boolean; fetchedAt: string;
  series: Array<{ period: string; label: string; tradeValue: number; netWeightKg: number; isEstimated: boolean }>;
  partners: Array<{ code: number; iso2: string; name: string; englishName?: string; flag: string; value: number; share: number; netWeightKg: number; isEstimated: boolean }>;
  cache: { hit: boolean; storage: "D1" | "memory"; storedAt: string; expiresAt: string; ttlSeconds: number };
};
type SupplierData = {
  available: boolean; source?: string; period?: string; evidenceType?: string; scopeNote?: string; reason?: string;
  suppliers: Array<{ traderId: number; name: string; address: string; postcode: string; commodityCodes: string[]; evidenceRecords: number }>;
};
type SupplierDiscovery={available:boolean;reason?:string;dataset?:string;hsCode?:string;requestedMonths:string[];storedShipmentCoverage?:Array<{month:string;shipments:number;products:string}>;importers?:Array<{id:string;name:string;address:string;country:string;country_code:string|null;admin1_code:string|null;admin1_name:string|null;city_name:string|null;location_names:string|null;location_precision:string;website:string|null;total_shipments:number;source_url:string;supplier_count:number;relationship_shipments:number;suppliers:string;products:string;selected_month_shipments:number;selected_month_weight_kg:number;selected_month_containers:number;selected_month_freight_usd:number;freight_covered_shipments:number}>;suppliers:Array<{id:string;name:string;address:string;country:string;country_code:string|null;admin1_code:string|null;admin1_name:string|null;city_name:string|null;location_names:string|null;location_precision:string;website:string|null;website_status:string;website_source_url:string|null;website_verified_at:string|null;chinese_name:string|null;marketplace_urls:string|null;total_shipments:number;latest_shipment_date:string;avg_teu_per_shipment:string|null;avg_teu_per_month:string|null;estimated_shipping_spend_usd:number|null;shipping_spend_coverage_percent:number|null;source_url:string;importer_count:number;relationship_shipments:number;top_importers:string;products:string;selected_month_shipments:number;selected_month_weight_kg:number;selected_month_containers:number;selected_month_freight_usd:number;freight_covered_shipments:number}>};
type RelatedEntity={id:string;name:string;entity_type:"importer"|"supplier";address:string|null;country:string|null;website:string|null;relation_status:"confirmed"|"suspected";confidence:number;source_url:string|null};
type HotProductConfidence={score:number;sampleSize:number;dataSource:string;lastUpdated:string;explanation:string;identifiedRatio:number;mixedLoadRatio:number;unclassifiedRatio:number};
type HotProductPayload={shipmentRecords:number;scope:string;products:Array<{id:string;name:string;nameEn:string;shipments:number;buyers:number;weightKg:number;latestShipmentDate:string|null;recentShipments:number;heatScore:number;topBuyers:Array<{id:string;name:string;shipments:number}>;productSearchUrl:string;imageSearchUrl:string;representativeProduct:{title:string;brand:string;productUrl:string;imageUrl:string|null;sourceName:string}|null;confidence:HotProductConfidence}>};
type ProductBuyer={id:string;name:string;shipments:number;weightKg:number;latestShipmentDate:string|null;identityStatus:string|null;identityConfidence:number|null;identityNotes:string|null;website:string|null;websiteStatus:string|null;country:string|null;leadStatus:string|null;outreachStrategy:string|null;commercialFitScore:number|null;outreachScore:number|null;recommendedProducts:string|null;hasVerifiedContact:boolean;excluded:boolean;exclusionReason:string|null};
type ProductBuyersPayload={productId:string;productName:string;productNameEn:string;totalShipments:number;totalBuyers:number;buyers:ProductBuyer[];scope:string};
type CompanyDetail={company:{id:string;entity_type:"importer"|"supplier";name:string;address:string;country:string;country_code:string|null;admin1_code:string|null;admin1_name:string|null;city_name:string|null;location_names:string|null;location_precision:string;website:string|null;website_status:string|null;website_source_url:string|null;website_verified_at:string|null;total_shipments:number|null;latest_shipment_date:string|null;avg_teu_per_shipment:string|null;avg_teu_per_month:string|null;estimated_shipping_spend_usd:number|null;shipping_spend_coverage_percent:number|null;contact_data_status:string;source_url:string;source_attribution:string;captured_at:string;source_entity_key:string|null;first_seen_at:string|null;identity_status:string|null;identity_confidence:number|null;identity_notes:string|null};relatedEntities?:RelatedEntity[];aliases?:Array<{alias_type:string;alias_value:string;confidence:number}>;relationshipRole:"upstream_suppliers"|"downstream_importers";relationships:Array<{id:string;shipment_count:number;period_start:string;period_end:string;hs_codes:string;product_descriptions:string;company_id:string;company_name:string;company_address:string;company_country:string;country_code:string|null;admin1_code:string|null;admin1_name:string|null;city_name:string|null;location_names:string|null;location_precision:string;website:string|null;total_shipments:number|null;latest_shipment_date:string|null;source_url:string;captured_bols:number;captured_weight_kg:number;captured_containers:number;captured_freight_usd:number}>;monthlyBreakdown:Array<{month:string;counterparty_id:string;counterparty_name:string;counterparty_country:string;supplier_id:string;supplier_name:string;supplier_country:string;shipments:number;weight_kg:number;containers:number;estimated_freight_usd:number;freight_covered_shipments:number;products:string}>};
type ShipmentRow={id:string;shipment_date:string;date_basis:string;actual_arrival_date:string|null;house_bol:string|null;master_bol:string|null;weight_kg:number|null;quantity:number|null;quantity_unit:string|null;container_count:number|null;product_description:string|null;estimated_freight_usd:string|null;source_url:string;supplier_id:string;supplier_name:string;supplier_country:string;importer_id:string;importer_name:string;importer_country:string};

type ScoreFactor={id:string;label:string;value:number;weight:number;contribution:number};
type ScoredResult={entityId:string;score:number;factors:ScoreFactor[];version:string;computedAt:string};
type ScoresPayload={market:ScoredResult;product:ScoredResult;buyer:ScoredResult|null;buyers?:ScoredResult[];dataset?:string;scope?:string};
type ShipmentPage={page:number;pageSize:number;total:number;totalPages:number;month:string;months:Array<{month:string;shipments:number}>;shipments:ShipmentRow[]};

const markets: Record<Market, { flag: string }> = {
  中国: { flag: "🇨🇳" }, 美国: { flag: "🇺🇸" }, 加拿大: { flag: "🇨🇦" },
  阿联酋: { flag: "🇦🇪" }, 沙特阿拉伯: { flag: "🇸🇦" }, 卡塔尔: { flag: "🇶🇦" }, 科威特: { flag: "🇰🇼" }, 阿曼: { flag: "🇴🇲" }, 巴林: { flag: "🇧🇭" },
  澳大利亚: { flag: "🇦🇺" }, 英国: { flag: "🇬🇧" }, 德国: { flag: "🇩🇪" }, 法国: { flag: "🇫🇷" },
  意大利: { flag: "🇮🇹" }, 西班牙: { flag: "🇪🇸" }, 荷兰: { flag: "🇳🇱" }, 比利时: { flag: "🇧🇪" }, 日本: { flag: "🇯🇵" }, 韩国: { flag: "🇰🇷" },
};
const products: Array<{ name: Product; hsCode: string }> = [
  { name: "龙头及阀类", hsCode: "848180" },
  { name: "龙头阀门零件", hsCode: "848190" },
  { name: "塑料浴缸及淋浴盆", hsCode: "392210" },
  { name: "瓷制陶瓷洁具", hsCode: "691010" },
  { name: "其他陶瓷洁具", hsCode: "691090" },
  { name: "钢铁卫浴制品", hsCode: "732490" },
  { name: "铜制卫浴制品", hsCode: "741820" },
];
const productNames: Record<Locale,Record<Product,string>> = {
  "zh-CN":Object.fromEntries(products.map(item=>[item.name,item.name])) as Record<Product,string>,
  en:{"龙头及阀类":"Taps, faucets and valves","龙头阀门零件":"Tap and valve parts","塑料浴缸及淋浴盆":"Plastic baths and shower trays","瓷制陶瓷洁具":"Porcelain sanitary ware","其他陶瓷洁具":"Other ceramic sanitary ware","钢铁卫浴制品":"Iron and steel sanitary ware","铜制卫浴制品":"Copper sanitary ware"},
  ar:{"龙头及阀类":"الصنابير والصمامات","龙头阀门零件":"أجزاء الصنابير والصمامات","塑料浴缸及淋浴盆":"أحواض ودُش بلاستيكية","瓷制陶瓷洁具":"أدوات صحية خزفية","其他陶瓷洁具":"أدوات صحية سيراميكية أخرى","钢铁卫浴制品":"أدوات صحية من الحديد والصلب","铜制卫浴制品":"أدوات صحية نحاسية"},
  ko:{"龙头及阀类":"수도꼭지 및 밸브","龙头阀门零件":"수도꼭지·밸브 부품","塑料浴缸及淋浴盆":"플라스틱 욕조·샤워 트레이","瓷制陶瓷洁具":"도자기 위생도기","其他陶瓷洁具":"기타 세라믹 위생도기","钢铁卫浴制品":"철강 위생용품","铜制卫浴制品":"구리 위생용품"},
  ja:{"龙头及阀类":"蛇口・バルブ類","龙头阀门零件":"蛇口・バルブ部品","塑料浴缸及淋浴盆":"プラスチック製浴槽・シャワートレー","瓷制陶瓷洁具":"磁器製衛生陶器","其他陶瓷洁具":"その他の陶磁製衛生用品","钢铁卫浴制品":"鉄鋼製衛生用品","铜制卫浴制品":"銅製衛生用品"},
  fr:{"龙头及阀类":"Robinets et vannes","龙头阀门零件":"Pièces de robinets et vannes","塑料浴缸及淋浴盆":"Baignoires et receveurs en plastique","瓷制陶瓷洁具":"Sanitaires en porcelaine","其他陶瓷洁具":"Autres sanitaires en céramique","钢铁卫浴制品":"Sanitaires en fer ou acier","铜制卫浴制品":"Sanitaires en cuivre"},
  it:{"龙头及阀类":"Rubinetti e valvole","龙头阀门零件":"Parti di rubinetti e valvole","塑料浴缸及淋浴盆":"Vasche e piatti doccia in plastica","瓷制陶瓷洁具":"Sanitari in porcellana","其他陶瓷洁具":"Altri sanitari in ceramica","钢铁卫浴制品":"Sanitari in ferro o acciaio","铜制卫浴制品":"Sanitari in rame"},
};
const mapPositions: Record<string, { x: number; y: number; region: string }> = {
  US:{x:22,y:39,region:"北美"},CA:{x:20,y:25,region:"北美"},MX:{x:20,y:50,region:"北美"},BR:{x:34,y:70,region:"南美"},AR:{x:32,y:84,region:"南美"},CL:{x:27,y:82,region:"南美"},
  GB:{x:46,y:31,region:"欧洲"},IE:{x:43,y:31,region:"欧洲"},FR:{x:48,y:38,region:"欧洲"},DE:{x:51,y:34,region:"欧洲"},NL:{x:49,y:31,region:"欧洲"},BE:{x:49,y:34,region:"欧洲"},ES:{x:46,y:43,region:"欧洲"},IT:{x:52,y:43,region:"欧洲"},CH:{x:50,y:38,region:"欧洲"},PL:{x:54,y:34,region:"欧洲"},TR:{x:59,y:45,region:"欧洲"},RU:{x:68,y:27,region:"欧洲"},
  CN:{x:77,y:46,region:"亚洲"},JP:{x:90,y:45,region:"亚洲"},KR:{x:85,y:45,region:"亚洲"},IN:{x:69,y:56,region:"亚洲"},VN:{x:80,y:59,region:"亚洲"},TH:{x:77,y:59,region:"亚洲"},MY:{x:78,y:66,region:"亚洲"},ID:{x:81,y:72,region:"亚洲"},SG:{x:78,y:67,region:"亚洲"},TW:{x:83,y:51,region:"亚洲"},HK:{x:80,y:52,region:"亚洲"},
  AE:{x:63,y:56,region:"中东"},SA:{x:61,y:59,region:"中东"},QA:{x:63,y:58,region:"中东"},KW:{x:62,y:55,region:"中东"},IL:{x:57,y:52,region:"中东"},EG:{x:56,y:55,region:"非洲"},ZA:{x:54,y:83,region:"非洲"},NG:{x:49,y:64,region:"非洲"},MA:{x:45,y:50,region:"非洲"},
  AU:{x:86,y:80,region:"大洋洲"},NZ:{x:95,y:87,region:"大洋洲"},
};
const marketIso: Record<Market,string> = { 中国:"CN",美国:"US",加拿大:"CA",阿联酋:"AE",沙特阿拉伯:"SA",卡塔尔:"QA",科威特:"KW",阿曼:"OM",巴林:"BH",澳大利亚:"AU",英国:"GB",德国:"DE",法国:"FR",意大利:"IT",西班牙:"ES",荷兰:"NL",比利时:"BE",日本:"JP",韩国:"KR" };
const entityCountryIso:Record<string,string>={China:"CN","United States":"US",Taiwan:"TW",Vietnam:"VN",Canada:"CA",Malaysia:"MY",Italy:"IT",India:"IN"};
const entityRegionKey:Record<string,"regionNorthAmerica"|"regionEurope"|"regionAsia">={US:"regionNorthAmerica",CA:"regionNorthAmerica",IT:"regionEurope",CN:"regionAsia",TW:"regionAsia",VN:"regionAsia",MY:"regionAsia",IN:"regionAsia"};
const locationCopy:Record<Locale,{countryRegion:string;companyNationality:string;unknown:string;verifiedSite:string;relatedSite:string;siteUnverified:string;siteMissing:string}>={
  "zh-CN":{countryRegion:"国家 / 地区",companyNationality:"企业国籍",unknown:"未知地区",verifiedSite:"已验证独立站 ↗",relatedSite:"企业关联官网 ↗",siteUnverified:"未确认独立站",siteMissing:"官网尚未找到"},
  en:{countryRegion:"Country / region",companyNationality:"Company nationality",unknown:"Unknown region",verifiedSite:"Verified website ↗",relatedSite:"Related official site ↗",siteUnverified:"Independent site unverified",siteMissing:"Website not found"},
  ar:{countryRegion:"الدولة / المنطقة",companyNationality:"جنسية الشركة",unknown:"منطقة غير معروفة",verifiedSite:"موقع مستقل موثّق ↗",relatedSite:"موقع رسمي مرتبط ↗",siteUnverified:"الموقع المستقل غير موثّق",siteMissing:"لم يتم العثور على موقع"},
  ko:{countryRegion:"국가 / 지역",companyNationality:"기업 국적",unknown:"지역 미상",verifiedSite:"검증된 독립 웹사이트 ↗",relatedSite:"관련 공식 웹사이트 ↗",siteUnverified:"독립 사이트 미확인",siteMissing:"웹사이트를 찾지 못함"},
  ja:{countryRegion:"国 / 地域",companyNationality:"企業の国籍",unknown:"地域不明",verifiedSite:"確認済み公式サイト ↗",relatedSite:"関連公式サイト ↗",siteUnverified:"独立サイト未確認",siteMissing:"公式サイト未発見"},
  fr:{countryRegion:"Pays / région",companyNationality:"Nationalité de l’entreprise",unknown:"Région inconnue",verifiedSite:"Site indépendant vérifié ↗",relatedSite:"Site officiel associé ↗",siteUnverified:"Site indépendant non vérifié",siteMissing:"Site introuvable"},
  it:{countryRegion:"Paese / regione",companyNationality:"Nazionalità dell’impresa",unknown:"Regione sconosciuta",verifiedSite:"Sito indipendente verificato ↗",relatedSite:"Sito ufficiale associato ↗",siteUnverified:"Sito indipendente non verificato",siteMissing:"Sito non trovato"},
};
const detailCopy:Record<Locale,{back:string;overview:string;relationships:string;shipments:string;allMonths:string;orders:string;date:string;counterparty:string;weight:string;quantity:string;containers:string;freight:string;details:string;previous:string;next:string;orderDetail:string;houseBol:string;masterBol:string;description:string;sourceNote:string;close:string}>={
  "zh-CN":{back:"返回查询结果",overview:"概览",relationships:"合作企业",shipments:"逐票订单",allMonths:"全部月份",orders:"笔订单",date:"日期",counterparty:"交易对方",weight:"重量",quantity:"数量",containers:"货柜",freight:"估算运费",details:"订单详情",previous:"上一页",next:"下一页",orderDetail:"订单详情",houseBol:"House 提单",masterBol:"Master 提单",description:"货物描述",sourceNote:"日期按来源页面展示口径；估算运费不是申报货值。",close:"关闭"},
  en:{back:"Back to results",overview:"Overview",relationships:"Relationships",shipments:"Shipments",allMonths:"All months",orders:"orders",date:"Date",counterparty:"Counterparty",weight:"Weight",quantity:"Quantity",containers:"Containers",freight:"Est. freight",details:"View details",previous:"Previous",next:"Next",orderDetail:"Shipment detail",houseBol:"House BOL",masterBol:"Master BOL",description:"Cargo description",sourceNote:"Dates follow the source page basis; estimated freight is not declared cargo value.",close:"Close"},
  ar:{back:"العودة إلى النتائج",overview:"نظرة عامة",relationships:"الشركات المرتبطة",shipments:"الشحنات",allMonths:"كل الأشهر",orders:"طلبات",date:"التاريخ",counterparty:"الطرف المقابل",weight:"الوزن",quantity:"الكمية",containers:"الحاويات",freight:"الشحن التقديري",details:"عرض التفاصيل",previous:"السابق",next:"التالي",orderDetail:"تفاصيل الشحنة",houseBol:"بوليصة فرعية",masterBol:"بوليصة رئيسية",description:"وصف البضاعة",sourceNote:"التاريخ وفق عرض المصدر؛ تكلفة الشحن التقديرية ليست قيمة البضاعة المصرح بها.",close:"إغلاق"},
  ko:{back:"검색 결과로",overview:"개요",relationships:"거래 기업",shipments:"선적 내역",allMonths:"전체 월",orders:"건",date:"날짜",counterparty:"거래 상대",weight:"중량",quantity:"수량",containers:"컨테이너",freight:"예상 운임",details:"상세 보기",previous:"이전",next:"다음",orderDetail:"선적 상세",houseBol:"House B/L",masterBol:"Master B/L",description:"화물 설명",sourceNote:"날짜는 원문 페이지 기준이며 예상 운임은 신고 화물가액이 아닙니다.",close:"닫기"},
  ja:{back:"検索結果へ戻る",overview:"概要",relationships:"取引企業",shipments:"船荷証券",allMonths:"全期間",orders:"件",date:"日付",counterparty:"取引先",weight:"重量",quantity:"数量",containers:"コンテナ",freight:"推定運賃",details:"詳細を見る",previous:"前へ",next:"次へ",orderDetail:"出荷詳細",houseBol:"House B/L",masterBol:"Master B/L",description:"貨物内容",sourceNote:"日付は出典ページの基準です。推定運賃は申告貨物価格ではありません。",close:"閉じる"},
  fr:{back:"Retour aux résultats",overview:"Aperçu",relationships:"Relations",shipments:"Expéditions",allMonths:"Tous les mois",orders:"commandes",date:"Date",counterparty:"Contrepartie",weight:"Poids",quantity:"Quantité",containers:"Conteneurs",freight:"Fret estimé",details:"Voir le détail",previous:"Précédent",next:"Suivant",orderDetail:"Détail de l’expédition",houseBol:"Connaissement House",masterBol:"Connaissement Master",description:"Description de la marchandise",sourceNote:"La date suit la convention de la source ; le fret estimé n’est pas la valeur déclarée.",close:"Fermer"},
  it:{back:"Torna ai risultati",overview:"Panoramica",relationships:"Relazioni",shipments:"Spedizioni",allMonths:"Tutti i mesi",orders:"ordini",date:"Data",counterparty:"Controparte",weight:"Peso",quantity:"Quantità",containers:"Container",freight:"Nolo stimato",details:"Vedi dettagli",previous:"Precedente",next:"Successivo",orderDetail:"Dettaglio spedizione",houseBol:"Polizza House",masterBol:"Polizza Master",description:"Descrizione merce",sourceNote:"La data segue il criterio della fonte; il nolo stimato non è il valore dichiarato della merce.",close:"Chiudi"},
};
const buyerCopy:Record<Locale,{opportunity:string;opportunityHint:string;opportunityTotal:string;opportunityEngine:string;frequency:string;frequencyHint:string;diversity:string;diversityHint:string;relevance:string;relevanceHint:string;recency:string;recencyHint:string;perMonth:string;overMonths:string;suppliers:string;countries:string;relationshipsWithHs:string;monthsAgo:string;active:string;profileQuality:string;qualityHint:string;rawSourceName:string;identityConfidence:string;firstSeen:string;dataSource:string;capturedAt:string;bolCoverage:string;bolsOf:string;supplierCountries:string;qualityPresent:string;qualityMissing:string;qualityUnverified:string;websiteVerified:string;websiteUnverified:string;address:string;country:string;exactMatch:string;normalizedMatch:string;fuzzyMatch:string;unresolved:string;sourceVerified:string;fuzzyCandidate:string;networkTitle:string;networkSuppliers:string;firstSeenShort:string;lastSeenShort:string;basedOnStored:string}>={
  "zh-CN":{opportunity:"买家交易证据",opportunityHint:"基于已落库的关系与逐票提单计算，无外部调用",opportunityTotal:"机会总分",opportunityEngine:"机会引擎买家分",frequency:"采购频率",frequencyHint:"按关系期内历史提单数估算",diversity:"供应商数量",diversityHint:"合作供应商数量与来源国分布",relevance:"HS 匹配证据",relevanceHint:"仅统计已记录 HS 编码的合作关系",recency:"最近合作",recencyHint:"距最近一次合作的时间",perMonth:"票/月",overMonths:"票 · 历时 {months} 个月",suppliers:"家供应商",countries:"个来源国",relationshipsWithHs:"{match}/{total} 家已编码关系匹配 HS {hs} · {missing} 家缺少 HS 数据",monthsAgo:"{months} 个月前",active:"仍在活跃",profileQuality:"企业档案与数据质量",qualityHint:"身份识别、数据来源与字段完整度",rawSourceName:"来源原始名称",identityConfidence:"身份识别置信度",firstSeen:"首次出现在来源",dataSource:"数据来源",capturedAt:"采集时间",bolCoverage:"逐票覆盖",bolsOf:"{captured} / {total} 票已采集",supplierCountries:"供应商来源国",qualityPresent:"已有",qualityMissing:"缺失",qualityUnverified:"未验证",websiteVerified:"官网已验证",websiteUnverified:"官网未验证",address:"地址",country:"国家",exactMatch:"精确匹配",normalizedMatch:"归一化匹配",fuzzyMatch:"模糊匹配",unresolved:"待人工确认",sourceVerified:"来源已证实",fuzzyCandidate:"疑似同名企业",networkTitle:"供应商网络",networkSuppliers:"家供应商",firstSeenShort:"首次",lastSeenShort:"最近",basedOnStored:"由已落库关系与提单计算"},
  en:{opportunity:"Buyer trade evidence",opportunityHint:"Computed from stored relationships and BOLs; no external calls",opportunityTotal:"Opportunity score",opportunityEngine:"Opportunity engine buyer score",frequency:"Purchase frequency",frequencyHint:"Estimated from historical BOLs within the relationship period",diversity:"Supplier count",diversityHint:"Supplier count and origin-country spread",relevance:"HS match evidence",relevanceHint:"Only relationships with recorded HS codes are counted",recency:"Latest relationship",recencyHint:"Time since the last recorded activity",perMonth:"BOLs/month",overMonths:"BOLs · over {months} months",suppliers:"suppliers",countries:"countries",relationshipsWithHs:"{match}/{total} coded relationships match HS {hs} · {missing} lack HS data",monthsAgo:"{months} months ago",active:"Active now",profileQuality:"Profile & data quality",qualityHint:"Identity confidence, data source and field completeness",rawSourceName:"Raw source name",identityConfidence:"Identity confidence",firstSeen:"First seen in source",dataSource:"Data source",capturedAt:"Captured at",bolCoverage:"BOL coverage",bolsOf:"{captured} / {total} BOLs captured",supplierCountries:"Supplier countries",qualityPresent:"Present",qualityMissing:"Missing",qualityUnverified:"Unverified",websiteVerified:"Website verified",websiteUnverified:"Website unverified",address:"Address",country:"Country",exactMatch:"Exact match",normalizedMatch:"Normalized match",fuzzyMatch:"Fuzzy match",unresolved:"Needs manual review",sourceVerified:"Source-verified",fuzzyCandidate:"Possible name-twin",networkTitle:"Supplier network",networkSuppliers:"suppliers",firstSeenShort:"First",lastSeenShort:"Last",basedOnStored:"Computed from stored relationships and BOLs"},
  ar:{opportunity:"لماذا يستحق هذا المشتري التواصل",opportunityHint:"محسوب من العلاقات والبوالص المخزّنة؛ دون استدعاءات خارجية",opportunityTotal:"النتيجة الإجمالية",opportunityEngine:"نتيجة محرك الفرص",frequency:"وتيرة الشراء",frequencyHint:"تقدير من البوالص التاريخية ضمن فترة العلاقة",diversity:"تنوع المورّدين",diversityHint:"عدد المورّدين وانتشار دول المنشأ",relevance:"ملاءمة المنتج",relevanceHint:"نسبة العلاقات المطابقة لرمز النظام المنسق لهذه الفئة",recency:"النشاط الأخير",recencyHint:"الوقت المنقضي منذ آخر نشاط مسجّل",perMonth:"بوليصة/شهر",overMonths:"بوليصة · خلال {months} شهر",suppliers:"مورّدين",countries:"دول",relationshipsWithHs:"{match}/{total} من العلاقات تتضمن رمز {hs} في أكوادها",monthsAgo:"منذ {months} شهر",active:"نشط حاليًا",profileQuality:"الملف وجودة البيانات",qualityHint:"ثقة الهوية ومصدر البيانات واكتمال الحقول",rawSourceName:"الاسم الأصلي في المصدر",identityConfidence:"ثقة الهوية",firstSeen:"أول ظهور في المصدر",dataSource:"مصدر البيانات",capturedAt:"وقت الجمع",bolCoverage:"تغطية البوالص",bolsOf:"{captured} / {total} بوليصة مجمّعة",supplierCountries:"دول المورّدين",qualityPresent:"موجود",qualityMissing:"مفقود",qualityUnverified:"غير موثّق",websiteVerified:"الموقع موثّق",websiteUnverified:"الموقع غير موثّق",address:"العنوان",country:"الدولة",exactMatch:"مطابقة دقيقة",normalizedMatch:"مطابقة طبيعية",fuzzyMatch:"مطابقة تقريبية",unresolved:"يحتاج مراجعة يدوية",sourceVerified:"موثّق من المصدر",fuzzyCandidate:"يحتمل تشابه اسم",networkTitle:"شبكة المورّدين",networkSuppliers:"مورّدين",firstSeenShort:"الأول",lastSeenShort:"الأخير",basedOnStored:"محسوب من العلاقات والبوالص المخزّنة"},
  ko:{opportunity:"이 구매기업에 연락할 가치가 있는 이유",opportunityHint:"저장된 관계와 B/L로 계산·외부 호출 없음",opportunityTotal:"기회 총점",opportunityEngine:"기회 엔진 구매기업 점수",frequency:"구매 빈도",frequencyHint:"관계 기간 내 과거 B/L로 추정",diversity:"공급기업 다양성",diversityHint:"협력 공급기업 수와 원산국 분포",relevance:"제품 적합도",relevanceHint:"이 품목 HS 코드와 일치하는 관계 비율",recency:"최근 활동성",recencyHint:"마지막 활동 이후 경과 시간",perMonth:"B/L/월",overMonths:"B/L · {months}개월 동안",suppliers:"개 공급기업",countries:"개국",relationshipsWithHs:"{match}/{total}개 관계의 HS 코드에 {hs} 포함",monthsAgo:"{months}개월 전",active:"활발히 활동 중",profileQuality:"기업 프로필 및 데이터 품질",qualityHint:"신원 신뢰도·데이터 출처·필드 완전성",rawSourceName:"원천 원본 이름",identityConfidence:"신원 신뢰도",firstSeen:"원천 최초 등장",dataSource:"데이터 출처",capturedAt:"수집 시점",bolCoverage:"B/L 커버리지",bolsOf:"{captured} / {total} B/L 수집됨",supplierCountries:"공급기업 원산국",qualityPresent:"있음",qualityMissing:"없음",qualityUnverified:"미검증",websiteVerified:"공식 사이트 검증됨",websiteUnverified:"공식 사이트 미검증",address:"주소",country:"국가",exactMatch:"정확 일치",normalizedMatch:"정규화 일치",fuzzyMatch:"유사 일치",unresolved:"수동 확인 필요",sourceVerified:"원천 검증됨",fuzzyCandidate:"동명기업 의심",networkTitle:"공급기업 네트워크",networkSuppliers:"개 공급기업",firstSeenShort:"처음",lastSeenShort:"최근",basedOnStored:"저장된 관계와 B/L로 계산"},
  ja:{opportunity:"この買い手に連絡する価値",opportunityHint:"保存済みの関係・B/Lから算出（外部呼び出しなし）",opportunityTotal:"機会スコア合計",opportunityEngine:"機会エンジン買い手スコア",frequency:"購買頻度",frequencyHint:"関係期間内の過去B/Lから推定",diversity:"サプライヤー多様性",diversityHint:"取引サプライヤー数と原産国の分布",relevance:"製品関連性",relevanceHint:"このカテゴリのHSコードに一致する関係の割合",recency:"直近の活動",recencyHint:"最後の活動から経過した期間",perMonth:"B/L/月",overMonths:"B/L · 期間{months}か月",suppliers:"社のサプライヤー",countries:"か国",relationshipsWithHs:"{match}/{total}社の関係にHS {hs}を含む",monthsAgo:"{months}か月前",active:"活動中",profileQuality:"企業プロフィールとデータ品質",qualityHint:"識別信頼度・データ出典・項目の完全性",rawSourceName:"出典での原語名",identityConfidence:"識別信頼度",firstSeen:"出典初出",dataSource:"データ出典",capturedAt:"収集日時",bolCoverage:"B/Lカバレッジ",bolsOf:"{captured} / {total} B/L収集済み",supplierCountries:"サプライヤー原産国",qualityPresent:"あり",qualityMissing:"なし",qualityUnverified:"未検証",websiteVerified:"公式サイト検証済み",websiteUnverified:"公式サイト未検証",address:"住所",country:"国",exactMatch:"完全一致",normalizedMatch:"正規化一致",fuzzyMatch:"類似一致",unresolved:"要手動確認",sourceVerified:"出典検証済み",fuzzyCandidate:"同名企業の疑い",networkTitle:"サプライヤーネットワーク",networkSuppliers:"社のサプライヤー",firstSeenShort:"初回",lastSeenShort:"直近",basedOnStored:"保存済みの関係とB/Lから算出"},
  fr:{opportunity:"Pourquoi contacter cet acheteur",opportunityHint:"Calculé à partir des relations et connaissements stockés ; aucun appel externe",opportunityTotal:"Score d’opportunité",opportunityEngine:"Score acheteur du moteur",frequency:"Fréquence d’achat",frequencyHint:"Estimée à partir des connaissements historiques de la période",diversity:"Diversité des fournisseurs",diversityHint:"Nombre de fournisseurs et répartition par pays d’origine",relevance:"Pertinence produit",relevanceHint:"Part des relations dont les codes SH incluent celui de cette catégorie",recency:"Activité récente",recencyHint:"Temps écoulé depuis la dernière activité enregistrée",perMonth:"connaissements/mois",overMonths:"connaissements · sur {months} mois",suppliers:"fournisseurs",countries:"pays",relationshipsWithHs:"{match}/{total} relations dont les codes incluent le SH {hs}",monthsAgo:"il y a {months} mois",active:"Actif",profileQuality:"Profil et qualité des données",qualityHint:"Confiance d’identité, source des données et complétude des champs",rawSourceName:"Nom brut de la source",identityConfidence:"Confiance d’identité",firstSeen:"Première apparition",dataSource:"Source des données",capturedAt:"Collecté le",bolCoverage:"Couverture des connaissements",bolsOf:"{captured} / {total} connaissements collectés",supplierCountries:"Pays des fournisseurs",qualityPresent:"Présent",qualityMissing:"Manquant",qualityUnverified:"Non vérifié",websiteVerified:"Site vérifié",websiteUnverified:"Site non vérifié",address:"Adresse",country:"Pays",exactMatch:"Correspondance exacte",normalizedMatch:"Correspondance normalisée",fuzzyMatch:"Correspondance approximative",unresolved:"À vérifier manuellement",sourceVerified:"Vérifié par la source",fuzzyCandidate:"Homonyme probable",networkTitle:"Réseau de fournisseurs",networkSuppliers:"fournisseurs",firstSeenShort:"Début",lastSeenShort:"Fin",basedOnStored:"Calculé à partir des relations et connaissements stockés"},
  it:{opportunity:"Perché contattare questo acquirente",opportunityHint:"Calcolato da relazioni e polizze archiviate; nessuna chiamata esterna",opportunityTotal:"Punteggio opportunità",opportunityEngine:"Punteggio acquirente del motore",frequency:"Frequenza d’acquisto",frequencyHint:"Stimata dalle polizze storiche nel periodo della relazione",diversity:"Diversità dei fornitori",diversityHint:"Numero di fornitori e distribuzione per paese d’origine",relevance:"Pertinenza prodotto",relevanceHint:"Quota di relazioni con codici SA compatibili con la categoria",recency:"Attività recente",recencyHint:"Tempo dall’ultima attività registrata",perMonth:"polizze/mese",overMonths:"polizze · su {months} mesi",suppliers:"fornitori",countries:"paesi",relationshipsWithHs:"{match}/{total} relazioni con codice SA {hs} incluso",monthsAgo:"{months} mesi fa",active:"Attivo",profileQuality:"Profilo e qualità dei dati",qualityHint:"Fiducia d’identità, fonte dati e completezza dei campi",rawSourceName:"Nome grezzo della fonte",identityConfidence:"Fiducia d’identità",firstSeen:"Prima comparsa",dataSource:"Fonte dei dati",capturedAt:"Acquisito il",bolCoverage:"Copertura polizze",bolsOf:"{captured} / {total} polizze acquisite",supplierCountries:"Paesi dei fornitori",qualityPresent:"Presente",qualityMissing:"Assente",qualityUnverified:"Non verificato",websiteVerified:"Sito verificato",websiteUnverified:"Sito non verificato",address:"Indirizzo",country:"Paese",exactMatch:"Corrispondenza esatta",normalizedMatch:"Corrispondenza normalizzata",fuzzyMatch:"Corrispondenza approssimativa",unresolved:"Da verificare manualmente",sourceVerified:"Verificato dalla fonte",fuzzyCandidate:"Possibile omonimo",networkTitle:"Rete dei fornitori",networkSuppliers:"fornitori",firstSeenShort:"Inizio",lastSeenShort:"Fine",basedOnStored:"Calcolato da relazioni e polizze archiviate"},
};
const verifiedSupplierLabel:Record<Locale,string>={"zh-CN":"全部已验证供应商","en":"All verified suppliers","ar":"جميع المورّدين الموثّقين","ko":"전체 검증 공급업체","ja":"確認済み供給者の総数","fr":"Tous les fournisseurs vérifiés","it":"Tutti i fornitori verificati"};
const tradePartyCopy:Record<Locale,{buyers:string;buyerSearch:string;buyerHint:string;suppliers:string;supplierSearch:string;supplierHint:string;buyerRanking:string;linkedSuppliers:string}>={
  "zh-CN":{buyers:"目的国买家",buyerSearch:"按目的国买家查询",buyerHint:"买家 → 来源国供货商",suppliers:"来源国供货商",supplierSearch:"按来源国供货商查询",supplierHint:"供货商 → 目的国买家",buyerRanking:"美国买家排名",linkedSuppliers:"全部已验证供货商"},
  en:{buyers:"Destination-market buyers",buyerSearch:"Search destination buyers",buyerHint:"Buyer → origin suppliers",suppliers:"Origin-country suppliers",supplierSearch:"Search origin suppliers",supplierHint:"Supplier → destination buyers",buyerRanking:"U.S. buyer ranking",linkedSuppliers:"All verified suppliers"},
  ar:{buyers:"مشترو سوق الوجهة",buyerSearch:"البحث حسب مشتري الوجهة",buyerHint:"المشتري ← مورّدو المنشأ",suppliers:"مورّدو بلد المنشأ",supplierSearch:"البحث حسب مورّد المنشأ",supplierHint:"المورّد ← مشترو الوجهة",buyerRanking:"ترتيب المشترين الأمريكيين",linkedSuppliers:"كل المورّدين الموثقين"},
  ko:{buyers:"목적국 구매기업",buyerSearch:"목적국 구매기업으로 조회",buyerHint:"구매기업 → 원산국 공급기업",suppliers:"원산국 공급기업",supplierSearch:"원산국 공급기업으로 조회",supplierHint:"공급기업 → 목적국 구매기업",buyerRanking:"미국 구매기업 순위",linkedSuppliers:"전체 검증 공급기업"},
  ja:{buyers:"仕向国の買い手企業",buyerSearch:"仕向国の買い手から検索",buyerHint:"買い手 → 原産国の供給企業",suppliers:"原産国の供給企業",supplierSearch:"原産国の供給企業から検索",supplierHint:"供給企業 → 仕向国の買い手",buyerRanking:"米国買い手ランキング",linkedSuppliers:"確認済み供給企業の総数"},
  fr:{buyers:"Acheteurs du marché de destination",buyerSearch:"Rechercher par acheteur de destination",buyerHint:"Acheteur → fournisseurs d’origine",suppliers:"Fournisseurs du pays d’origine",supplierSearch:"Rechercher par fournisseur d’origine",supplierHint:"Fournisseur → acheteurs de destination",buyerRanking:"Classement des acheteurs américains",linkedSuppliers:"Tous les fournisseurs vérifiés"},
  it:{buyers:"Acquirenti del mercato di destinazione",buyerSearch:"Cerca per acquirente di destinazione",buyerHint:"Acquirente → fornitori d’origine",suppliers:"Fornitori del paese d’origine",supplierSearch:"Cerca per fornitore d’origine",supplierHint:"Fornitore → acquirenti di destinazione",buyerRanking:"Classifica acquirenti USA",linkedSuppliers:"Tutti i fornitori verificati"},
};
const rankingCopy:Record<Locale,{rankBy:string;composite:string;containers:string;weight:string;shipments:string;suppliers:string;history:string;freight:string;score:string;partial:string;complete:string;method:string}>={
  "zh-CN":{rankBy:"排名依据",composite:"综合规模",containers:"所选月份货柜",weight:"所选月份重量",shipments:"所选月份提单",suppliers:"关联出口商数",history:"历史总提单",freight:"所选月份估算运费",score:"综合分",partial:"部分逐票指标",complete:"该月逐票指标齐全",method:"货柜 45% · 重量 30% · 提单 20% · 出口商 5%"},
  en:{rankBy:"Rank by",composite:"Composite scale",containers:"Selected containers",weight:"Selected weight",shipments:"Selected BOLs",suppliers:"Linked exporters",history:"Historical BOLs",freight:"Selected est. freight",score:"Score",partial:"Partial shipment metrics",complete:"Month metrics populated",method:"Containers 45% · weight 30% · BOLs 20% · exporters 5%"},
  ar:{rankBy:"الترتيب حسب",composite:"الحجم المركب",containers:"حاويات الأشهر المحددة",weight:"وزن الأشهر المحددة",shipments:"بوالص الأشهر المحددة",suppliers:"المصدّرون المرتبطون",history:"إجمالي البوالص التاريخية",freight:"الشحن التقديري",score:"النتيجة",partial:"مؤشرات شحن جزئية",complete:"مؤشرات الشهر معبأة",method:"الحاويات 45% · الوزن 30% · البوالص 20% · المصدّرون 5%"},
  ko:{rankBy:"순위 기준",composite:"종합 규모",containers:"선택 월 컨테이너",weight:"선택 월 중량",shipments:"선택 월 B/L",suppliers:"연결 수출기업",history:"과거 전체 B/L",freight:"선택 월 예상 운임",score:"종합 점수",partial:"일부 선적 지표",complete:"해당 월 선적 지표 보유",method:"컨테이너 45% · 중량 30% · B/L 20% · 수출기업 5%"},
  ja:{rankBy:"順位基準",composite:"総合規模",containers:"選択月のコンテナ",weight:"選択月の重量",shipments:"選択月のB/L",suppliers:"関連輸出企業",history:"過去の総B/L",freight:"選択月の推定運賃",score:"総合スコア",partial:"一部の船積み指標",complete:"当月の船積み指標あり",method:"コンテナ45% · 重量30% · B/L20% · 輸出企業5%"},
  fr:{rankBy:"Classer par",composite:"Échelle composite",containers:"Conteneurs sélectionnés",weight:"Poids sélectionné",shipments:"Connaissements sélectionnés",suppliers:"Exportateurs liés",history:"Connaissements historiques",freight:"Fret estimé sélectionné",score:"Score",partial:"Indicateurs d’expédition partiels",complete:"Indicateurs du mois renseignés",method:"Conteneurs 45 % · poids 30 % · connaissements 20 % · exportateurs 5 %"},
  it:{rankBy:"Ordina per",composite:"Scala composita",containers:"Container selezionati",weight:"Peso selezionato",shipments:"Polizze selezionate",suppliers:"Esportatori collegati",history:"Polizze storiche",freight:"Nolo stimato selezionato",score:"Punteggio",partial:"Indicatori di spedizione parziali",complete:"Indicatori mensili disponibili",method:"Container 45% · peso 30% · polizze 20% · esportatori 5%"},
};
const monthFallbackCopy:Record<Locale,{missing:string;latest:string;question:string;view:string;none:string}>={
  "zh-CN":{missing:"目前未查询到 {months} 的企业级逐票数据。",latest:"最近有数据的月份是 {month}。",question:"是否查看最近月份的数据？",view:"查看 {month} 数据",none:"当前类目尚无可切换的企业级月份数据。"},
  en:{missing:"No company-level shipment data was found for {months}.",latest:"The latest available month is {month}.",question:"View the latest available month?",view:"View {month}",none:"No company-level month is currently available for this category."},
  ar:{missing:"لم يتم العثور على بيانات شحن على مستوى الشركات للفترة {months}.",latest:"أحدث شهر متاح هو {month}.",question:"هل تريد عرض أحدث شهر متاح؟",view:"عرض {month}",none:"لا تتوفر حاليًا بيانات شهرية للشركات لهذه الفئة."},
  ko:{missing:"{months}의 기업별 선적 데이터를 찾지 못했습니다.",latest:"가장 최근 데이터는 {month}입니다.",question:"가장 최근 월 데이터를 보시겠습니까?",view:"{month} 보기",none:"이 품목에는 전환할 수 있는 기업별 월 데이터가 없습니다."},
  ja:{missing:"{months}の企業別船荷証券データは見つかりませんでした。",latest:"直近のデータ月は{month}です。",question:"直近月のデータを表示しますか？",view:"{month}を表示",none:"この品目には切り替え可能な企業別月次データがありません。"},
  fr:{missing:"Aucune donnée d’expédition au niveau des entreprises pour {months}.",latest:"Le dernier mois disponible est {month}.",question:"Afficher le dernier mois disponible ?",view:"Afficher {month}",none:"Aucun mois de données d’entreprise n’est disponible pour cette catégorie."},
  it:{missing:"Nessun dato di spedizione a livello aziendale per {months}.",latest:"L’ultimo mese disponibile è {month}.",question:"Visualizzare l’ultimo mese disponibile?",view:"Visualizza {month}",none:"Per questa categoria non sono disponibili dati aziendali mensili."},
};
const monthPickerCopy:Record<Locale,{label:string;multiple:string;title:string;hint:string;reset:string;done:string;selected:string;noneSelected:string;available:string;unavailable:string;legendAvailable:string;legendUnavailable:string;updating:string}>={
  "zh-CN":{label:"查询月份",multiple:"多选",title:"选择具体月份",hint:"点击选择，或按住后滑过多个格子",reset:"最近月份",done:"完成",selected:"已选 {count} 个月",noneSelected:"未选择月份",available:"有数据",unavailable:"无数据",legendAvailable:"企业级数据可用",legendUnavailable:"当前未查询到数据（仍可选）",updating:"正在更新所选月份…"},
  en:{label:"Months",multiple:"Multiple",title:"Select months",hint:"Tap, or press and drag across months",reset:"Latest month",done:"Done",selected:"{count} selected",noneSelected:"No month selected",available:"Data",unavailable:"No data",legendAvailable:"Company data available",legendUnavailable:"No data found (still selectable)",updating:"Updating selected months…"},
  ar:{label:"أشهر الاستعلام",multiple:"متعدد",title:"اختر الأشهر",hint:"انقر أو اضغط واسحب عبر الأشهر",reset:"أحدث شهر",done:"تم",selected:"تم اختيار {count}",noneSelected:"لم يتم اختيار شهر",available:"بيانات متاحة",unavailable:"لا بيانات",legendAvailable:"بيانات الشركات متاحة",legendUnavailable:"لم توجد بيانات (يمكن الاختيار)",updating:"جارٍ تحديث الأشهر المحددة…"},
  ko:{label:"조회 월",multiple:"다중 선택",title:"월 선택",hint:"누르거나 길게 누른 뒤 여러 월을 드래그하세요",reset:"최근 월",done:"완료",selected:"{count}개월 선택",noneSelected:"선택한 월 없음",available:"데이터 있음",unavailable:"데이터 없음",legendAvailable:"기업 데이터 사용 가능",legendUnavailable:"데이터 없음(선택 가능)",updating:"선택한 월을 업데이트하는 중…"},
  ja:{label:"検索月",multiple:"複数選択",title:"月を選択",hint:"タップ、または長押しして複数月をなぞります",reset:"直近月",done:"完了",selected:"{count}か月選択",noneSelected:"月が選択されていません",available:"データあり",unavailable:"データなし",legendAvailable:"企業データあり",legendUnavailable:"データ未取得（選択可能）",updating:"選択した月を更新中…"},
  fr:{label:"Mois recherchés",multiple:"Multiple",title:"Sélectionner les mois",hint:"Touchez, ou maintenez puis faites glisser",reset:"Dernier mois",done:"Terminé",selected:"{count} sélectionnés",noneSelected:"Aucun mois sélectionné",available:"Données",unavailable:"Sans données",legendAvailable:"Données d’entreprise disponibles",legendUnavailable:"Aucune donnée trouvée (sélection possible)",updating:"Mise à jour des mois sélectionnés…"},
  it:{label:"Mesi di ricerca",multiple:"Multipla",title:"Seleziona i mesi",hint:"Tocca oppure tieni premuto e trascina",reset:"Ultimo mese",done:"Fine",selected:"{count} selezionati",noneSelected:"Nessun mese selezionato",available:"Dati",unavailable:"Nessun dato",legendAvailable:"Dati aziendali disponibili",legendUnavailable:"Nessun dato trovato (selezionabile)",updating:"Aggiornamento dei mesi selezionati…"},
};
const coverageCopy:Record<Locale,{complete:string;partial:string;uncollected:string;noRecords:string;failed:string;legendPartial:string;legendUncollected:string;uncollectedMessage:string}>={
  "zh-CN":{complete:"完整",partial:"部分",uncollected:"未采集",noRecords:"确认无记录",failed:"采集故障",legendPartial:"已有部分真实数据",legendUncollected:"尚未采集（仍可选）",uncollectedMessage:"{months} 尚未完成企业级逐票采集。"},
  en:{complete:"Complete",partial:"Partial",uncollected:"Not collected",noRecords:"Confirmed none",failed:"Collection failed",legendPartial:"Partial verified data",legendUncollected:"Not collected yet (selectable)",uncollectedMessage:"Company-level shipments for {months} have not been collected yet."},
  ar:{complete:"مكتمل",partial:"جزئي",uncollected:"غير مجمّع",noRecords:"تأكد عدم وجود سجلات",failed:"فشل الجمع",legendPartial:"بيانات موثقة جزئيًا",legendUncollected:"لم تُجمع بعد (قابلة للاختيار)",uncollectedMessage:"لم يكتمل جمع شحنات الشركات للفترة {months}."},
  ko:{complete:"완료",partial:"일부",uncollected:"미수집",noRecords:"기록 없음 확인",failed:"수집 실패",legendPartial:"일부 검증 데이터",legendUncollected:"아직 미수집(선택 가능)",uncollectedMessage:"{months}의 기업별 선적 수집이 아직 완료되지 않았습니다."},
  ja:{complete:"完了",partial:"一部",uncollected:"未収集",noRecords:"記録なし確認済み",failed:"収集エラー",legendPartial:"一部の検証済みデータ",legendUncollected:"未収集（選択可能）",uncollectedMessage:"{months}の企業別船荷証券はまだ収集が完了していません。"},
  fr:{complete:"Complet",partial:"Partiel",uncollected:"Non collecté",noRecords:"Absence confirmée",failed:"Échec de collecte",legendPartial:"Données vérifiées partielles",legendUncollected:"Pas encore collecté (sélection possible)",uncollectedMessage:"La collecte des expéditions d’entreprise pour {months} n’est pas terminée."},
  it:{complete:"Completo",partial:"Parziale",uncollected:"Non raccolto",noRecords:"Nessun record confermato",failed:"Raccolta non riuscita",legendPartial:"Dati verificati parziali",legendUncollected:"Non ancora raccolto (selezionabile)",uncollectedMessage:"La raccolta delle spedizioni aziendali per {months} non è ancora completa."},
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

function ShipmentPanel({companyType,locale,page,loading,pageNumber,month,selected,onMonth,onPage,onSelect,onClose}:{companyType:"importer"|"supplier";locale:Locale;page:ShipmentPage|null;loading:boolean;pageNumber:number;month:string;selected:ShipmentRow|null;onMonth:(value:string)=>void;onPage:(value:number)=>void;onSelect:(row:ShipmentRow)=>void;onClose:()=>void}){
  const copy=detailCopy[locale];
  const counterparty=(row:ShipmentRow)=>companyType==="supplier"?row.importer_name:row.supplier_name;
  const counterpartyCountry=(row:ShipmentRow)=>companyType==="supplier"?row.importer_country:row.supplier_country;
  return <div className="company-shipment-panel">
    <div className="shipment-toolbar"><div><strong>{page?.total||0} {copy.orders}</strong><small>{copy.sourceNote}</small></div><select value={month} onChange={event=>onMonth(event.target.value)}><option value="">{copy.allMonths}</option>{page?.months.map(item=><option key={item.month} value={item.month}>{item.month} · {item.shipments}</option>)}</select></div>
    {loading?<div className="supplier-status"><span className="query-spinner" /></div>:<div className="shipment-table"><div className="shipment-row shipment-head"><span>{copy.date}</span><span>{copy.counterparty}</span><span>{copy.weight}</span><span>{copy.quantity}</span><span>{copy.containers}</span><span>{copy.freight}</span><span /></div>{page?.shipments.map(item=><button className="shipment-row" key={item.id} onClick={()=>onSelect(item)}><span><b>{item.shipment_date}</b><small>{item.house_bol||"—"}</small></span><span><b>{counterparty(item)}</b><small>{counterpartyCountry(item)}</small></span><span>{item.weight_kg?`${Number(item.weight_kg).toLocaleString(locale)} kg`:"—"}</span><span>{item.quantity?`${Number(item.quantity).toLocaleString(locale)} ${item.quantity_unit||""}`:"—"}</span><span>{item.container_count||"—"}</span><span>{item.estimated_freight_usd?money(Number(item.estimated_freight_usd)):"—"}</span><i>›</i></button>)}</div>}
    <div className="shipment-pagination"><button disabled={pageNumber<=1} onClick={()=>onPage(pageNumber-1)}>{copy.previous}</button><span>{pageNumber} / {page?.totalPages||1}</span><button disabled={pageNumber>=(page?.totalPages||1)} onClick={()=>onPage(pageNumber+1)}>{copy.next}</button></div>
    {selected?<div className="shipment-drawer" role="dialog" aria-modal="true"><button className="drawer-close" aria-label={copy.close} onClick={onClose}>×</button><span>{copy.orderDetail}</span><h3>{selected.house_bol||selected.id}</h3><div><small>{copy.date}</small><b>{selected.shipment_date}</b></div><div><small>{copy.houseBol}</small><b>{selected.house_bol||"—"}</b></div><div><small>{copy.masterBol}</small><b>{selected.master_bol||"—"}</b></div><div><small>{copy.counterparty}</small><b>{counterparty(selected)}</b></div><div><small>{copy.weight}</small><b>{selected.weight_kg?`${Number(selected.weight_kg).toLocaleString(locale)} kg`:"—"}</b></div><div><small>{copy.quantity}</small><b>{selected.quantity?`${Number(selected.quantity).toLocaleString(locale)} ${selected.quantity_unit||""}`:"—"}</b></div><div><small>{copy.containers}</small><b>{selected.container_count||"—"}</b></div><div><small>{copy.freight}</small><b>{selected.estimated_freight_usd?money(Number(selected.estimated_freight_usd)):"—"}</b></div><p><small>{copy.description}</small>{selected.product_description||"—"}</p><a href={selected.source_url} target="_blank" rel="noreferrer">ImportYeti ↗</a></div>:null}
  </div>;
}

function MonthPicker({locale,open,onOpen,months,selected,onChange,coverage,latest}:{locale:Locale;open:boolean;onOpen:(value:boolean)=>void;months:string[];selected:string[];onChange:(value:string[])=>void;coverage:Array<{month:string;shipments:number;status?:string}>;latest:string}){
  const copy=monthPickerCopy[locale];
  const coverageByMonth=new Map(coverage.map(item=>[item.month,item]));
  const [draft,setDraft]=useState(selected);
  const draftRef=useRef(selected);
  const dragMode=useRef<"select"|"deselect">("select");
  const dragAnchor=useRef(-1);
  const dragBase=useRef<string[]>([]);
  const dragged=useRef(false);
  useEffect(()=>{setDraft(selected);draftRef.current=selected},[selected]);
  const updateDraft=(month:string,mode:"select"|"deselect")=>{
    const next=new Set(draftRef.current);
    if(mode==="select")next.add(month);else next.delete(month);
    const value=[...next].sort((a,b)=>b.localeCompare(a));
    draftRef.current=value;setDraft(value);
  };
  const bindDrag=useDrag(({first,last,tap,xy:[x,y],initial:[originX,originY],movement:[mx,my]})=>{
    if(first){
      dragged.current=false;dragBase.current=[...draftRef.current];
      const origin=document.elementFromPoint(originX,originY)?.closest<HTMLElement>("[data-month]")?.dataset.month;
      dragAnchor.current=origin?months.indexOf(origin):-1;
      dragMode.current=origin&&draftRef.current.includes(origin)?"deselect":"select";
    }
    if(!tap&&Math.hypot(mx,my)>=4){
      dragged.current=true;
      const month=document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-month]")?.dataset.month;
      const current=month?months.indexOf(month):-1;
      if(dragAnchor.current>=0&&current>=0){
        const from=Math.min(dragAnchor.current,current);const to=Math.max(dragAnchor.current,current);
        const range=months.slice(from,to+1);const next=new Set(dragBase.current);
        range.forEach(value=>dragMode.current==="select"?next.add(value):next.delete(value));
        const value=[...next].sort((a,b)=>b.localeCompare(a));draftRef.current=value;setDraft(value);
      }
    }
    if(last){
      const completedDrag=dragged.current;
      if(completedDrag)onChange(draftRef.current);
      dragAnchor.current=-1;dragBase.current=[];dragMode.current="select";
      if(completedDrag)window.setTimeout(()=>{dragged.current=false},0);else dragged.current=false;
    }
  },{filterTaps:true,threshold:4,preventScroll:true});
  const toggle=(month:string)=>{
    if(dragged.current)return;
    const mode=draftRef.current.includes(month)?"deselect":"select";
    updateDraft(month,mode);onChange(draftRef.current);
  };
  const label=selected.length===0?copy.noneSelected:selected.length===1?selected[0]:`${selected.at(-1)} – ${selected[0]} · ${selected.length}`;
  return <div className="field time period-field month-multiselect"><label>{copy.label}</label><button type="button" className={open?"month-trigger open":"month-trigger"} onClick={()=>onOpen(!open)} aria-expanded={open}><span>◫</span><strong>{label}</strong><em>{copy.multiple}</em><i>⌄</i></button>{open?<div className="month-popover"><div className="month-popover-head"><div><strong>{copy.title}</strong><small>{copy.hint}</small></div><button type="button" onClick={()=>onChange([latest||months[0]])}>{copy.reset}</button></div><div className="month-data-legend"><span className="partial">◐ {coverageCopy[locale].legendPartial}</span><span className="uncollected">○ {coverageCopy[locale].legendUncollected}</span></div><div className="month-grid" {...bindDrag()}>{months.map(month=>{const evidence=coverageByMonth.get(month);const status=evidence?.status||"uncollected";const statusLabel=status==="complete"?coverageCopy[locale].complete:status==="partial"||status==="in_progress"?coverageCopy[locale].partial:status==="no_records"?coverageCopy[locale].noRecords:status==="failed"?coverageCopy[locale].failed:coverageCopy[locale].uncollected;const isSelected=draft.includes(month);return <button type="button" key={month} data-month={month} data-status={status} className={`${isSelected?"selected ":""}coverage-${status}`} aria-pressed={isSelected} aria-label={`${month} · ${statusLabel}`} onClick={()=>toggle(month)}><span>{Number(month.slice(5))}</span><small>{month.slice(0,4)}</small><em>{statusLabel}</em>{isSelected?<i>✓</i>:null}</button>})}</div><div className="month-popover-foot"><span>{formatCopy(copy.selected,{count:selected.length})}</span><button type="button" onClick={()=>onOpen(false)}>{copy.done}</button></div></div>:null}</div>;
}

const money = (value: number) => value >= 1_000_000_000
  ? `$${(value / 1_000_000_000).toFixed(2)}B`
  : value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : `$${value.toLocaleString("en-US")}`;
const countryColors = ["#0d6d5d","#2f7f9d","#7358a6","#b45e72","#bd7138","#7b8838","#297f78","#496fb0","#8a5f96","#a65353","#347c55","#936d2f","#4e7690","#6f6fa5","#9c596e","#477a70","#785d9d"];
const countryColor = (code: number) => countryColors[Math.abs(code) % countryColors.length];
const monthIndex = (ym: string) => { const p = ym.split("-"); return Number(p[0]) * 12 + (Number(p[1] || 1) - 1); };
const monthSpan = (start: string, end: string) => { const s = start || end; const e = end || start; return s && e ? Math.max(1, monthIndex(e) - monthIndex(s) + 1) : 1; };
const identityTier = (confidence: number | null) => { if (confidence === null) return 0; if (confidence >= 95) return 4; if (confidence >= 80) return 3; if (confidence >= 60) return 2; return 1; };
const identityNoteReason = (notes: string | null) => { if (!notes) return null; try { const parsed = JSON.parse(notes); if (typeof parsed === "string") return parsed; return parsed.reason || parsed.pairs || null; } catch { return notes; } };

type Partner = LiveTrade["partners"][number];
function buildTreemap(items: Partner[], x = 0, y = 0, width = 100, height = 100): Array<{ partner: Partner; x: number; y: number; width: number; height: number }> {
  if (!items.length) return [];
  if (items.length === 1) return [{ partner: items[0], x, y, width, height }];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let running = 0; let split = 1;
  for (; split < items.length; split += 1) { running += items[split - 1].value; if (running >= total / 2) break; }
  const first = items.slice(0, split); const second = items.slice(split);
  const firstTotal = first.reduce((sum, item) => sum + item.value, 0); const ratio = total ? firstTotal / total : .5;
  return width >= height
    ? [...buildTreemap(first, x, y, width * ratio, height), ...buildTreemap(second, x + width * ratio, y, width * (1 - ratio), height)]
    : [...buildTreemap(first, x, y, width, height * ratio), ...buildTreemap(second, x, y + height * ratio, width, height * (1 - ratio))];
}

function HotProductList({locale,onBuyer,onProductClick}:{locale:Locale;onBuyer:(id:string)=>void;onProductClick?:(productId:string)=>void}){
  const [data,setData]=useState<HotProductPayload|null>(null);
  const [expandedConfidence,setExpandedConfidence]=useState<string|null>(null);
  useEffect(()=>{const controller=new AbortController();fetch("/api/hot-products",{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(setData).catch(()=>{});return()=>controller.abort();},[]);
  if(!data?.products.length)return null;
  const dataSourceLabel=(source:string)=>source==="stored_us_ocean_import_shipments"?(locale==="zh-CN"?"已存美国海运进口记录":"stored US ocean import records"):source;
  return <section className="hot-product-list">
    <div className="section-step"><span>HOT</span><div><strong>{locale==="zh-CN"?"热卖产品榜":"Hot-selling product list"}</strong><small>{locale==="zh-CN"?`基于 ${data.shipmentRecords} 条已存美国海运提单；按近期交易、买家覆盖和重量综合排序`:`Based on ${data.shipmentRecords} stored U.S. ocean-import records; ranked by recent activity, buyer coverage and weight`}</small></div></div>
    <div>{data.products.slice(0,8).map((product,index)=><React.Fragment key={product.id}>
      <article>
        <b>{String(index+1).padStart(2,"0")}</b>
        <span className="hot-product-main">{product.representativeProduct?.imageUrl?<a className="hot-product-image" href={product.representativeProduct.productUrl} target="_blank" rel="noreferrer"><img src={product.representativeProduct.imageUrl} alt={product.representativeProduct.title}/></a>:<span className="hot-product-image placeholder">{product.name.slice(0,1)}</span>}<span><strong><button type="button" onClick={()=>onProductClick?.(product.id)}>{locale==="zh-CN"?product.name:product.nameEn}</button></strong><small className="hot-product-buyers">{product.topBuyers.slice(0,3).map(buyer=><button key={buyer.id} onClick={()=>onBuyer(buyer.id)}>{buyer.name} ({buyer.shipments})</button>)}</small>{product.representativeProduct?<a className="representative-product" href={product.representativeProduct.productUrl} target="_blank" rel="noreferrer"><b>{locale==="zh-CN"?"代表产品":"Representative"}</b> {product.representativeProduct.brand} · {product.representativeProduct.title} ↗</a>:null}<nav><a href={product.productSearchUrl} target="_blank" rel="noreferrer">{locale==="zh-CN"?"更多产品 ↗":"More products ↗"}</a><a href={product.imageSearchUrl} target="_blank" rel="noreferrer">{locale==="zh-CN"?"更多图片 ↗":"More images ↗"}</a></nav></span></span>
        <em><strong>{product.heatScore}</strong><small>{locale==="zh-CN"?"相对热度":"relative heat"}</small></em>
        <span><strong>{product.recentShipments}</strong><small>{locale==="zh-CN"?"近12月提单":"12m BOLs"}</small></span>
        <span><strong>{product.buyers}</strong><small>{locale==="zh-CN"?"买家":"buyers"}</small></span>
        <span><strong>{product.latestShipmentDate||"—"}</strong><small>{locale==="zh-CN"?"最近交易":"latest"}</small></span>
        <button className={`confidence-badge${(!product.confidence||product.confidence.sampleSize<30)?' confidence-low':''}`} onClick={()=>setExpandedConfidence(v=>v===product.id?null:product.id)} aria-expanded={expandedConfidence===product.id}>{expandedConfidence===product.id?<strong>▲</strong>:<><strong>{product.confidence?.score!=null?product.confidence.score:"—"}/100</strong><small>{locale==="zh-CN"?"置信度":"Confidence"}</small></>}</button>
      </article>
      {expandedConfidence===product.id&&<button className={`confidence-row${product.confidence&&product.confidence.sampleSize<30?' confidence-low':''}`} onClick={()=>setExpandedConfidence(null)}>
        <span className="confidence-score"><strong>{locale==="zh-CN"?"置信度评分":"Confidence score"}: {product.confidence?.score!=null?product.confidence.score:"—"}/100</strong></span>
        <span>{locale==="zh-CN"?`基于 ${product.confidence?.sampleSize?.toLocaleString()||"0"} 条货运记录`:`Based on ${product.confidence?.sampleSize?.toLocaleString()||"0"} shipment records`}</span>
        <span>{locale==="zh-CN"?`数据来源: ${dataSourceLabel(product.confidence?.dataSource||"")}`:`Source: ${dataSourceLabel(product.confidence?.dataSource||"")}`}</span>
        <span>{locale==="zh-CN"?`最后更新: ${product.confidence?.lastUpdated||((!product.confidence||!product.confidence.sampleSize)?(locale==="zh-CN"?"无近期数据":"No recent data"):"N/A")}`:`Last updated: ${product.confidence?.lastUpdated||((!product.confidence||!product.confidence.sampleSize)?(locale==="zh-CN"?"无近期数据":"No recent data"):"N/A")}`}</span>
        {product.confidence&&product.confidence.sampleSize<30&&<span className="limited-sample">{locale==="zh-CN"?"⚠ 样本量有限 — 解读需谨慎":"⚠ Limited sample — interpret with caution"}</span>}
        <span className="confidence-explanation">{product.confidence?.explanation||""}</span>
      </button>}
    </React.Fragment>)}</div>
    <p>{locale==="zh-CN"?"混装提单可能同时计入多个产品；搜索链接用于产品调研，原始提单仍是销量证据。":"Mixed-product BOLs may support multiple products; search links support research while raw shipment records remain the sales evidence."}</p>
  </section>;
}

function ProductBuyersPanel({productId,locale,onBuyer,onClose}:{productId:string;locale:Locale;onBuyer:(id:string)=>void;onClose:()=>void}){
  const [data,setData]=useState<ProductBuyersPayload|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{const controller=new AbortController();setLoading(true);fetch(`/api/hot-products/buyers?product_id=${encodeURIComponent(productId)}`,{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(setData).catch(()=>{}).finally(()=>setLoading(false));return()=>controller.abort();},[productId]);
  const qualifiedBuyers=(data?.buyers||[]).filter(b=>!b.excluded);
  const excludedBuyers=(data?.buyers||[]).filter(b=>b.excluded);
  const statusLabel:Record<string,string>={source_verified:locale==="zh-CN"?"已核实":"Verified",ambiguous:locale==="zh-CN"?"身份模糊":"Ambiguous",fuzzy_candidate:locale==="zh-CN"?"同名待确认":"Name collision",unresolved:locale==="zh-CN"?"待确认":"Unresolved",confirmed_manufacturer:locale==="zh-CN"?"同行制造商":"Manufacturer",likely_manufacturer:locale==="zh-CN"?"疑似制造商":"Likely mfr",defunct:locale==="zh-CN"?"已停业":"Defunct",acquired:locale==="zh-CN"?"已收购":"Acquired"};
  const leadStatusLabel:Record<string,string>={new:locale==="zh-CN"?"新":"New",researching:locale==="zh-CN"?"调研中":"Researching",contact_ready:locale==="zh-CN"?"可联系":"Contact ready",contacted:locale==="zh-CN"?"已联系":"Contacted",follow_up:locale==="zh-CN"?"跟进中":"Follow-up",qualified:locale==="zh-CN"?"合格":"Qualified",opportunity:locale==="zh-CN"?"商机":"Opportunity",disqualified:locale==="zh-CN"?"淘汰":"Disqualified"};
  return <div className="product-buyers-panel"><div className="product-buyers-header"><h2>{data?locale==="zh-CN"?data.productName:data.productNameEn:""}<small>{data?`${data.totalShipments}${locale==="zh-CN"?"票提单 · ":" BOLs · "}${data.totalBuyers}${locale==="zh-CN"?"家买家":" buyers"}`:""}</small></h2><button onClick={onClose}>×</button></div>
  {loading?<div className="supplier-status"><span className="query-spinner"/></div>:
  data?<div className="product-buyers-list">
    {qualifiedBuyers.length>0&&<section><h3>{locale==="zh-CN"?"可开发买家":"Qualified buyers"} ({qualifiedBuyers.length})</h3>
    {qualifiedBuyers.map(buyer=><article key={buyer.id} className={buyer.hasVerifiedContact?"contact-ready":""}><span><button onClick={()=>onBuyer(buyer.id)}><b>{buyer.name}</b></button><p>{buyer.country||""}</p><small>{buyer.shipments}{locale==="zh-CN"?"票提单":" BOLs"} · {buyer.latestShipmentDate||"—"}</small></span><span className="buyer-tags">{buyer.identityStatus&&statusLabel[buyer.identityStatus]?<em className="tag identity">{statusLabel[buyer.identityStatus]}</em>:null}{buyer.leadStatus&&leadStatusLabel[buyer.leadStatus]?<em className="tag lead">{leadStatusLabel[buyer.leadStatus]}</em>:null}{buyer.hasVerifiedContact?<em className="tag contact">{locale==="zh-CN"?"有联系方式":"Has contact"}</em>:null}{buyer.commercialFitScore&&buyer.commercialFitScore>=35?<em className="tag fit">{locale==="zh-CN"?"商业匹配":"Fit"} {buyer.commercialFitScore}</em>:null}</span></article>)}</section>}
    {excludedBuyers.length>0&&<section className="excluded-section"><h3>{locale==="zh-CN"?"暂不宜开发":"Not recommended"} ({excludedBuyers.length})</h3>
    {excludedBuyers.map(buyer=><article key={buyer.id} className="excluded"><span><button onClick={()=>onBuyer(buyer.id)}><b>{buyer.name}</b></button><p>{buyer.exclusionReason}</p><small>{buyer.shipments}{locale==="zh-CN"?"票提单":" BOLs"}</small></span></article>)}</section>}
    {!data.buyers.length&&<p>{locale==="zh-CN"?"暂无已识别的买家":"No buyers identified."}</p>}
    <p className="product-buyers-note">{locale==="zh-CN"?"排序：可靠身份 + 可联系方式 + 商业匹配在前，不宜开发者在后。仅展示当前已存提单中的交易记录。":"Sorted: verified identity + contactable + commercial fit first. Excluded entities listed separately. Based on stored shipment records only."}</p>
  </div>:<p>{locale==="zh-CN"?"加载失败":"Failed to load"}</p>}
  </div>;
}

function RelatedEntityPopover({entities,locale,onSelect}:{entities:RelatedEntity[];locale:Locale;onSelect:(id:string)=>void}){
  const [open,setOpen]=useState(false);
  if(!entities.length)return null;
  return <div className="related-entity-popover"><button onClick={()=>setOpen(value=>!value)}>◎ {locale==="zh-CN"?`关联企业 ${entities.length}`:`Related ${entities.length}`}</button>{open?<div className="related-entity-bubble"><strong>{locale==="zh-CN"?"关联企业":"Related entities"}</strong><small>{locale==="zh-CN"?"依据公开经营主体与地址证据判断":"Based on public operating-entity and address evidence"}</small>{entities.map(entity=><button key={entity.id} onClick={()=>onSelect(entity.id)}><span><b>{entity.name}</b><small>{entity.address||entity.country||"—"}</small></span><em className={entity.relation_status}>{entity.relation_status==="confirmed"?(locale==="zh-CN"?"已确认":"Confirmed"):(locale==="zh-CN"?"疑似关联":"Suspected")} · {entity.confidence}%</em></button>)}</div>:null}</div>;
}

export default function Home() {
  const latestClosedMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const latestClosedMonth = `${latestClosedMonthDate.getFullYear()}-${String(latestClosedMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const [market, setMarket] = useState<Market>("美国");
  const [product, setProduct] = useState<Product>("龙头及阀类");
  const selectedProduct = products.find(item => item.name === product) || products[0];
  const [flow, setFlow] = useState<"进口" | "出口">("进口");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([latestClosedMonth]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [trade, setTrade] = useState<LiveTrade | null>(null);
  const [state, setState] = useState<"loading" | "live" | "unavailable">("loading");
  const [supplierData, setSupplierData] = useState<SupplierData | null>(null);
  const [supplierState, setSupplierState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [competitorSearch, setCompetitorSearch] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<number[]>([]);
  const [activeMapPartner, setActiveMapPartner] = useState<number | null>(null);
  const [hoveredMapPartner, setHoveredMapPartner] = useState<{ partner: Partner; x: number; y: number } | null>(null);
  const [distributionView, setDistributionView] = useState<"network" | "treemap" | "sankey">("network");
  const [countryNameLanguage, setCountryNameLanguage] = useState<Locale>("zh-CN");
  const [activeView, setActiveView] = useState<WorkspaceView>("competitor-analysis");
  const [discovery,setDiscovery]=useState<SupplierDiscovery|null>(null);
  const [discoveryState,setDiscoveryState]=useState<"loading"|"ready"|"unavailable">("loading");
  const [selectedImporterId,setSelectedImporterId]=useState<string|null>(null);
  const [companyDetail,setCompanyDetail]=useState<CompanyDetail|null>(null);
  const [companyDetailLoading,setCompanyDetailLoading]=useState(false);
  const [companyDetailTab,setCompanyDetailTab]=useState<"relationships"|"shipments">("relationships");
  const [shipmentPage,setShipmentPage]=useState<ShipmentPage|null>(null);
  const [shipmentPageNumber,setShipmentPageNumber]=useState(1);
  const [shipmentMonth,setShipmentMonth]=useState("");
  const [shipmentLoading,setShipmentLoading]=useState(false);
  const [selectedShipment,setSelectedShipment]=useState<ShipmentRow|null>(null);
  const discoveryScrollPosition=useRef(0);
  const defaultMonthContext=useRef("");
  const [importerRanking,setImporterRanking]=useState<ImporterRanking>("composite");
  const [buyerFilters,setBuyerFilters]=useState<{levelA:boolean;levelB:boolean;levelC:boolean;minShipments:number}>({levelA:true,levelB:true,levelC:true,minShipments:0});
  const [discoveryMode,setDiscoveryMode]=useState<"importer"|"exporter">("importer");
  const [scores,setScores]=useState<ScoresPayload|null>(null);
  const [scoresState,setScoresState]=useState<"idle"|"loading"|"ready"|"unavailable">("idle");
  const [watchlist,setWatchlist]=useState<WatchlistItem[]>([]);
  const [watchlistState,setWatchlistState]=useState<"idle"|"loading"|"ready">("idle");
  const [productBuyersProductId,setProductBuyersProductId]=useState<string|null>(null);
  const watchlistStatusLabel:Record<string,string>={new:countryNameLanguage==="zh-CN"?"新发现":"New",researching:countryNameLanguage==="zh-CN"?"调研中":"Researching",contacted:countryNameLanguage==="zh-CN"?"已联系":"Contacted",quoted:countryNameLanguage==="zh-CN"?"已报价":"Quoted",customer:countryNameLanguage==="zh-CN"?"已成客户":"Customer"};
  const monthOptions = useMemo(() => Array.from({ length: 36 }, (_, index) => {
    const date = new Date(latestClosedMonthDate.getFullYear(), latestClosedMonthDate.getMonth() - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }), [latestClosedMonth]);
  const copy = useMemo(() => getCopy(countryNameLanguage), [countryNameLanguage]);
  const tr = (key:keyof typeof copy, vars:Record<string,string|number>={}) => formatCopy(copy[key],vars);
  const regionDisplayNames = useMemo(() => new Intl.DisplayNames([countryNameLanguage], { type:"region" }), [countryNameLanguage]);
  const partnerLabel = (partner: Partner) => {
    if (partner.iso2) return regionDisplayNames.of(partner.iso2) || partner.name;
    const specialNames: Record<Locale,Record<string,string>> = {
      "zh-CN":{"Other Asia, nes":"亚洲其他地区","Free Zones":"自由区","Bunkers":"船舶及航空器燃料补给","Areas, nes":"其他未列明地区"},
      en:{"Other Asia, nes":"Other Asia","Free Zones":"Free zones","Bunkers":"Bunkers","Areas, nes":"Other unspecified areas"},
      ar:{"Other Asia, nes":"مناطق آسيوية أخرى","Free Zones":"المناطق الحرة","Bunkers":"وقود السفن والطائرات","Areas, nes":"مناطق أخرى غير محددة"},
      ko:{"Other Asia, nes":"기타 아시아 지역","Free Zones":"자유무역지대","Bunkers":"선박·항공기 연료","Areas, nes":"기타 미분류 지역"},
      ja:{"Other Asia, nes":"その他のアジア地域","Free Zones":"自由貿易地域","Bunkers":"船舶・航空機燃料","Areas, nes":"その他の未分類地域"},
      fr:{"Other Asia, nes":"Autres zones d’Asie","Free Zones":"Zones franches","Bunkers":"Soutes maritimes et aériennes","Areas, nes":"Autres zones non précisées"},
      it:{"Other Asia, nes":"Altre aree dell’Asia","Free Zones":"Zone franche","Bunkers":"Carburante per navi e aerei","Areas, nes":"Altre aree non specificate"},
    };
    const rawName = partner.englishName || partner.name;
    return specialNames[countryNameLanguage][rawName] || rawName;
  };
  const entityLocation=(value:(Partial<LocationFields>&{country?:string|null})|string|null|undefined)=>{const entity=typeof value==="string"?{country:value}:value||{};const raw=entity.country||"";const iso=entity.country_code||entityCountryIso[raw];if(!iso)return {country:raw||locationCopy[countryNameLanguage].unknown,region:locationCopy[countryNameLanguage].unknown,admin1:"",city:"",flag:"🌐"};let localized:Record<string,{admin1?:string;city?:string}>={};try{localized=JSON.parse(entity.location_names||"{}")}catch{}const names=localized[countryNameLanguage]||localized.en||{};return {country:regionDisplayNames.of(iso)||raw,region:tr(entityRegionKey[iso]||"regionOther"),admin1:names.admin1||entity.admin1_name||"",city:names.city||entity.city_name||"",flag:String.fromCodePoint(...iso.split("").map(char=>127397+char.charCodeAt(0)))};};
  const entityLocationLine=(value:(Partial<LocationFields>&{country?:string|null})|string|null|undefined)=>{const location=entityLocation(value);return [location.country,location.admin1,location.city].filter((part,index,all)=>part&&all.indexOf(part)===index).join(" · ");};

  useEffect(() => {
    const saved = localStorage.getItem("tradescope-locale") as Locale | null;
    if (saved && localeOptions.some(item => item.code === saved)) setCountryNameLanguage(saved);
  }, []);
  useEffect(() => {
    const syncView = () => {
      const view = window.location.hash.slice(1) as WorkspaceView;
      if (["global-map", "market-analysis", "competitor-analysis", "data-sources", "watchlist"].includes(view)) setActiveView(view);
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);
  const openView = (view: WorkspaceView) => {
    setCompanyDetail(null);
    setActiveView(view);
    window.history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCompanyDetail=(id:string)=>{
    if(!companyDetail)discoveryScrollPosition.current=window.scrollY;
    setCompanyDetailLoading(true);
    setCompanyDetailTab("relationships");setShipmentPage(null);setShipmentPageNumber(1);setShipmentMonth("");setSelectedShipment(null);
    fetch(`/api/company-detail?id=${encodeURIComponent(id)}`).then(async response=>{if(!response.ok)throw new Error("unavailable");return response.json() as Promise<CompanyDetail>;}).then(data=>{setCompanyDetail(data);window.scrollTo({top:0,behavior:"smooth"});}).finally(()=>setCompanyDetailLoading(false));
  };
  const closeCompanyDetail=()=>{const restoreTo=discoveryScrollPosition.current;setCompanyDetail(null);setShipmentPage(null);setSelectedShipment(null);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:restoreTo,behavior:"auto"})));};
  useEffect(() => {
    document.documentElement.lang = countryNameLanguage;
    document.documentElement.dir = countryNameLanguage === "ar" ? "rtl" : "ltr";
    localStorage.setItem("tradescope-locale",countryNameLanguage);
  }, [countryNameLanguage]);

  useEffect(()=>{
    if(!companyDetail||companyDetailTab!=="shipments")return;
    const controller=new AbortController();setShipmentLoading(true);
    const query=new URLSearchParams({companyId:companyDetail.company.id,page:String(shipmentPageNumber),pageSize:"20"});if(shipmentMonth)query.set("month",shipmentMonth);
    fetch(`/api/company-shipments?${query}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("unavailable");return response.json() as Promise<ShipmentPage>}).then(setShipmentPage).finally(()=>setShipmentLoading(false));
    return()=>controller.abort();
  },[companyDetail?.company.id,companyDetailTab,shipmentPageNumber,shipmentMonth]);

  useEffect(() => {
    if(!selectedMonths.length){setTrade(null);setState("unavailable");return;}
    const controller = new AbortController();
    setState("loading");
    const query = new URLSearchParams({ market, product, flow, granularity: "monthly", months: selectedMonths.join(",") });
    fetch(`/api/trade?${query}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<LiveTrade>;
      })
      .then(data => { setTrade(data); setState(data.recordCount > 0 ? "live" : "unavailable"); })
      .catch(error => { if (error.name !== "AbortError") setState("unavailable"); });
    return () => controller.abort();
  }, [market, product, flow, selectedMonths]);

  useEffect(()=>{
    if(!selectedMonths.length){
      setDiscovery(previous=>previous?{...previous,requestedMonths:[],importers:(previous.importers||[]).map(item=>({...item,selected_month_shipments:0,selected_month_weight_kg:0,selected_month_containers:0,selected_month_freight_usd:0,freight_covered_shipments:0})),suppliers:previous.suppliers.map(item=>({...item,selected_month_shipments:0,selected_month_weight_kg:0,selected_month_containers:0,selected_month_freight_usd:0,freight_covered_shipments:0}))}:previous);
      setDiscoveryState("ready");setSelectedImporterId(null);return;
    }
    const controller=new AbortController();setDiscoveryState("loading");
    const query=new URLSearchParams({market,product,months:selectedMonths.join(",")});
    fetch(`/api/supplier-discovery?${query}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("unavailable");return response.json() as Promise<SupplierDiscovery>;}).then(data=>{setDiscovery(data);setDiscoveryState(data.available?"ready":"unavailable");}).catch(error=>{if(error.name!=="AbortError")setDiscoveryState("unavailable");});
    return()=>controller.abort();
  },[market,product,flow,selectedMonths]);

  useEffect(() => {
    if(!market||!product){setScores(null);setScoresState("idle");return;}
    const controller=new AbortController();setScoresState("loading");
    const params=new URLSearchParams({market,product});
    if(companyDetail?.company.entity_type==="importer"){
      params.set("buyerId",companyDetail.company.id);
    }else if(discoveryState==="ready"&&discovery?.importers?.length){
      params.set("buyerIds",discovery.importers.slice(0,5).map(item=>item.id).join(","));
    }
    fetch(`/api/scores?${params}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("unavailable");return response.json() as Promise<ScoresPayload>;}).then(data=>{setScores(data);setScoresState("ready");}).catch(error=>{if(error.name!=="AbortError")setScoresState("unavailable");});
    return()=>controller.abort();
  },[market,product,companyDetail?.company.id,companyDetail?.company.entity_type,discovery,discoveryState]);

  useEffect(() => {
    const controller=new AbortController();
    fetch("/api/watchlist",{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("unavailable");return response.json() as Promise<{items:WatchlistItem[]}>;}).then(data=>{setWatchlist(data.items);setWatchlistState("ready");}).catch(error=>{if(error.name!=="AbortError")setWatchlistState("ready");});
    return()=>controller.abort();
  },[]);

  async function saveToWatchlist(companyId:string){
    try{
      const response=await fetch(`/api/watchlist?companyId=${encodeURIComponent(companyId)}`,{method:"POST"});
      if(!response.ok)return;
      const data=await response.json() as WatchlistItem;
      setWatchlist(previous=>[data,...previous.filter(item=>item.companyId!==companyId)]);
    }catch{}
  }
  async function updateWatchlist(id:string,changes:Record<string,string|number>){
    try{
      const response=await fetch("/api/watchlist",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...changes})});
      if(!response.ok)return;
      const data=await response.json() as WatchlistItem;
      setWatchlist(previous=>previous.map(item=>item.id===id?{...item,...data,company:data.company??item.company}:item));
    }catch{}
  }
  async function removeFromWatchlist(id:string){
    try{
      const response=await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`,{method:"DELETE"});
      if(!response.ok)return;
      setWatchlist(previous=>previous.filter(item=>item.id!==id));
    }catch{}
  }
  const watchlistEntryFor=(companyId:string)=>watchlist.find(item=>item.companyId===companyId);

  useEffect(() => {
    if (market !== "英国" || selectedProduct.hsCode !== "848180") { setSupplierData(null); setSupplierState("idle"); return; }
    const controller = new AbortController();
    setSupplierState("loading");
    fetch(`/api/suppliers?market=${encodeURIComponent(market)}&hsCode=${selectedProduct.hsCode}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("unavailable"); return response.json() as Promise<SupplierData>; })
      .then(data => { setSupplierData(data); setSupplierState(data.available ? "ready" : "unavailable"); })
      .catch(error => { if (error.name !== "AbortError") setSupplierState("unavailable"); });
    return () => controller.abort();
  }, [market, selectedProduct.hsCode]);

  const chart = useMemo(() => {
    if (!trade?.series.length) return [];
    const maximum = Math.max(...trade.series.map(item => item.tradeValue), 1);
    return trade.series.map(item => ({ ...item, height: Math.max(3, item.tradeValue / maximum * 92) }));
  }, [trade]);
  const chartMax = Math.max(...chart.map(item => item.tradeValue), 1);
  const hasRecords = Boolean(trade?.recordCount);
  const averageValue = trade && trade.netWeightKg > 0 ? trade.tradeValue / trade.netWeightKg : null;
  const change = useMemo(() => {
    if (!trade || trade.series.length < 2) return null;
    const previous = trade.series.at(-2)?.tradeValue || 0;
    const current = trade.series.at(-1)?.tradeValue || 0;
    return previous > 0 ? (current - previous) / previous * 100 : null;
  }, [trade]);
  const availabilityMessage = trade?.availabilityStatus === "fallback" ? `${tr("requestPeriod")}: ${trade.requestedPeriod}; ${tr("actualPeriod")}: ${trade.period}.` : trade?.availabilityStatus === "not_released" ? `${tr("periodNotReleased")} · ${tr("requestPeriod")}: ${trade.requestedPeriod}${trade.latestReportedPeriod ? `; ${tr("actualPeriod")}: ${trade.latestReportedPeriod}` : ""}.` : trade?.availabilityStatus === "no_trade_record" ? `${tr("requestPeriod")}: ${trade.requestedPeriod}; HS ${trade.hsCode}: ${tr("hsNoRecord")}.` : "";
  const sourceNote = trade && hasRecords
    ? `${availabilityMessage} ${tr("source")}: ${trade.source} ${trade.access}; HS ${trade.hsCode}; ${tr("actualPeriod")}: ${trade.period}; ${trade.recordCount} ${tr("records")}.`
    : trade ? `${availabilityMessage} ${tr("noSubstitute")}`
    : state === "unavailable" ? tr("noSubstitute") : tr("waitingOfficial");
  const filteredCompetitors = useMemo(() => {
    const query = competitorSearch.trim().toLowerCase();
    return (supplierData?.suppliers || []).filter(item => !query || `${item.name} ${item.address} ${item.postcode}`.toLowerCase().includes(query));
  }, [supplierData, competitorSearch]);
  const rawDiscoveryImporters=discovery?.importers||[];
  const selectedMonthHasCompanyData=rawDiscoveryImporters.some(item=>Number(item.selected_month_shipments||0)>0)||(discovery?.suppliers||[]).some(item=>Number(item.selected_month_shipments||0)>0);
  const companyMonthDataMissing=discoveryState==="ready"&&!selectedMonthHasCompanyData;
  const latestCompanyMonth=discovery?.storedShipmentCoverage?.[0]?.month||"";
  const selectedMonthsUncollected=selectedMonths.length>0&&selectedMonths.every(month=>{
    const row=(discovery?.storedShipmentCoverage as Array<{month:string;status?:string}>|undefined)?.find(item=>item.month===month);
    return !row||row.status==="uncollected";
  });
  useEffect(()=>{
    const context=`${market}|${flow}|${product}`;
    const responseProduct=(discovery as (SupplierDiscovery&{product?:string})|null)?.product;
    if(discoveryState!=="ready"||!latestCompanyMonth||responseProduct!==product||defaultMonthContext.current===context)return;
    defaultMonthContext.current=context;
    setSelectedMonths([latestCompanyMonth]);setSelectedImporterId(null);
  },[discoveryState,latestCompanyMonth,market,flow,product,discovery]);
  const importerCompositeMax=rawDiscoveryImporters.reduce((max,item)=>({
    containers:Math.max(max.containers,Number(item.selected_month_containers||0)),
    weight:Math.max(max.weight,Number(item.selected_month_weight_kg||0)),
    shipments:Math.max(max.shipments,Number(item.selected_month_shipments||0)),
    suppliers:Math.max(max.suppliers,Number(item.supplier_count||0)),
  }),{containers:0,weight:0,shipments:0,suppliers:0});
  const importerCompositeScore=(item:NonNullable<SupplierDiscovery["importers"]>[number])=>{
    const ratio=(value:number,max:number)=>max>0?value/max:0;
    return 100*(.45*ratio(Number(item.selected_month_containers||0),importerCompositeMax.containers)+.30*ratio(Number(item.selected_month_weight_kg||0),importerCompositeMax.weight)+.20*ratio(Number(item.selected_month_shipments||0),importerCompositeMax.shipments)+.05*ratio(Number(item.supplier_count||0),importerCompositeMax.suppliers));
  };
  const importerHasPartialScore=(item:NonNullable<SupplierDiscovery["importers"]>[number])=>!Number(item.selected_month_containers||0)||!Number(item.selected_month_weight_kg||0)||!Number(item.selected_month_shipments||0);
  const importerRankValue=(item:NonNullable<SupplierDiscovery["importers"]>[number])=>{
    if(importerRanking==="composite")return importerCompositeScore(item);
    const metric={shipments:"selected_month_shipments",weight:"selected_month_weight_kg",containers:"selected_month_containers",freight:"selected_month_freight_usd",suppliers:"supplier_count",history:"relationship_shipments"}[importerRanking] as keyof typeof item;
    return Number(item[metric]||0);
  };
  const discoveryImporters=useMemo(()=>[...rawDiscoveryImporters].sort((a,b)=>importerRankValue(b)-importerRankValue(a)),[discovery,importerRanking]);
  const filteredDiscoveryImporters=useMemo(()=>{const f=buyerFilters;return discoveryImporters.filter(item=>{const p=(item.priority as "A"|"B"|"C"|undefined)||"C";if(p==="A"&&!f.levelA)return false;if(p==="B"&&!f.levelB)return false;if(p==="C"&&!f.levelC)return false;if(f.minShipments>0&&(Number(item.total_shipments)||0)<f.minShipments)return false;return true;});},[discoveryImporters,buyerFilters]);
  const importerRankPosition=(item:NonNullable<SupplierDiscovery["importers"]>[number])=>{
    const value=importerRankValue(item);
    if(value<=0)return null;
    return discoveryImporters.findIndex(candidate=>importerRankValue(candidate)===value)+1;
  };
  const importerRankDisplay=(item:NonNullable<SupplierDiscovery["importers"]>[number])=>{
    const value=importerRankValue(item);
    if(!value)return "—";
    if(importerRanking==="composite")return `${value.toLocaleString(countryNameLanguage,{maximumFractionDigits:1})} / 100`;
    if(importerRanking==="weight")return `${(value/1000).toLocaleString(countryNameLanguage)} t`;
    if(importerRanking==="freight")return money(value);
    if(importerRanking==="shipments"||importerRanking==="history")return `${value.toLocaleString(countryNameLanguage)} ${countryNameLanguage==="zh-CN"?"票":"BOLs"}`;
    if(importerRanking==="containers")return `${value.toLocaleString(countryNameLanguage)} ${countryNameLanguage==="zh-CN"?"柜":"containers"}`;
    return `${value.toLocaleString(countryNameLanguage)} ${countryNameLanguage==="zh-CN"?"家":"suppliers"}`;
  };
  const importerRankingOptions:ImporterRanking[]=["composite","containers","weight","shipments","suppliers","history","freight"];
  const selectedImporter=discoveryImporters.find(item=>item.id===selectedImporterId)||null;
  const visibleDiscoverySuppliers=(discovery?.suppliers||[]).filter(item=>!selectedImporter||String(item.top_importers||"").toLowerCase().includes(selectedImporter.name.toLowerCase()));
  const comparison = (supplierData?.suppliers || []).filter(item => selectedCompetitors.includes(item.traderId));
  const marketPartners = trade?.partners || [];
  const regionTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const partner of marketPartners) {
      const region = mapPositions[partner.iso2]?.region || "其他";
      totals.set(region, (totals.get(region) || 0) + partner.value);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [trade]);
  const selectedMapPartner = marketPartners.find(item => item.code === activeMapPartner) || marketPartners[0];
  const treemapTiles = useMemo(() => buildTreemap((trade?.partners || []).slice(0, 15)), [trade]);
  const visibleFlows = marketPartners.slice(0, 12);
  const networkNodes = visibleFlows.map((partner,index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(visibleFlows.length,1);
    return { partner, x:50 + Math.cos(angle) * 37, y:50 + Math.sin(angle) * 34, radius:Math.sqrt(partner.share / Math.PI) * 2.55 };
  });
  const leadingPartners = marketPartners.slice(0, 3);
  const localizedMarket = regionDisplayNames.of(marketIso[market]) || market;
  const regionLabel = (region:string) => tr(({北美:"regionNorthAmerica",南美:"regionSouthAmerica",欧洲:"regionEurope",亚洲:"regionAsia",中东:"regionMiddleEast",非洲:"regionAfrica",大洋洲:"regionOceania",其他:"regionOther"} as const)[region as "北美"|"南美"|"欧洲"|"亚洲"|"中东"|"非洲"|"大洋洲"|"其他"] || "regionOther");
  const localizedProduct = productNames[countryNameLanguage][product];
  const leadingPartnerNames = leadingPartners.map(partnerLabel).join(countryNameLanguage === "zh-CN" || countryNameLanguage === "ja" ? "、" : ", ");
  const plainHeadline = state === "loading"
    ? `${tr("readingOfficial")} · ${localizedProduct}`
    : hasRecords
      ? `${flow === "进口" ? tr("import") : tr("export")}: ${localizedMarket} · ${leadingPartnerNames}`
      : tr("noRecords");

  function toggleCompetitor(traderId: number) {
    setSelectedCompetitors(current => current.includes(traderId) ? current.filter(id => id !== traderId) : current.length < 3 ? [...current, traderId] : current);
  }

  function selectMarket(next: Market) {
    setMarket(next);
    if (next === "中国") {
      setFlow("出口");
    }
  }

  function exportOfficialCsv() {
    if (!trade) return;
    const rows = [
      ["期间", "报告国/市场", "方向", "产品", "HS Code", "贸易额(USD)", "净重(kg)", "净重是否估算", "来源"],
      ...trade.series.map(item => [item.period, market, flow, product, trade.hsCode, item.tradeValue, item.netWeightKg, item.isEstimated ? "是" : "否", trade.source]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `TradeScope_${market}_${flow}_${product}_${trade.period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportPartnerCsv() {
    if (!trade?.partners.length) return;
    const rows = [
      ["实际统计期", "报告市场", "方向", "伙伴国", "HS Code", "贸易额(USD)", "占全球伙伴比例(%)", "净重(kg)", "净重是否估算", "来源"],
      ...trade.partners.map(item => [trade.latestReportedPeriod, market, flow, partnerLabel(item), trade.hsCode, item.value, item.share.toFixed(2), item.netWeightKg, item.isEstimated ? "是" : "否", trade.source]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `TradeScope_${market}_${flow}_${product}_伙伴国_${trade.latestReportedPeriod}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  function exportSuppliersCsv() {
    if (!supplierData?.suppliers.length) return;
    const rows = [
      ["企业名称", "地址", "邮编", "CN8编码", "证据期", "证据类型", "来源", "制造商身份"],
      ...supplierData.suppliers.map(item => [item.name, item.address, item.postcode, item.commodityCodes.join("/"), supplierData.period || "", supplierData.evidenceType || "", supplierData.source || "", "未验证"]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `TradeScope_英国出口商_HS848180_${supplierData.period}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><strong>TradeScope</strong><span>{tr("brandSub")}</span></div></div>
      <nav aria-label={tr("marketAnalysis")}><p className="nav-label">{countryNameLanguage==="zh-CN"?"供应链研究":"SUPPLY RESEARCH"}</p><button className={activeView === "competitor-analysis" ? "nav-item active" : "nav-item"} onClick={() => openView("competitor-analysis")}><Icon>◇</Icon>{countryNameLanguage==="zh-CN"?"供应商发现":"Supplier discovery"}{activeView === "competitor-analysis" ? <span className="nav-dot" /> : null}</button><button className={activeView === "market-analysis" ? "nav-item active" : "nav-item"} onClick={() => openView("market-analysis")}><Icon>∿</Icon>{countryNameLanguage==="zh-CN"?"月度市场":"Monthly market"}{activeView === "market-analysis" ? <span className="nav-dot" /> : null}</button><button className={activeView === "global-map" ? "nav-item active" : "nav-item"} onClick={() => openView("global-map")}><Icon>◉</Icon>{countryNameLanguage==="zh-CN"?"国家关系":"Country context"}{activeView === "global-map" ? <span className="nav-dot" /> : null}</button><button className={activeView === "watchlist" ? "nav-item active" : "nav-item"} onClick={() => openView("watchlist")}><Icon>☆</Icon>{countryNameLanguage==="zh-CN"?"买家清单":"Watchlist"}{watchlist.length?<span className="nav-count">{watchlist.length}</span>:null}{activeView === "watchlist" ? <span className="nav-dot" /> : null}</button><p className="nav-label nav-group">{tr("dataManagement")}</p><button className={activeView === "data-sources" ? "nav-item active" : "nav-item"} onClick={() => openView("data-sources")}><Icon>⇩</Icon>{tr("sourcesExport")}{activeView === "data-sources" ? <span className="nav-dot" /> : null}</button></nav>
      <div className="sidebar-bottom"><div className="coverage"><span>{tr("currentQuery")}</span><strong>{regionDisplayNames.of(marketIso[market]) || market} · {productNames[countryNameLanguage][product]}</strong><div><i style={{ width: state === "live" ? "100%" : "0%" }} /></div><small>{state === "live" ? `${trade?.source} ${tr("connected")}` : state === "loading" ? tr("reading") : tr("noData")}</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar">{companyDetail?<div className="company-topbar"><button onClick={closeCompanyDetail} aria-label={countryNameLanguage==="zh-CN"?"返回上一页":"Go back"}>←</button><div><small>{companyDetail.company.entity_type==="importer"?(countryNameLanguage==="zh-CN"?"进口商详情":"Importer detail"):(countryNameLanguage==="zh-CN"?"供应商详情":"Supplier detail")}</small><strong>{companyDetail.company.name}</strong></div><RelatedEntityPopover entities={companyDetail.relatedEntities||[]} locale={countryNameLanguage} onSelect={openCompanyDetail}/></div>:<div className="crumb"><span>{tr("workspace")}</span><b>/</b><strong>{tr("explore")}</strong></div>}<label className="locale-select"><span>{tr("language")}</span><select value={countryNameLanguage} onChange={event => setCountryNameLanguage(event.target.value as Locale)}>{localeOptions.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label></header>
      <div className="content">
        {!companyDetail?<>
        <div className="title-row">
          <div><div className="eyebrow"><span /> MONTHLY EVIDENCE FIRST</div><h1>{countryNameLanguage === "zh-CN" ? "企业月度竞争情报" : "Monthly company intelligence"}</h1><p>{countryNameLanguage === "zh-CN" ? "先看逐票企业证据，再用国家统计判断市场背景；两类数据不混用。" : "Shipment-level company evidence first; country statistics are shown separately as market context."}</p></div>
          <div className="freshness"><span className={state === "live" ? "pulse" : "pulse pending"} /><div><strong>{state === "live" ? tr("officialConnected") : state === "loading" ? tr("readingOfficial") : tr("noRecords")}</strong><small>{trade ? `${trade.source} · ${trade.period}` : tr("noDemo")}</small></div></div>
        </div>

        <section className="search-panel sticky-query" aria-label={tr("title")}>
          <div className="field"><label>{market === "中国" ? tr("reporter") : tr("targetMarket")}</label><div className="select-wrap"><span>{markets[market].flag}</span><select value={market} onChange={event => selectMarket(event.target.value as Market)}>{Object.keys(markets).map(item => <option key={item} value={item}>{regionDisplayNames.of(marketIso[item as Market]) || item}</option>)}</select></div></div>
          <div className="field compact"><label>{tr("direction")}</label><div className="segment"><button className={flow === "进口" ? "on" : ""} onClick={() => setFlow("进口")}>{tr("import")}</button><button className={flow === "出口" ? "on" : ""} onClick={() => setFlow("出口")}>{tr("export")}</button></div></div>
          <div className="field product-field"><label>{tr("product")}</label><div className="product-select"><span>⌕</span><select value={product} onChange={event => setProduct(event.target.value as Product)}>{products.map(item => <option key={item.hsCode} value={item.name}>{productNames[countryNameLanguage][item.name]}</option>)}</select><small>HS {selectedProduct.hsCode}</small></div></div>
          <MonthPicker locale={countryNameLanguage} open={monthPickerOpen} onOpen={setMonthPickerOpen} months={monthOptions} selected={selectedMonths} onChange={setSelectedMonths} coverage={discovery?.storedShipmentCoverage||[]} latest={latestCompanyMonth}/>
          <div className="auto-query-status" role="status"><span className={state === "loading" ? "query-spinner" : state === "live" ? "pulse" : "pulse pending"} /><div><strong>{state === "loading" ? tr("updating") : state === "live" ? tr("updated") : tr("queryNoData")}</strong><small>{trade ? `${trade.cache.hit ? tr("cacheHit") : tr("liveRequest")} · ${tr("refresh5")}` : tr("autoHint")}</small></div></div>
        </section>

        

        <div className={state === "live" ? "disclaimer official" : "disclaimer"}><span>i</span><p><strong>{countryNameLanguage === "zh-CN" ? "国家市场参考，不是竞品结论。" : "Country market context, not a competitor conclusion."}</strong> {sourceNote}</p></div>
        </>:null}

        {activeView === "global-map" ? <><section className="plain-answer market-context-section" aria-labelledby="plain-answer-title">
          <div className="plain-copy"><span>{tr("plain")}</span><h2 id="plain-answer-title">{plainHeadline}</h2><p>{localizedProduct} · HS {trade?.hsCode || selectedProduct.hsCode}</p></div>
          <div className={`trade-flow-story ${flow === "出口" ? "reverse" : ""}`} aria-label={plainHeadline}>
            <div className="flow-side countries"><small>{flow === "进口" ? `① ${tr("goodsFrom")}` : `③ ${tr("goodsTo")}`}</small><div>{leadingPartners.length ? leadingPartners.map(item => <span key={item.code}><i>{item.flag}</i><b>{partnerLabel(item)}</b><em>{item.share.toFixed(1)}%</em></span>) : <span className="empty-flow">{tr("waitingCountries")}</span>}</div></div>
            <div className="flow-arrow"><b>{flow === "进口" ? `② ${tr("moveHere")}` : `② ${tr("sellAbroad")}`}</b><span>→</span></div>
            <div className="flow-side destination"><small>{flow === "进口" ? `③ ${tr("buyer")}` : `① ${tr("seller")}`}</small><strong>{markets[market].flag}</strong><b>{localizedMarket}</b><em>{localizedProduct}</em></div>
          </div>
          <div className="plain-foot"><span>{tr("what")}: <strong>{localizedProduct}</strong></span><span>{tr("action")}: <strong>{flow === "进口" ? tr("buyAbroad") : tr("sellOverseas")}</strong></span><span>{tr("dataPeriod")}: <strong>{trade?.period || "—"}</strong></span><span className="professional-detail">{tr("forExperts")}: {localizedMarket} · HS {trade?.hsCode || selectedProduct.hsCode}</span></div>
        </section>

        <section id="global-map" className={state === "loading" ? "card world-screen loading-surface" : "card world-screen"} aria-label={tr("globalDistribution")}>
          <div className="card-header world-head"><div><span className="eyebrow-mini">{tr("flowTitle")}</span><h2>{tr(flow === "进口" ? "buysFrom" : "sellsTo",{market:localizedMarket})}</h2><p>{localizedProduct} · {trade?.latestReportedPeriod ? tr("latest",{period:trade.latestReportedPeriod}) : state === "loading" ? tr("findingLatest") : tr("unavailable")}</p></div><div className="map-legend"><span><i />{tr("areaLegend")}</span><b>{flow === "进口" ? `→ ${localizedMarket}` : `${localizedMarket} →`}</b></div></div>
          <div className="distribution-tabs" role="tablist" aria-label={tr("globalDistribution")}><button role="tab" aria-selected={distributionView === "network"} className={distributionView === "network" ? "on" : ""} onClick={() => setDistributionView("network")}><i>●</i><span><strong>{tr("network")}</strong><small>{tr("networkSub")}</small></span></button><button role="tab" aria-selected={distributionView === "treemap"} className={distributionView === "treemap" ? "on" : ""} onClick={() => setDistributionView("treemap")}><i>▦</i><span><strong>{tr("treemap")}</strong><small>{tr("treemapSub")}</small></span></button><button role="tab" aria-selected={distributionView === "sankey"} className={distributionView === "sankey" ? "on" : ""} onClick={() => setDistributionView("sankey")}><i>⇢</i><span><strong>{tr("sankey")}</strong><small>{tr("sankeySub")}</small></span></button></div>
          <div className="world-layout">
            {distributionView === "network" ? <div className="trade-flow-map dependency-map" role="img" aria-label={tr("network")}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><marker id="trade-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b96c31" /></marker></defs>{networkNodes.map(({partner,x,y,radius}) => { const dx=x-50,dy=y-50,distance=Math.sqrt(dx*dx+dy*dy)||1; const ux=dx/distance,uy=dy/distance; const from=flow === "进口" ? {x:x-ux*radius,y:y-uy*radius} : {x:50+ux*8,y:50+uy*8}; const to=flow === "进口" ? {x:50-ux*8,y:50-uy*8} : {x:x-ux*radius,y:y-uy*radius}; return <g key={partner.code} className={partner.code === selectedMapPartner?.code ? "dependency-relation active" : "dependency-relation"} onMouseEnter={event => { setActiveMapPartner(partner.code); setHoveredMapPartner({partner,x:event.clientX,y:event.clientY}); }} onMouseMove={event => setHoveredMapPartner({partner,x:event.clientX,y:event.clientY})} onMouseLeave={() => setHoveredMapPartner(null)}><path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} markerEnd="url(#trade-arrow)" style={{"--route-color":countryColor(partner.code),"--route-width":Math.max(.35,Math.min(1.25,partner.share/9))} as React.CSSProperties}/><circle cx={x} cy={y} r={radius} style={{"--route-color":countryColor(partner.code)} as React.CSSProperties}/><text className="node-flag" x={x} y={y+.7}>{partner.flag}</text><text className="node-label" x={x} y={y+radius+3}>{partnerLabel(partner).slice(0,13)}</text><text className="node-share" x={x} y={y+radius+5.5}>{partner.share.toFixed(1)}%</text></g>; })}<g className="dependency-hub"><circle cx="50" cy="50" r="8"/><text className="hub-flag" x="50" y="49">{markets[market].flag}</text><text className="hub-name" x="50" y="54">{localizedMarket}</text></g></svg>
              <div className="map-direction-badge"><strong>{flow === "进口" ? `→ ${localizedMarket}` : `${localizedMarket} →`}</strong><span>{tr("direction")}</span></div>
              {!visibleFlows.length && state !== "loading" ? <div className="map-empty">{tr("noFlow")}</div> : null}
            </div> : distributionView === "treemap" ? <div className="market-treemap" role="img" aria-label={tr("treemap")}>{treemapTiles.map(({partner,x,y,width,height}) => { const density=width<10||height<10?"tiny":width<22||height<18?"small":"full"; return <button key={partner.code} className={`treemap-tile ${density}${partner.code===selectedMapPartner?.code?" active":""}`} style={{left:`${x}%`,top:`${y}%`,width:`${width}%`,height:`${height}%`,"--tile-color":countryColor(partner.code)} as React.CSSProperties} onMouseEnter={event => {setActiveMapPartner(partner.code);setHoveredMapPartner({partner,x:event.clientX,y:event.clientY});}} onMouseMove={event => setHoveredMapPartner({partner,x:event.clientX,y:event.clientY})} onMouseLeave={() => setHoveredMapPartner(null)} onClick={() => setActiveMapPartner(partner.code)}><strong><i>{partner.flag}</i><span>{partnerLabel(partner)}</span></strong><b>{partner.share.toFixed(1)}%</b><em>{money(partner.value)}</em></button>;})}{!treemapTiles.length&&state!=="loading"?<div className="map-empty">{tr("noCountryShares")}</div>:null}</div> : <div className="trade-flow-map sankey-map" role="img" aria-label={tr("sankey")}><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><marker id="sankey-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#8c5a35"/></marker></defs>{visibleFlows.slice(0,10).map((partner,index,list) => {const rowY=10+index*(80/Math.max(1,list.length-1));const hubY=50+(index-(list.length-1)/2)*1.8;const from=flow==="进口"?{x:19,y:rowY}:{x:21,y:hubY};const to=flow==="进口"?{x:79,y:hubY}:{x:81,y:rowY};const path=`M ${from.x} ${from.y} C 43 ${from.y}, 57 ${to.y}, ${to.x} ${to.y}`;const nodeX=flow==="进口"?14:86;return <g key={partner.code} className={partner.code===selectedMapPartner?.code?"sankey-relation active":"sankey-relation"} onMouseEnter={event=>{setActiveMapPartner(partner.code);setHoveredMapPartner({partner,x:event.clientX,y:event.clientY});}} onMouseMove={event=>setHoveredMapPartner({partner,x:event.clientX,y:event.clientY})} onMouseLeave={()=>setHoveredMapPartner(null)}><path d={path} markerEnd="url(#sankey-arrow)" style={{"--band-color":countryColor(partner.code),"--band-width":Math.max(.4,partner.share*.42)} as React.CSSProperties}/><circle cx={nodeX} cy={rowY} r="2.6" style={{"--band-color":countryColor(partner.code)} as React.CSSProperties}/><text className="sankey-flag" x={nodeX} y={rowY+.8}>{partner.flag}</text><text className="sankey-label" x={nodeX} y={rowY+5}>{partnerLabel(partner).slice(0,12)} {partner.share.toFixed(1)}%</text></g>;})}<g className="sankey-hub"><rect x={flow==="进口"?80:8} y="31" width="12" height="38" rx="5"/><text x={flow==="进口"?86:14} y="48">{markets[market].flag}</text><text x={flow==="进口"?86:14} y="54">{localizedMarket}</text></g></svg>{!visibleFlows.length&&state!=="loading"?<div className="map-empty">{tr("noFlow")}</div>:null}</div>}
            <aside className="map-details"><div className="map-focus"><small>{tr("currentMarket")}</small><strong>{selectedMapPartner ? `${selectedMapPartner.flag} ${partnerLabel(selectedMapPartner)}` : "—"}</strong><b>{selectedMapPartner ? money(selectedMapPartner.value) : "—"}</b><span>{selectedMapPartner ? `${tr("globalShare")} ${selectedMapPartner.share.toFixed(2)}%` : tr("reading")}</span><span>{selectedMapPartner ? `${tr("netWeight")} ${selectedMapPartner.netWeightKg.toLocaleString(countryNameLanguage)} kg${selectedMapPartner.isEstimated ? ` · ${tr("estimated")}` : ""}` : ""}</span></div><div className="country-share-list"><small>{tr("allCountries")}</small>{(trade?.partners || []).slice(0,15).map(partner => <button key={partner.code} className={partner.code === selectedMapPartner?.code ? "active" : ""} onMouseEnter={() => setActiveMapPartner(partner.code)} onFocus={() => setActiveMapPartner(partner.code)} onClick={() => setActiveMapPartner(partner.code)}><i style={{ background:countryColor(partner.code) }} /><span>{partner.flag} {partnerLabel(partner)}</span><strong>{partner.share.toFixed(1)}%</strong></button>)}</div><div className="region-list compact-regions"><small>{tr("regionTotal")}</small>{regionTotals.map(([region,value]) => <div key={region}><span>{regionLabel(region)}</span><strong>{money(value)}</strong></div>)}</div></aside>
          </div>
          {hoveredMapPartner ? <div className="global-market-tooltip" style={{ left:hoveredMapPartner.x + 14, top:hoveredMapPartner.y + 14 }} role="tooltip"><strong>{hoveredMapPartner.partner.flag} {partnerLabel(hoveredMapPartner.partner)}</strong><span>{tr("tradeValue")} {money(hoveredMapPartner.partner.value)}</span><span>{tr("globalShare")} {hoveredMapPartner.partner.share.toFixed(2)}%</span><span>{tr("netWeight")} {hoveredMapPartner.partner.netWeightKg.toLocaleString(countryNameLanguage)} kg{hoveredMapPartner.partner.isEstimated ? ` · ${tr("estimated")}` : ""}</span></div> : null}
          <div className="map-source"><span>i</span><p><strong>{tr(distributionView === "network" ? "network" : distributionView === "treemap" ? "treemap" : "sankey")}</strong> · {tr("tradeValue")} · {tr("globalShare")} · {tr("direction")}</p></div>
        </section></> : null}

        {activeView === "market-analysis" ? <><section id="market-analysis" className={state === "loading" ? "metrics loading-surface" : "metrics"} aria-busy={state === "loading"}>
          <article><div className="metric-head"><span>{tr("recordedTrade")}</span><b className={hasRecords ? "source a" : "source c"}>{hasRecords ? `A · ${tr("officialStats")}` : tr("noRecord")}</b></div><strong>{hasRecords && trade ? money(trade.tradeValue) : "—"}</strong><p>{hasRecords && trade ? <><em>{trade.recordCount} {tr("periodsFound")}</em> · HS {trade.hsCode}</> : tr("missingNotZero")}</p></article>
          <article><div className="metric-head"><span>{tr("netWeight")}</span><b className={hasRecords ? "source a" : "source c"}>{hasRecords ? `A · ${tr("officialStats")}` : tr("noRecord")}</b></div><strong>{hasRecords && trade ? (trade.netWeightKg / 1_000_000).toFixed(2) : "—"} <small>kt</small></strong><p>{hasRecords && trade ? trade.isNetWeightEstimated ? tr("estimated") : tr("officialStats") : tr("reading")}</p></article>
          <article><div className="metric-head"><span>{tr("avgUnit")}</span><b className={averageValue !== null ? "source b" : "source c"}>{averageValue !== null ? "B" : tr("noData")}</b></div><strong>{averageValue !== null ? `$${averageValue.toFixed(2)}` : "—"} <small>/ kg</small></strong></article>
          <article><div className="metric-head"><span>{tr("latestChange")}</span><b className={change !== null ? "source b" : "source c"}>{change !== null ? "B" : tr("noData")}</b></div><strong>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}</strong><p>{change === null ? tr("needTwo") : tr("latestChange")}</p></article>
        </section>

        <section className={state === "loading" ? "analysis-grid loading-surface" : "analysis-grid"} aria-busy={state === "loading"}>
          <article className="card trend-card">
            <div className="card-header"><div><h2>{localizedMarket} · {tr(flow === "进口" ? "import" : "export")} {tr("trend")}</h2><p>{localizedProduct} · HS {trade?.hsCode || "848180"} · USD</p></div><div className="legend"><span><i /> {tr("tradeAmount")}</span><b>{selectedMonths.length} {tr("monthly")}</b></div></div>
            <div className="chart"><div className="y-axis"><span>{money(chartMax)}</span><span>{money(chartMax * .75)}</span><span>{money(chartMax * .5)}</span><span>{money(chartMax * .25)}</span><span>$0</span></div><div className={chart.length > 12 ? "plot dense" : "plot"}>{chart.map(item => <div className="bar-slot" key={item.period}><div className="bar official-bar" style={{ height: `${item.height}%` }}><span>{money(item.tradeValue)}</span></div><small>{item.label}</small></div>)}</div></div>
            <div className="insight"><span>i</span><p><strong>{trade ? tr("officialReturned") : tr("noSeries")}</strong> {trade ? `${trade.period} · ${trade.recordCount}` : tr("noRecords")}</p></div>
          </article>
          <article className="card origin-card">
            <div className="card-header"><div><h2>{flow === "进口" ? tr("mainSources") : tr("mainDestinations")}</h2><p>{tr("latestPartner")}</p></div></div>
            <div className="origin-list">{trade?.partners.length ? trade.partners.slice(0, 5).map((partner, index) => <div className="origin" key={partner.code}><span className="rank">{index + 1}</span><span className="flag">{partner.flag}</span><div className="origin-name"><strong>{partnerLabel(partner)}</strong><div><i style={{ width: `${Math.min(100, partner.share * 2)}%` }} /></div></div><div className="origin-val"><strong>{money(partner.value)}</strong><small>{partner.share.toFixed(1)}% · <em>{partner.isEstimated ? tr("weightEstimated") : tr("reported")}</em></small></div></div>) : <div className="origin-loading">{state === "loading" ? tr("partnerLoading") : tr("noPartnerRecords")}</div>}</div>
            <div className="origin-summary"><span>{tr("shown")}</span><strong>{trade?.partners.length || 0}</strong><small>{tr("topFive")}</small></div>
          </article>
        </section></> : null}

        {activeView === "competitor-analysis" ? <section id="competitor-analysis" className={`supplier-discovery ${discoveryMode==="exporter"?"exporter-mode":"importer-mode"} ${companyMonthDataMissing?"month-data-missing":""}`} aria-busy={discoveryState === "loading" || companyDetailLoading}>
          {companyDetailLoading?<div className="supplier-status"><span className="query-spinner" />{countryNameLanguage==="zh-CN"?"正在读取企业全部供应关系…":"Loading all company relationships…"}</div>:companyDetail?<div className={`company-detail-page ${companyDetailTab}`}><button className="detail-back" onClick={closeCompanyDetail}>← {detailCopy[countryNameLanguage].back}</button><header><div><span>{companyDetail.company.entity_type==="importer"?(countryNameLanguage==="zh-CN"?"美国进口商":"U.S. IMPORTER"):(countryNameLanguage==="zh-CN"?"海外供应商":"OVERSEAS SUPPLIER")}</span><h2>{companyDetail.company.name}</h2><p>{entityLocation(companyDetail.company).flag} {entityLocationLine(companyDetail.company)}<br/>{companyDetail.company.address}</p>{companyDetail.company.entity_type==="importer"&&companyDetail.company.identity_confidence!==null?<span className={`identity-badge identity-tier-${identityTier(companyDetail.company.identity_confidence)}`} title={identityNoteReason(companyDetail.company.identity_notes)||undefined}>{buyerCopy[countryNameLanguage].identityConfidence} {companyDetail.company.identity_confidence}% · {companyDetail.company.identity_confidence>=95?buyerCopy[countryNameLanguage].exactMatch:companyDetail.company.identity_confidence>=80?buyerCopy[countryNameLanguage].normalizedMatch:companyDetail.company.identity_confidence>=60?buyerCopy[countryNameLanguage].fuzzyMatch:buyerCopy[countryNameLanguage].unresolved}{companyDetail.company.identity_status==="fuzzy_candidate"?` · ${buyerCopy[countryNameLanguage].fuzzyCandidate}`:companyDetail.company.identity_status==="unresolved"?` · ${buyerCopy[countryNameLanguage].unresolved}`:""}</span>:null}</div><div className="supplier-links"><a href={companyDetail.company.source_url} target="_blank" rel="noreferrer">ImportYeti ↗</a>{companyDetail.company.website?<a href={companyDetail.company.website} target="_blank" rel="noreferrer">Website ↗</a>:<span>{countryNameLanguage==="zh-CN"?"官网未获取":"No website"}</span>}{(()=>{const saved=watchlistEntryFor(companyDetail.company.id);return <button className={`watchlist-save ${saved?"saved":""}`} onClick={()=>{if(saved)removeFromWatchlist(saved.id);else saveToWatchlist(companyDetail.company.id);}}>{saved?`★ ${watchlistStatusLabel[saved.status]}`:(countryNameLanguage==="zh-CN"?"☆ 保存到清单":"☆ Save to watchlist")}</button>;})()}</div></header><nav className="company-detail-tabs">{(["relationships","shipments"] as const).map(tab=><button key={tab} className={companyDetailTab===tab?"on":""} onClick={()=>{setCompanyDetailTab(tab);setSelectedShipment(null)}}>{detailCopy[countryNameLanguage][tab]}</button>)}</nav><div className={`detail-overview${companyDetail.company.entity_type==="importer"?" importer-detail-overview":""}`}><article><small>{countryNameLanguage==="zh-CN"?"页面历史总提单":"Profile shipments"}</small><strong>{companyDetail.company.total_shipments??"—"}</strong></article><article><small>{countryNameLanguage==="zh-CN"?"全部合作企业":"All relationships"}</small><strong>{companyDetail.relationships.length}</strong></article><article><small>{countryNameLanguage==="zh-CN"?"关系历史提单":"Relationship shipments"}</small><strong>{companyDetail.relationships.reduce((sum,item)=>sum+Number(item.shipment_count||0),0)}</strong></article><article><small>{countryNameLanguage==="zh-CN"?"已采集逐票记录":"Captured BOLs"}</small><strong>{companyDetail.relationships.reduce((sum,item)=>sum+Number(item.captured_bols||0),0)}</strong></article><article><small>{countryNameLanguage==="zh-CN"?"最近发货":"Latest shipment"}</small><strong>{companyDetail.company.latest_shipment_date?companyDetail.company.latest_shipment_date.slice(0,10):"—"}</strong></article>{companyDetail.company.entity_type==="importer"?<article><small>{buyerCopy[countryNameLanguage].supplierCountries}</small><strong>{new Set(companyDetail.relationships.map(item=>item.company_country).filter(Boolean)).size}</strong></article>:null}</div>{(()=>{const rows=companyDetail.monthlyBreakdown||[];const max=Math.max(1,...rows.map(item=>Number(item.shipments||0)));return rows.length?<div className="detail-monthly-strip"><div className="section-step"><span>02</span><div><strong>{countryNameLanguage==="zh-CN"?"月度进口活动":"Monthly import activity"}</strong><small>{countryNameLanguage==="zh-CN"?"已采集逐票记录按月分布":"Captured BOLs by month"}</small></div></div><div className="monthly-bars">{rows.slice(0,12).map(item=><div className="month-bar" key={item.month} title={`${item.month}: ${item.shipments} BOLs`}><i style={{height:`${Math.max(4,Number(item.shipments||0)/max*100)}%`}} /><small>{item.month.slice(5)}</small><b>{item.shipments}</b></div>)}</div></div>:null;})()}{companyDetailTab==="shipments"?<ShipmentPanel companyType={companyDetail.company.entity_type} locale={countryNameLanguage} page={shipmentPage} loading={shipmentLoading} pageNumber={shipmentPageNumber} month={shipmentMonth} selected={selectedShipment} onMonth={value=>{setShipmentMonth(value);setShipmentPageNumber(1)}} onPage={setShipmentPageNumber} onSelect={setSelectedShipment} onClose={()=>setSelectedShipment(null)}/>:null}{companyDetail.company.entity_type==="importer"?(()=>{const b=buyerCopy[countryNameLanguage];const rels=companyDetail.relationships||[];const totalBols=rels.reduce((sum,r)=>sum+Number(r.shipment_count||0),0);const start=rels.reduce((min,r)=>!min||r.period_start<min?r.period_start:min,"");const end=rels.reduce((max,r)=>!max||r.period_end>max?r.period_end:max,"");const span=monthSpan(start,end);const frequency=span>0?totalBols/span:0;const countries=new Set(rels.map(r=>r.company_country).filter(Boolean)).size;const hsEvidence=calculateHsEvidence(rels,selectedProduct.hsCode);const now=new Date();const monthsSinceLast=end?Math.max(0,monthIndex(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`)-monthIndex(end)):null;const buyerScore=scores?.buyer&&scores.buyer.entityId===companyDetail.company.id?scores.buyer.score:null;const indicators=[{id:"frequency",label:b.frequency,value:frequency.toFixed(1),unit:b.perMonth,detail:formatCopy(b.overMonths,{months:span})},{id:"diversity",label:b.diversity,value:String(rels.length),unit:b.suppliers,detail:String(countries)+" "+b.countries},{id:"relevance",label:b.relevance,value:hsEvidence.codedRelationships?String(hsEvidence.matchedRelationships)+"/"+String(hsEvidence.codedRelationships):"—",unit:"",detail:formatCopy(b.relationshipsWithHs,{match:hsEvidence.matchedRelationships,total:hsEvidence.codedRelationships,missing:hsEvidence.missingRelationships,hs:selectedProduct.hsCode})},{id:"recency",label:b.recency,value:monthsSinceLast===null?"—":monthsSinceLast<=6?b.active:formatCopy(b.monthsAgo,{months:monthsSinceLast}),unit:"",detail:end||"—"}];return <section className="buyer-research"><div className="section-step"><div><strong>{b.opportunity}</strong></div>{buyerScore!==null?<b className="opportunity-total"><small>{b.opportunityEngine}</small>{buyerScore}<em>/100</em></b>:null}</div>{indicators.some(ind=>ind.value!=="—")?<div className="opportunity-grid">{indicators.map(ind=><article className="opportunity-card" key={ind.id}><span><small>{ind.label}</small><b>{ind.value} <em>{ind.unit}</em></b></span><p>{ind.detail}</p></article>)}</div>:<div className="supplier-empty"><strong>{countryNameLanguage==="zh-CN"?"暂无合作关系数据":"No relationship data"}</strong><span>{b.basedOnStored}</span></div>}</section>;})():null}<div className="relationship-list"><div className="section-step"><span>01</span><div><strong>{companyDetail.relationshipRole==="upstream_suppliers"?(countryNameLanguage==="zh-CN"?"全部海外出口商 / 供应商":"All overseas exporters / suppliers"):(countryNameLanguage==="zh-CN"?"全部美国进口客户":"All U.S. importing customers")}</strong><small>{countryNameLanguage==="zh-CN"?"按历史合作提单数排序":"Ranked by historical relationship shipments"}</small></div></div>{companyDetail.company.entity_type==="importer"?<div className="network-banner"><span className="network-node network-buyer">{companyDetail.company.name}</span><i className="network-arrow">↓</i><span className="network-node network-group"><b>{companyDetail.relationships.length}</b> {buyerCopy[countryNameLanguage].networkSuppliers}</span></div>:null}{companyDetail.relationships.map((item,index)=><article className="relationship-card" key={item.id}><span className="supplier-rank">{String(index+1).padStart(2,"0")}</span><div><strong>{item.company_name}</strong><small>{entityLocation(item.company_country).flag} {entityLocation(item.company_country).country} · {entityLocation(item.company_country).region}<br/>{item.company_address}</small><p>{item.product_descriptions||"—"}</p><em>HS {item.hs_codes||"—"}</em></div><div className="relationship-metrics"><span><small>{countryNameLanguage==="zh-CN"?"历史关系":"Relationship"}</small><b>{item.shipment_count||0} {countryNameLanguage==="zh-CN"?"票":"BOLs"}</b></span><span><small>{companyDetail.company.entity_type==="importer"?`${buyerCopy[countryNameLanguage].firstSeenShort} / ${buyerCopy[countryNameLanguage].lastSeenShort}`:(countryNameLanguage==="zh-CN"?"关系期间":"Period")}</small><b>{item.period_start||"—"} – {item.period_end||"—"}</b></span><span><small>{countryNameLanguage==="zh-CN"?"已采集逐票":"Captured"}</small><b>{Number(item.captured_bols||0).toLocaleString(countryNameLanguage)}</b></span><span><small>{countryNameLanguage==="zh-CN"?"重量 / 柜量":"Weight / containers"}</small><b>{item.captured_bols?`${(Number(item.captured_weight_kg)/1000).toLocaleString(countryNameLanguage)} t / ${item.captured_containers}`:countryNameLanguage==="zh-CN"?"未采集逐票明细":"BOL details not captured"}</b></span></div><button onClick={()=>openCompanyDetail(item.company_id)}>{countryNameLanguage==="zh-CN"?"查看企业":"View"} →</button></article>)}</div>{companyDetail.company.entity_type==="importer"?(()=>{const b=buyerCopy[countryNameLanguage];const c=companyDetail.company;const sourceKey=(companyDetail.aliases||[]).find(a=>a.alias_type==="source_key")?.alias_value||c.source_entity_key||"—";const captured=companyDetail.relationships.reduce((sum,r)=>sum+Number(r.captured_bols||0),0);const total=companyDetail.relationships.reduce((sum,r)=>sum+Number(r.shipment_count||0),0);const tier=identityTier(c.identity_confidence);const tierLabel=c.identity_confidence>=95?b.exactMatch:c.identity_confidence>=80?b.normalizedMatch:c.identity_confidence>=60?b.fuzzyMatch:c.identity_confidence!==null?b.unresolved:null;const note=identityNoteReason(c.identity_notes);const websiteVerified=!!c.website&&["verified","verified_company_site"].includes(c.website_status||"");return <section className="buyer-quality"><div className="section-step"><span>04</span><div><strong>{b.profileQuality}</strong><small>{b.qualityHint}</small></div></div><div className="quality-grid"><div className="quality-cell"><small>{b.rawSourceName}</small><b>{sourceKey}</b></div><div className="quality-cell"><small>{b.identityConfidence}</small><b>{c.identity_confidence!==null?`${c.identity_confidence}% · ${tierLabel}`:"—"}</b>{note?<em>{note}</em>:null}</div><div className="quality-cell"><small>{b.firstSeen}</small><b>{c.first_seen_at||"—"}</b></div><div className="quality-cell"><small>{b.dataSource}</small><b>{c.source_attribution||"—"}</b></div><div className="quality-cell"><small>{b.capturedAt}</small><b>{c.captured_at?c.captured_at.slice(0,10):"—"}</b></div><div className="quality-cell"><small>{b.bolCoverage}</small><b>{formatCopy(b.bolsOf,{captured,total})}</b></div></div><div className="quality-chips"><span className={`quality-chip ${c.address?"ok":"missing"}`}>{b.address}: {c.address?b.qualityPresent:b.qualityMissing}</span><span className={`quality-chip ${websiteVerified?"ok":c.website?"pending":"missing"}`}>{websiteVerified?b.websiteVerified:c.website?b.websiteUnverified:`${b.websiteUnverified} · ${b.qualityMissing}`}</span><span className={`quality-chip ${c.country?"ok":"missing"}`}>{b.country}: {c.country?b.qualityPresent:b.qualityMissing}</span><span className={`quality-chip ${tier>=4?"ok":tier>=2?"pending":tier===1?"missing":"pending"}`}>{c.identity_status==="source_verified"?b.sourceVerified:c.identity_status==="fuzzy_candidate"?b.fuzzyCandidate:c.identity_status?b.unresolved:b.unresolved}</span></div></section>;})():null}</div>:<>
          <HotProductList locale={countryNameLanguage} onBuyer={openCompanyDetail} onProductClick={setProductBuyersProductId}/>
          {productBuyersProductId?<ProductBuyersPanel productId={productBuyersProductId} locale={countryNameLanguage} onBuyer={openCompanyDetail} onClose={()=>setProductBuyersProductId(null)}/>:null}
          <div className="discovery-heading"><div><span>IMPORTYETI · U.S. OCEAN IMPORTS</span><h2>{discoveryMode==="importer"?(countryNameLanguage==="zh-CN"?"哪些美国买家在采购这种商品？":"Which U.S. buyers purchase this product?"):(countryNameLanguage==="zh-CN"?"哪些来源国企业正在向美国买家供货？":"Which origin-country suppliers serve U.S. buyers?")}</h2><p>{localizedProduct} · HS {selectedProduct.hsCode} · {selectedMonths.join("、")}</p></div><div className="evidence-chip">A · {discoveryMode==="importer"?(countryNameLanguage==="zh-CN"?"目的国买家 → 来源国供货商":"Destination buyers → origin suppliers"):(countryNameLanguage==="zh-CN"?"来源国供货商 → 目的国买家":"Origin suppliers → destination buyers")}</div></div>
          <div className="company-query-tabs"><button className={discoveryMode==="importer"?"on":""} onClick={()=>{setDiscoveryMode("importer");setSelectedImporterId(null)}}><strong>{tradePartyCopy[countryNameLanguage].buyerSearch}</strong><small>{tradePartyCopy[countryNameLanguage].buyerHint}</small></button><button className={discoveryMode==="exporter"?"on":""} onClick={()=>{setDiscoveryMode("exporter");setSelectedImporterId(null)}}><strong>{tradePartyCopy[countryNameLanguage].supplierSearch}</strong><small>{tradePartyCopy[countryNameLanguage].supplierHint}</small></button></div>
          {discoveryState==="loading"&&discovery?<div className="discovery-refresh-indicator" role="status"><span className="query-spinner" />{monthPickerCopy[countryNameLanguage].updating}</div>:null}
          {companyMonthDataMissing?<div className="month-fallback"><span>!</span><div><strong>{!selectedMonths.length?monthPickerCopy[countryNameLanguage].noneSelected:selectedMonthsUncollected?formatCopy(coverageCopy[countryNameLanguage].uncollectedMessage,{months:selectedMonths.join("、")}):formatCopy(monthFallbackCopy[countryNameLanguage].missing,{months:selectedMonths.join("、")})}</strong>{latestCompanyMonth?<p>{formatCopy(monthFallbackCopy[countryNameLanguage].latest,{month:latestCompanyMonth})} {monthFallbackCopy[countryNameLanguage].question}</p>:<p>{monthFallbackCopy[countryNameLanguage].none}</p>}</div>{latestCompanyMonth?<button onClick={()=>{setSelectedMonths([latestCompanyMonth]);setSelectedImporterId(null)}}>{formatCopy(monthFallbackCopy[countryNameLanguage].view,{month:latestCompanyMonth})} →</button>:null}</div>:null}
          {discoveryMode==="exporter"&&discovery?.suppliers.length?<div className="exporter-results"><div className="section-step"><span>01</span><div><strong>{countryNameLanguage==="zh-CN"?"当前类目的已收录出口商":"Captured exporters for this category"}</strong><small>{countryNameLanguage==="zh-CN"?"官网与平台主页分开标记":"Websites and marketplace profiles are labeled separately"}</small></div></div>{discovery.suppliers.map((item,index)=>{let marketplaces:Array<{label?:string;url:string}>=[];try{marketplaces=JSON.parse(item.marketplace_urls||"[]")}catch{}const nationality=entityLocation(item);return <article className="exporter-row" key={item.id}><span className="supplier-rank">{String(index+1).padStart(2,"0")}</span><span className="exporter-identity"><strong>{item.name}</strong>{item.chinese_name?<small>{item.chinese_name}</small>:null}<span className="company-nationality"><b>{locationCopy[countryNameLanguage].companyNationality}</b>{nationality.flag} {nationality.country}</span><small><b>{locationCopy[countryNameLanguage].countryRegion}:</b> {entityLocationLine(item)}<br/>{item.address}</small><span className="exporter-web-presence">{item.website?<a href={item.website} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>{["verified_successor_site","verified_group_site"].includes(item.website_status)?locationCopy[countryNameLanguage].relatedSite:locationCopy[countryNameLanguage].verifiedSite}</a>:marketplaces.length?<>{marketplaces.slice(0,2).map(link=><a key={link.url} className="marketplace" href={link.url} target="_blank" rel="noreferrer">{link.label||"B2B"} ↗</a>)}<em>{locationCopy[countryNameLanguage].siteUnverified}</em></>:<em>{locationCopy[countryNameLanguage].siteMissing}</em>}</span></span><span><small>{countryNameLanguage==="zh-CN"?"进口客户":"Customers"}</small><b>{item.importer_count}</b></span><span><small>{countryNameLanguage==="zh-CN"?"关系历史提单":"Relationship BOLs"}</small><b>{Number(item.relationship_shipments||0).toLocaleString(countryNameLanguage)}</b></span><span><small>{countryNameLanguage==="zh-CN"?"页面历史总提单":"Profile BOLs"}</small><b>{Number(item.total_shipments||0).toLocaleString(countryNameLanguage)}</b></span><button className="exporter-open" onClick={()=>openCompanyDetail(item.id)} aria-label={countryNameLanguage==="zh-CN"?`查看 ${item.name} 详情`:`View ${item.name}`}>›</button></article>})}</div>:null}
          {discoveryState==="loading"&&!discovery?<div className="supplier-status"><span className="query-spinner" />{countryNameLanguage==="zh-CN"?"正在读取进口商、供应商和提单…":"Loading importers, suppliers and shipments…"}</div>:discovery?.suppliers.length?<>
            {discovery.suppliers.every(item=>!Number(item.selected_month_shipments))?<div className="coverage-notice"><strong>{countryNameLanguage==="zh-CN"?"有供应商历史关系，但所选类目与月份暂无逐票记录。":"Supplier relationships exist, but no stored BOLs match these months and this category."}</strong></div>:null}
            
            {discoveryMode==="importer"&&(discovery.importers||[]).every(item=>!Number(item.selected_month_shipments))?<div className="coverage-notice month-empty"><strong>{countryNameLanguage==="zh-CN"?`${selectedMonths.join("、")} 没有已落库的企业逐票记录`:`No captured company BOLs for ${selectedMonths.join(", ")}`}</strong></div>:null}
            {discoveryMode==="importer"?<div className="buyer-filter-bar"><span>{countryNameLanguage==="zh-CN"?"优先级":"Priority"}</span>{(["A","B","C"] as const).map(level=><label key={level} className={`filter-check filter-${level}`}><input type="checkbox" checked={buyerFilters[`level${level}`as"levelA"|"levelB"|"levelC"]} onChange={e=>setBuyerFilters(prev=>({...prev,[`level${level}`]:e.target.checked}))}/> <b>{level}</b></label>)}{[0,3,10,20,50].map(n=><label key={n} className={`filter-check ${buyerFilters.minShipments===n?"filter-on":""}`}><input type="radio" name="minShipments" checked={buyerFilters.minShipments===n} onChange={()=>setBuyerFilters(prev=>({...prev,minShipments:n}))}/> <small>{countryNameLanguage==="zh-CN"?`≥${n} 票`:`≥${n} BOLs`}</small></label>)}</div>:null}
            <div className="importer-list"><div className="section-step"><span>01</span><div><strong>{tradePartyCopy[countryNameLanguage].buyerRanking}</strong><small>{importerRanking==="composite"?rankingCopy[countryNameLanguage].method:(countryNameLanguage==="zh-CN"?"没有数值的企业不参与排名":"Companies without a value remain unranked")}</small></div></div><div className="ranking-control"><span>{rankingCopy[countryNameLanguage].rankBy}</span>{importerRankingOptions.map(value=><button key={value} className={importerRanking===value?"on":""} onClick={()=>setImporterRanking(value)}>{rankingCopy[countryNameLanguage][value]}</button>)}</div>{filteredDiscoveryImporters.map(item=>{const rank=importerRankPosition(item);const nationality=entityLocation(item);const partial=importerRanking==="composite"&&importerHasPartialScore(item);const priority=(item.priority as "A"|"B"|"C")||"C";const qualScore=(item as Record<string,unknown>).qualificationScore as number|undefined;const posFactors=(item as Record<string,unknown>).positiveFactors as string[]|undefined;const riskFactors=(item as Record<string,unknown>).riskFactors as string[]|undefined;const qualLabel=countryNameLanguage==="zh-CN"?"资质":"Qual";const posShort=posFactors?.slice(0,2).map(f=>f.includes("—")?f.split("—")[0].trim():f.slice(0,28)+(f.length>28?"…":""))||[];const riskShort=riskFactors?.slice(0,2).map(f=>f.includes("—")?f.split("—")[0].trim():f.slice(0,28)+(f.length>28?"…":""))||[];return <button key={item.id} className={`importer-row ${rank?"":"unranked"}`} onClick={()=>openCompanyDetail(item.id)}><span className="supplier-rank">{rank?String(rank).padStart(2,"0"):"—"}</span><span className="importer-name"><strong>{item.name}</strong><span className={`priority-badge priority-${priority}`}>{priority}</span>{qualScore!==undefined?<span className="qual-score">{qualLabel} {qualScore}</span>:null}<span className="company-nationality"><b>{locationCopy[countryNameLanguage].companyNationality}</b>{nationality.flag} {nationality.country}</span><small>{[nationality.admin1,nationality.city,item.address].filter(Boolean).join(" · ")}</small>{posShort.length||riskShort.length?<span className="qual-factors">{posShort.map((f,i)=><em key={`pos-${i}`} className="qual-positive">{f}</em>)}{riskShort.map((f,i)=><em key={`risk-${i}`} className="qual-risk">{f}</em>)}</span>:null}</span><span className="rank-basis"><small>{importerRanking==="composite"?rankingCopy[countryNameLanguage].score:(countryNameLanguage==="zh-CN"?"本次排名值":"Ranking value")}</small><b>{importerRankDisplay(item)}</b>{importerRanking==="composite"?<em className={partial?"partial":"complete"}>{partial?rankingCopy[countryNameLanguage].partial:rankingCopy[countryNameLanguage].complete}</em>:null}</span><span><small>{countryNameLanguage==="zh-CN"?"所选月重量 / 货柜":"Selected weight / containers"}</small><b>{item.selected_month_weight_kg?`${(item.selected_month_weight_kg/1000).toLocaleString(countryNameLanguage)} t / ${item.selected_month_containers}`:countryNameLanguage==="zh-CN"?"未采集逐票明细":"BOL details not captured"}</b></span><span><small>{countryNameLanguage==="zh-CN"?"历史总提单":"Historical BOLs"}</small><b>{item.relationship_shipments?`${Number(item.relationship_shipments).toLocaleString(countryNameLanguage)} ${countryNameLanguage==="zh-CN"?"票":"BOLs"}`:"—"}</b></span><span><small>{tradePartyCopy[countryNameLanguage].linkedSuppliers}</small><b>{item.supplier_count??0}</b></span><span><small>{countryNameLanguage==="zh-CN"?"机会分":"Opportunity"}</small><b>{scores?.buyers?.find(score=>score.entityId===item.id)?`${scores.buyers.find(score=>score.entityId===item.id)!.score} / 100`:"—"}</b></span><i>›</i></button>})}</div>
            <div className="section-step supplier-step"><span>02</span><div><strong>{selectedImporter?(countryNameLanguage==="zh-CN"?`${selectedImporter.name} 的海外供应商`:`Suppliers of ${selectedImporter.name}`):(countryNameLanguage==="zh-CN"?"点击进口商查看对应供应商":"Select an importer to reveal suppliers")}</strong><small>{selectedImporter?.suppliers|| (countryNameLanguage==="zh-CN"?"供应商仍保留完整提单证据":"Supplier cards retain the underlying evidence")}</small></div></div>
            {selectedImporter?<div className="supplier-result-list">{visibleDiscoverySuppliers.map((item,index)=><article className="supplier-result" key={item.id}><div className="supplier-rank">{String(index+1).padStart(2,"0")}</div><div className="supplier-identity"><div><strong>{item.name}</strong><span><b>{locationCopy[countryNameLanguage].countryRegion}:</b> {entityLocation(item).flag} {entityLocationLine(item)}<br/>{item.address}</span></div><div className="supplier-links"><a href={item.source_url} target="_blank" rel="noreferrer">ImportYeti ↗</a>{item.website?<a href={item.website} target="_blank" rel="noreferrer">Website ↗</a>:<span>{countryNameLanguage==="zh-CN"?"官网未获取":"No website"}</span>}</div></div><div className="supplier-kpis"><span><small>{countryNameLanguage==="zh-CN"?"选定月份提单":"Monthly BOLs"}</small><b>{item.selected_month_shipments||"—"}</b></span><span><small>{countryNameLanguage==="zh-CN"?"重量":"Weight"}</small><b>{item.selected_month_weight_kg?`${(item.selected_month_weight_kg/1000).toLocaleString(countryNameLanguage)} t`:"—"}</b></span><span><small>{countryNameLanguage==="zh-CN"?"柜量":"Containers"}</small><b>{item.selected_month_containers||"—"}</b></span><span><small>{countryNameLanguage==="zh-CN"?"估算运费":"Est. freight"}</small><b>{item.selected_month_freight_usd?money(item.selected_month_freight_usd):"—"}</b></span></div><div className="supplier-evidence"><p><strong>{countryNameLanguage==="zh-CN"?"服务的美国客户":"U.S. customers"}</strong>{item.top_importers||"—"}</p><p><strong>{countryNameLanguage==="zh-CN"?"常见货物":"Products"}</strong>{item.products||"—"}</p><span>{countryNameLanguage==="zh-CN"?`历史关系 ${item.relationship_shipments} 票 · 最近 ${item.latest_shipment_date||"—"}`:`${item.relationship_shipments} relationship shipments · latest ${item.latest_shipment_date||"—"}`}</span></div></article>)}</div>:null}
          </>:<div className="supplier-empty"><strong>{countryNameLanguage==="zh-CN"?"当前条件尚无已落库供应商":"No stored suppliers for this query"}</strong><span>{discovery?.reason|| (countryNameLanguage==="zh-CN"?"不会用国家统计或虚构企业填充结果。":"Country totals and fabricated companies are never substituted.")}</span></div>}</>}
        </section> : null}

        {activeView === "competitor-analysis" ? <section id="opportunity-scores" className={`opportunity-scores ${scoresState==="loading"?"loading-surface":""}`} aria-busy={scoresState==="loading"}>
          <div className="discovery-heading"><div><span>OPPORTUNITY ENGINE · {scores?.market?.version || "opportunity-v1"}</span><h2>{countryNameLanguage==="zh-CN"?"机会评分":"Opportunity scores"}</h2><p>{localizedProduct} · {localizedMarket} · {countryNameLanguage==="zh-CN"?"基于已落库逐票数据计算，不含外部调用":"Computed from stored BOL data; no external calls"}{scores?.buyer?` · ${countryNameLanguage==="zh-CN"?"买家":"buyer"}: ${scores.buyer.entityId}`:""}</p></div></div>
          {scoresState==="loading"&&!scores?<div className="supplier-status"><span className="query-spinner" />{countryNameLanguage==="zh-CN"?"正在计算机会评分…":"Computing opportunity scores…"}</div>:scoresState==="unavailable"?<div className="supplier-empty"><strong>{countryNameLanguage==="zh-CN"?"评分暂不可用":"Scores unavailable"}</strong></div>:scores?<div className="score-grid">{(scores.buyers?.length&&!scores.buyer)?<article className="score-card buyer-score-list"><div className="score-head"><div><span>{countryNameLanguage==="zh-CN"?"进口商机会评分":"Buyer opportunity scores"}</span><strong>{countryNameLanguage==="zh-CN"?"当前排名 Top 5 买家":"Top 5 ranked buyers"}</strong></div><b className="score-number">{scores.buyers[0].score}<small>#{1}</small></b></div><div className="score-factors">{(scores.buyers||[]).map((item,index)=>{(discovery?.importers||[]).find(buyer=>buyer.id===item.entityId)||{name:item.entityId};const name=((discovery?.importers||[]).find(buyer=>buyer.id===item.entityId)||{name:item.entityId}).name;return <button className="score-factor buyer-score-row" key={item.entityId} onClick={()=>openCompanyDetail(item.entityId)}><span><i>{String(index+1).padStart(2,"0")} · {name}</i><b>{item.score}<small>/100</small></b></span><em><i style={{width:`${item.factors[3]?.contribution||0}%`}} /></em><small>{item.factors[3]?.label||""} · {item.factors[3]?.contribution||0}</small></button>;})}</div><div className="score-foot"><span>{countryNameLanguage==="zh-CN"?"点击行查看企业详情与评分明细":"Click a row for company detail and factor breakdown"}</span></div></article>:null}{[["market",scores.market,countryNameLanguage==="zh-CN"?"市场评分":"Market score"],["product",scores.product,countryNameLanguage==="zh-CN"?"产品评分":"Product score"],scores.buyer?["buyer",scores.buyer,countryNameLanguage==="zh-CN"?"买家评分":"Buyer score"]:null].filter(Boolean).map(([key,item,title])=>item?<article className="score-card" key={key as string}><div className="score-head"><div><span>{title as string}</span><strong>{item.entityId}</strong></div><b className="score-number">{item.score}<small>/100</small></b></div><div className="score-factors">{(item as ScoredResult).factors.map(factor=><div className="score-factor" key={factor.id}><span><i>{factor.label}</i><b>{factor.value}</b></span><em><i style={{width:`${factor.contribution}%`}} /></em><small>{countryNameLanguage==="zh-CN"?"权重":"weight"} {factor.weight}% · +{factor.contribution}</small></div>)}</div><div className="score-foot"><span>{countryNameLanguage==="zh-CN"?"已计算":"computed"} {new Date(item.computedAt).toLocaleString(countryNameLanguage,{hour12:false})}</span><b>{countryNameLanguage==="zh-CN"?"0-100 分":"score 0-100"}</b></div></article>:null)}</div>:null}
        </section> : null}

        {activeView === "watchlist" ? <section id="buyer-watchlist" className="buyer-watchlist" aria-busy={watchlistState==="loading"}>
          <div className="discovery-heading"><div><span>SALES EXECUTION</span><h2>{countryNameLanguage==="zh-CN"?"销售 Lead 工作台":"Sales lead workbench"}</h2><p>{countryNameLanguage==="zh-CN"?`已保存 ${watchlist.length} 家潜在客户 · 联系证据、开发策略与跟进动作集中管理`:`${watchlist.length} saved prospects · contacts, strategy, and follow-up in one place`}</p></div></div>
          <LeadWorkbench items={watchlist} loading={watchlistState==="loading"} locale={countryNameLanguage} onUpdate={updateWatchlist} onRemove={removeFromWatchlist} onOpenCompany={openCompanyDetail}/>
        </section> : null}

        {activeView === "data-sources" ? <section id="data-sources" className="data-pipeline" aria-label={tr("dataSources")}>
          <div className="pipeline-head"><div><span className="eyebrow-mini">DATA SOURCE</span><h2>{tr("dataSources")}</h2></div><small>{tr("fetched")}: {trade ? new Date(trade.fetchedAt).toLocaleString(countryNameLanguage, { hour12: false }) : "—"}{trade ? ` · ${trade.cache.hit ? tr("cached") : tr("realtime")}` : ""}</small></div>
          <div className="pipeline-grid compact-pipeline"><article className={trade ? "ready" : "pending"}><span>01</span><div><strong>{tr("officialSource")}</strong><small>{trade ? `${trade.access} · ${tr("actualPeriod")} ${trade.period}` : tr("noData")}</small></div><b>{trade ? tr("available") : tr("noData")}</b></article><article className={trade ? "available" : "pending"}><span>02</span><div><strong>{tr("exportSeries")}</strong><small>{tr("exportSeriesDetail")}</small></div><button className="pipeline-export" disabled={!trade} onClick={exportOfficialCsv}>{tr("exportSeriesButton")}</button></article><article className={trade?.partners.length ? "available" : "pending"}><span>03</span><div><strong>{tr("exportPartners")}</strong><small>{tr("exportPartnersDetail")}</small></div><button className="pipeline-export" disabled={!trade?.partners.length} onClick={exportPartnerCsv}>{tr("exportPartnersButton")}</button></article></div>
        </section> : null}
        <footer><span>TradeScope · {tr("internalTool")}</span><div><span className="grade a">A</span> {tr("officialGrade")} <span className="grade b">B</span> {tr("calculatedGrade")}</div></footer>
      </div>
    </section>
  </main>;
}
