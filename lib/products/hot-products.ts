import { computeConfidence, type DataConfidence } from "../data-confidence.ts";

export interface ProductShipmentEvidence { id:string; importer_id:string|null; importer_name:string|null; product_description:string|null; shipment_date:string|null; weight_kg:number|null }
export interface RepresentativeProduct { title:string;brand:string;productUrl:string;imageUrl:string|null;sourceName:string }
export interface HotProduct { id:string;name:string;nameEn:string;shipments:number;buyers:number;weightKg:number;latestShipmentDate:string|null;recentShipments:number;heatScore:number;topBuyers:Array<{id:string;name:string;shipments:number}>;sampleDescriptions:string[];productSearchUrl:string;imageSearchUrl:string;representativeProduct:RepresentativeProduct|null;confidence:DataConfidence }

export interface EnrichedProductBuyer {
  id:string;name:string;shipments:number;weightKg:number;latestShipmentDate:string|null;
  identityStatus:string|null;identityConfidence:number|null;identityNotes:string|null;
  website:string|null;websiteStatus:string|null;country:string|null;
  leadStatus:string|null;outreachStrategy:string|null;commercialFitScore:number|null;outreachScore:number|null;
  recommendedProducts:string|null;hasVerifiedContact:boolean;
  excluded:boolean;exclusionReason:string|null;
}

export interface ProductBuyerPayload {
  productId:string;productName:string;productNameEn:string;
  totalShipments:number;totalBuyers:number;
  buyers:EnrichedProductBuyer[];
}

export const REPRESENTATIVE_PRODUCTS:Record<string,RepresentativeProduct>={
  shower_tray:{title:"SlimLine acrylic shower base",brand:"DreamLine",productUrl:"https://dreamline.com/product/dreamline-slimline-36-inch-d-x-48-inch-w-x-2-3-4-inch-h-double-threshold-shower-base/dlt-103648/dlt-1036481",imageUrl:"https://res.cloudinary.com/american-bath-group/image/upload/v1743706537/websites-product-info-and-content/dreamline/content/homepage/dreamline-homepage-recommended-slimline-neo-shower-base-and-shower-backwall-kit?_a=BAVMn6DY0",sourceName:"DreamLine official product page"},
  bathtub:{title:"Studio 60 × 36-inch drop-in bathtub",brand:"American Standard",productUrl:"https://www.americanstandard-us.com/products/studio-r-60-x-36-inch-drop-in-bathtub-with-2-inch-edge",imageUrl:"https://cdn.shopify.com/s/files/1/0609/8567/1727/files/259172_P-2934002D2020_CDNwebp.webp?v=1744842709",sourceName:"American Standard official product page"},
  shower_door:{title:"Unidoor frameless hinged shower door",brand:"DreamLine",productUrl:"https://dreamline.com/unidoor-collection",imageUrl:"https://res.cloudinary.com/american-bath-group/image/upload/v1752095394/websites-product-info-and-content/dreamline/content/products/collections/unidoor/dreamline-unidoor-search-page-thumbnail.jpg",sourceName:"DreamLine official collection page"},
  bathroom_faucet:{title:"Lahara single-handle bathroom faucet",brand:"Delta",productUrl:"https://www.deltafaucet.com/bathroom/product/538-CZMPU-DST.html",imageUrl:"https://www.deltafaucet.com/dw/image/v2/bfjj_PRD/on/demandware.static/-/Sites-delta-master-catalog/default/images/large/538-CZMPU-DST-B1.png?sw=800",sourceName:"Delta official product page"},
  faucet_parts:{title:"Bathroom Faucet Parts & Cartridges",brand:"American Standard",productUrl:"https://www.americanstandard-us.com/collections/bathroom-faucet-parts-list",imageUrl:"https://cdn.shopify.com/s/files/1/0609/8567/1727/files/175556_012316-0070A_0_CDNwebp.webp?v=1774636091",sourceName:"American Standard official parts page"},
  shower_system:{title:"Shower Heads & Hand Showers",brand:"Delta",productUrl:"https://www.deltafaucet.com/bathroom/showering/showerheads-hand-showers",imageUrl:"https://www.deltafaucet.com/dw/image/v2/bfjj_PRD/on/demandware.static/-/Sites-delta-master-catalog/default/dw08ab79a8/images/large/74B430-B1.png",sourceName:"Delta official category page"},
  backwall:{title:"QWALL-VS Acrylic Shower Wall Kit",brand:"DreamLine",productUrl:"https://dreamline.com/product/dreamline-qwall-vs-28-32-inch-w-x-41-1-2-inch-d-x-76-inch-h-acrylic-wall-kit/shbw-1532760/shbw-1532760-00",imageUrl:null,sourceName:"DreamLine official product page"},
  drain:{title:"Toe Tapper Drain Assembly",brand:"American Standard",productUrl:"https://www.americanstandard-us.com/products/753980-200-0110a-toe-tapper-drain-assembly",imageUrl:null,sourceName:"American Standard official product page"},
  valve:{title:"MultiChoice Universal Rough-In Valve",brand:"Delta",productUrl:"https://www.deltafaucet.com/outlet/recertified/bathroom/rough-valves",imageUrl:null,sourceName:"Delta official valves page"},
};

export const SALES_PRODUCTS=[
  {id:"bathroom_faucet",name:"浴室水龙头",nameEn:"Bathroom faucets",patterns:[/\bfaucet(s)?\b/i,/\bbasin faucet/i,/\bmixer faucet/i],exclude:[/kitchen faucet/i,/faucet (accessor|part|spo)/i]},
  {id:"faucet_parts",name:"龙头配件与零件",nameEn:"Faucet parts & accessories",patterns:[/faucet (accessor|part|spo)/i,/spout/i]},
  {id:"shower_tray",name:"淋浴底盆",nameEn:"Shower trays",patterns:[/shower\s*tray/i,/shower base/i,/acrylic base/i]},
  {id:"bathtub",name:"浴缸",nameEn:"Bathtubs",patterns:[/bathtub/i,/\bbath tub/i]},
  {id:"shower_door",name:"淋浴房与淋浴门",nameEn:"Shower doors & enclosures",patterns:[/shower door/i,/shower room/i,/shower enclosure/i,/tempered glass/i,/toughened.*glass/i]},
  {id:"shower_system",name:"花洒与淋浴系统",nameEn:"Shower heads & systems",patterns:[/shower head/i,/shower panel/i,/hand shower/i,/shower system/i,/shower hose/i]},
  {id:"backwall",name:"淋浴背板与墙板",nameEn:"Shower backwalls & panels",patterns:[/backwall/i,/glass panel/i]},
  {id:"drain",name:"浴缸与淋浴排水件",nameEn:"Bath & shower drains",patterns:[/drain(er)?/i,/strainer/i]},
  {id:"valve",name:"卫浴阀门",nameEn:"Bathroom valves",patterns:[/\bvalve(s)?\b/i]},
];

export function classifySalesProducts(description:string):string[]{
  return SALES_PRODUCTS.filter(product=>product.patterns.some(pattern=>pattern.test(description))&&!product.exclude?.some(pattern=>pattern.test(description))).map(product=>product.id);
}

function monthIndex(value:string):number{return Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;}

export function rankHotProducts(rows:ProductShipmentEvidence[]):HotProduct[]{
  const latest=rows.map(row=>row.shipment_date||"").filter(Boolean).sort().at(-1)||"";
  const recentFloor=latest?monthIndex(latest)-11:0;
  const rowCategories=rows.map(row=>classifySalesProducts(row.product_description||""));
  const totalRecords=rows.length;
  const dataSource="stored_us_ocean_import_shipments";
  const aggregates=SALES_PRODUCTS.map(product=>{
    const matched:ProductShipmentEvidence[]=[];let mixedCount=0;
    for(let i=0;i<rows.length;i++)if(rowCategories[i].includes(product.id)){matched.push(rows[i]);if(rowCategories[i].length>1)mixedCount++;}
    const buyers=new Map<string,{id:string;name:string;shipments:number}>();
    for(const row of matched)if(row.importer_id){const current=buyers.get(row.importer_id)||{id:row.importer_id,name:row.importer_name||row.importer_id,shipments:0};current.shipments+=1;buyers.set(row.importer_id,current);}
    const recent=matched.filter(row=>row.shipment_date&&monthIndex(row.shipment_date)>=recentFloor).length;
    const weight=matched.reduce((sum,row)=>sum+Number(row.weight_kg||0),0);
    const query=`${product.nameEn} wholesale supplier North America`;
    const confidence=computeConfidence({shipmentRecords:totalRecords,matchedRecords:matched.length,mixedRecords:mixedCount,categories:1,lastUpdated:latest,dataSource});
    return {id:product.id,name:product.name,nameEn:product.nameEn,shipments:matched.length,buyers:buyers.size,weightKg:weight,latestShipmentDate:matched.map(row=>row.shipment_date||"").filter(Boolean).sort().at(-1)||null,recentShipments:recent,topBuyers:[...buyers.values()].sort((a,b)=>b.shipments-a.shipments).slice(0,5),sampleDescriptions:[...new Set(matched.map(row=>row.product_description||"").filter(Boolean))].slice(0,5),productSearchUrl:`https://www.google.com/search?q=${encodeURIComponent(query)}`,imageSearchUrl:`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,representativeProduct:REPRESENTATIVE_PRODUCTS[product.id]||null,confidence};
  }).filter(product=>product.shipments>0);
  const maxRecent=Math.max(1,...aggregates.map(product=>product.recentShipments));
  const maxBuyers=Math.max(1,...aggregates.map(product=>product.buyers));
  const maxWeightLog=Math.max(1,...aggregates.map(product=>Math.log10(Math.max(1,product.weightKg))));
  return aggregates.map(product=>({...product,heatScore:Math.round(product.recentShipments/maxRecent*55+product.buyers/maxBuyers*30+Math.log10(Math.max(1,product.weightKg))/maxWeightLog*15)})).sort((a,b)=>b.heatScore-a.heatScore||b.recentShipments-a.recentShipments||b.buyers-a.buyers);
}

export interface ProductBuyerAggregate {
  importerId:string;importerName:string;shipments:number;weightKg:number;latestShipmentDate:string|null;
}

export function aggregateProductBuyers(rows:ProductShipmentEvidence[],productId:string):ProductBuyerAggregate[]{
  const product=SALES_PRODUCTS.find(p=>p.id===productId);
  if(!product)return [];
  const matched=rows.filter(row=>classifySalesProducts(row.product_description||"").includes(product.id));
  const buyers=new Map<string,ProductBuyerAggregate>();
  for(const row of matched){
    if(!row.importer_id)continue;
    const current=buyers.get(row.importer_id)||{importerId:row.importer_id,importerName:row.importer_name||row.importer_id,shipments:0,weightKg:0,latestShipmentDate:null};
    current.shipments+=1;
    current.weightKg+=Number(row.weight_kg||0);
    if(row.shipment_date&&(!current.latestShipmentDate||row.shipment_date>current.latestShipmentDate))current.latestShipmentDate=row.shipment_date;
    buyers.set(row.importer_id,current);
  }
  return [...buyers.values()].sort((a,b)=>b.shipments-a.shipments);
}

function isExcludedIdentity(identityStatus:string|null):{excluded:boolean;exclusionReason:string|null}{
  if(!identityStatus)return{excluded:false,exclusionReason:null};
  if(identityStatus==="confirmed_manufacturer")return{excluded:true,exclusionReason:"同行制造商 — 不宜作为客户开发"};
  if(identityStatus==="likely_manufacturer")return{excluded:true,exclusionReason:"疑似同行制造商 — 暂不宜开发"};
  if(identityStatus==="defunct")return{excluded:true,exclusionReason:"已停业"};
  if(identityStatus==="acquired")return{excluded:true,exclusionReason:"已被收购 — 主体不再独立运营"};
  if(identityStatus==="ambiguous")return{excluded:true,exclusionReason:"身份模糊 — 待进一步确认"};
  if(identityStatus==="fuzzy_candidate")return{excluded:true,exclusionReason:"疑似同名企业 — 身份未确认"};
  if(identityStatus==="unresolved")return{excluded:true,exclusionReason:"身份待人工确认"};
  return{excluded:false,exclusionReason:null};
}

export function enrichProductBuyers(
  aggregates:ProductBuyerAggregate[],
  entities:Array<{id:string;name:string;identity_status:string|null;identity_confidence:number|null;identity_notes:string|null;website:string|null;website_status:string|null;country:string|null}>,
  watchlist:Array<{company_id:string;lead_status:string|null;outreach_strategy:string|null;commercial_fit_score:number|null;outreach_score:number|null;recommended_products:string|null}>,
  verifiedContacts:Set<string>,
):EnrichedProductBuyer[]{
  const entityMap=new Map(entities.map(e=>[e.id,e]));
  const watchlistMap=new Map(watchlist.map(w=>[w.company_id,w]));
  return aggregates.map(agg=>{
    const entity=entityMap.get(agg.importerId);
    const watch=watchlistMap.get(agg.importerId);
    const exclusion=entity?isExcludedIdentity(entity.identity_status):{excluded:false,reason:null};
    return {
      id:agg.importerId,
      name:entity?.name||agg.importerName,
      shipments:agg.shipments,
      weightKg:agg.weightKg,
      latestShipmentDate:agg.latestShipmentDate,
      identityStatus:entity?.identity_status||null,
      identityConfidence:entity?.identity_confidence||null,
      identityNotes:entity?.identity_notes||null,
      website:entity?.website||null,
      websiteStatus:entity?.website_status||null,
      country:entity?.country||null,
      leadStatus:watch?.lead_status||null,
      outreachStrategy:watch?.outreach_strategy||null,
      commercialFitScore:watch?.commercial_fit_score||null,
      outreachScore:watch?.outreach_score||null,
      recommendedProducts:watch?.recommended_products||null,
      hasVerifiedContact:verifiedContacts.has(agg.importerId),
      ...exclusion,
    };
  }).sort((a,b)=>{
    if(a.excluded!==b.excluded)return a.excluded?1:-1;
    const aScore=(a.identityStatus==="source_verified"?3:0)+(a.hasVerifiedContact?2:0)+(a.commercialFitScore&&a.commercialFitScore>=35?1:0);
    const bScore=(b.identityStatus==="source_verified"?3:0)+(b.hasVerifiedContact?2:0)+(b.commercialFitScore&&b.commercialFitScore>=35?1:0);
    if(aScore!==bScore)return bScore-aScore;
    return b.shipments-a.shipments;
  });
}
