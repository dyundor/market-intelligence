import type { LeadRecord } from "../qualification/types.ts";

export function shouldInitializeSalesLead(input:{existing:boolean;identityStatus:string;identityConfidence:number|null;evidenceShipments:number;lead:LeadRecord}){
  if(input.existing)return{selected:true,reason:"existing_watchlist" as const};
  if(input.identityStatus!=="source_verified"||(input.identityConfidence??0)<80)return{selected:false,reason:"identity_not_ready" as const};
  if(input.evidenceShipments<3)return{selected:false,reason:"insufficient_trade_evidence" as const};
  if(input.lead.outreachStrategy==="Research Only")return{selected:false,reason:"research_only" as const};
  if(input.lead.commercialFitScore<35||input.lead.outreachScore<35)return{selected:false,reason:"commercial_threshold" as const};
  return{selected:true,reason:"sales_threshold" as const};
}

const STAGE_PRIORITY:Record<string,number>={opportunity:0,qualified:1,follow_up:2,contact_ready:3,contacted:4,researching:5,new:6};

export function sortSalesLeads<T extends {leadStatus:string|null;outreachScore:number|null;commercialFitScore:number|null;company?:{name:string}|null}>(items:T[]):T[]{
  return [...items].sort((left,right)=>(STAGE_PRIORITY[left.leadStatus||"new"]??9)-(STAGE_PRIORITY[right.leadStatus||"new"]??9)||(right.outreachScore??-1)-(left.outreachScore??-1)||(right.commercialFitScore??-1)-(left.commercialFitScore??-1)||(left.company?.name||"").localeCompare(right.company?.name||""));
}
