export interface ProductShipmentEvidence { id:string; importer_id:string|null; importer_name:string|null; product_description:string|null; shipment_date:string|null; weight_kg:number|null }
export interface HotProduct { id:string;name:string;nameEn:string;shipments:number;buyers:number;weightKg:number;latestShipmentDate:string|null;recentShipments:number;heatScore:number;topBuyers:string[];sampleDescriptions:string[];productSearchUrl:string;imageSearchUrl:string }

const SALES_PRODUCTS=[
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
  const aggregates=SALES_PRODUCTS.map(product=>{
    const matched=rows.filter(row=>classifySalesProducts(row.product_description||"").includes(product.id));
    const buyers=new Map<string,{name:string;shipments:number}>();
    for(const row of matched)if(row.importer_id){const current=buyers.get(row.importer_id)||{name:row.importer_name||row.importer_id,shipments:0};current.shipments+=1;buyers.set(row.importer_id,current);}
    const recent=matched.filter(row=>row.shipment_date&&monthIndex(row.shipment_date)>=recentFloor).length;
    const weight=matched.reduce((sum,row)=>sum+Number(row.weight_kg||0),0);
    const query=`${product.nameEn} wholesale supplier North America`;
    return {id:product.id,name:product.name,nameEn:product.nameEn,shipments:matched.length,buyers:buyers.size,weightKg:weight,latestShipmentDate:matched.map(row=>row.shipment_date||"").filter(Boolean).sort().at(-1)||null,recentShipments:recent,topBuyers:[...buyers.values()].sort((a,b)=>b.shipments-a.shipments).slice(0,5).map(item=>item.name),sampleDescriptions:[...new Set(matched.map(row=>row.product_description||"").filter(Boolean))].slice(0,5),productSearchUrl:`https://www.google.com/search?q=${encodeURIComponent(query)}`,imageSearchUrl:`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`};
  }).filter(product=>product.shipments>0);
  const maxRecent=Math.max(1,...aggregates.map(product=>product.recentShipments));
  const maxBuyers=Math.max(1,...aggregates.map(product=>product.buyers));
  const maxWeightLog=Math.max(1,...aggregates.map(product=>Math.log10(Math.max(1,product.weightKg))));
  return aggregates.map(product=>({...product,heatScore:Math.round(product.recentShipments/maxRecent*55+product.buyers/maxBuyers*30+Math.log10(Math.max(1,product.weightKg))/maxWeightLog*15)})).sort((a,b)=>b.heatScore-a.heatScore||b.recentShipments-a.recentShipments||b.buyers-a.buyers);
}
