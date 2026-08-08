#!/usr/bin/env node
/**
 * Sprint 14.21 — Sales Strategy Intelligence
 *
 * Final layer: HOW to approach each buyer.
 * Combines all intelligence layers into actionable sales recommendations.
 */

const HH="=".repeat(110),HR="─".repeat(110);

// ═══ Full intelligence pipeline (inline) ═══
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
const TYPE_PATTERNS={Distributor:[/distribution/i,/supply co/i,/wholesale/i,/supplies/i,/building supply/i],Manufacturer:[/manufactur/i,/industrial/i,/factory/i,/mfg/i,/production/i],Retailer:[/retail/i,/store/i,/shop/i,/mart/i,/home center/i],Trading:[/trade/i,/trading/i,/import export/i,/international/i],BrandOwner:[/inc$/i,/corp/i,/llc$/i,/ltd$/i,/group$/i,/brands?$/i,/collection$/i,/designs?$/i]};
function companyType(n){const l=n.toLowerCase();for(const[t,p]of Object.entries(TYPE_PATTERNS))for(const x of p)if(x.test(l))return t==="BrandOwner"?"Brand Owner":t==="Trading"?"Trading Company":t;return"Importer";}

function fitScore(c){
  const ct=companyType(c.name);let s=0;
  let oem=50;if(ct==="Brand Owner")oem=95;else if(ct==="Distributor")oem=85;else if(ct==="Retailer")oem=70;else if(ct==="Trading Company")oem=65;else if(ct==="Manufacturer")oem=20;s+=oem*0.25;
  let pl=50;if(ct==="Brand Owner"&&c.s>=100)pl=90;else if(ct==="Distributor")pl=75;else if(ct==="Brand Owner")pl=70;else pl=30;s+=pl*0.20;
  let cs=c.cc>0?90:30;s+=cs*0.20;
  let mm=60;if(c.s>=100&&c.s<=1000)mm=95;else if(c.s>1000)mm=70;else if(c.s>=50)mm=60;else mm=30;s+=mm*0.20;
  let cr=85;if(ct==="Manufacturer")cr=40;if(c.s>2000)cr-=15;if(c.bt==="General Plumbing")cr-=10;s+=Math.max(0,cr)*0.15;
  return Math.round(s);
}
function contactability(c){
  let s=0;const n=c.name.toLowerCase();
  let nq=/^[a-z0-9 &.,'-]+$/i.test(c.name)?90:30;s+=nq*0.25;
  let ta=c.ct==="Brand Owner"||c.ct==="Retailer"?90:c.ct==="Distributor"?75:c.ct==="Trading Company"?55:c.ct==="Manufacturer"?40:50;s+=ta*0.25;
  let sv=c.s>=500?85:c.s>=100?65:40;s+=sv*0.25;
  let od=c.cc>0?80:45;if(c.ct==="Manufacturer")od-=20;if(c.s>2000)od-=10;s+=Math.max(0,od)*0.25;
  return Math.round(s);
}

// ═══ Sales Strategy (Sprint 14.21) ═══
function salesStrategy(c){
  const ct=c.ct,fit=c.fit,s=c.s,cn=c.cc;

  if(fit>=75&&ct==="Brand Owner"&&cn)return{strat:"OEM/ODM Pitch",reason:"品牌方+已有中国采购 — 最理想的 OEM 客户",product:"Full Bathroom Collection"};
  if(fit>=70&&(ct==="Brand Owner"||ct==="Distributor"))return{strat:"OEM/ODM Pitch",reason:`${ct} — 高 OEM 潜力`,product:"Full Bathroom Collection"};
  if(fit>=70)return{strat:"Private Label Pitch",reason:"高商业匹配 — 推荐私有品牌合作",product:"Basin Faucets + Shower Systems"};

  if(ct==="Distributor"&&s>=500)return{strat:"Distribution Partnership",reason:"大型分销商 — 建立长期供应关系",product:"Full Bathroom Collection"};
  if(ct==="Retailer")return{strat:"Private Label Pitch",reason:"零售商 — 适合贴牌供货",product:"Basin Faucets"};
  if(ct==="Trading Company"&&cn)return{strat:"Private Label Pitch",reason:"贸易公司+中国采购 — 弹性大",product:"Basin Faucets + Shower Systems"};

  if(ct==="Manufacturer")return{strat:"Research Only",reason:"制造商 — 可能是竞争者，低 OEM 需求",product:"Monitor Only"};
  if(s<100)return{strat:"Research Only",reason:"规模较小 — 优先观察",product:"Basin Faucets"};
  if(c.bt==="General Plumbing"&&s>=500)return{strat:"Distribution Partnership",reason:"大型通用管道买家 — 分销合作",product:"Full Bathroom Collection"};

  return{strat:"Private Label Pitch",reason:"中等匹配 — 贴牌机会",product:"Basin Faucets + Shower Systems"};
}

function riskAssessment(c){
  const risks=[];
  if(c.ct==="Manufacturer")risks.push("可能竞争");
  if(c.bt.includes("Mixed")||c.bt.includes("Kitchen"))risks.push("混合品类，需确认浴室需求占比");
  if(c.s>2000)risks.push("大客户，已有供应商关系");
  if(!c.cc)risks.push("无已知中国采购经验");
  if(c.s<50)risks.push("太小，业务风险高");
  if(!risks.length)risks.push("无明显风险");
  return risks.join("; ");
}

// ═══ 37 buyers ═══
const companies=[{name:"Waxman Consumer Products Group",s:943,sc:1,cc:1,bt:"General Plumbing"},{name:"Rgm Distribution",s:641,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Am Conservation Group",s:1187,sc:1,cc:1,bt:"General Plumbing"},{name:"Stellar Innovations Group",s:878,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Best Mart",s:858,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Gisela Supplies",s:940,sc:1,cc:0,bt:"General Plumbing"},{name:"Jr Fast Trade",s:185,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Qingyuan Trade",s:137,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Flourishing Household",s:700,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Etl",s:411,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Pioneer Industries",s:295,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Crestwind Innovations",s:287,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Water Safety",s:653,sc:1,cc:1,bt:"General Plumbing"},{name:"Afs Advantage",s:615,sc:1,cc:1,bt:"General Plumbing"},{name:"Service Partners Supply",s:104,sc:1,cc:1,bt:"General Plumbing"},{name:"Smart Design Usa",s:290,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Elevate Building Supply",s:79,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Flying Bird Trade",s:2074,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Josaur Tradind",s:1755,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Yangyang Fashion Technology",s:1299,sc:1,cc:1,bt:"Mixed Bathroom/Kitchen"},{name:"Bestuhom",s:85,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Torenfonder Enterprises",s:60,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Delta Faucet",s:6096,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Interlink Products International",s:536,sc:1,cc:0,bt:"General Plumbing"},{name:"Minea Electrical Appliance C",s:440,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Perfetto Kitchen And Bath",s:360,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Sturgeon",s:176,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Everpeak",s:134,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Sr Sunrise Sanitary",s:111,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Kes Hili",s:1171,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Tb Philly",s:90,sc:1,cc:0,bt:"Mixed Bathroom/Kitchen"},{name:"Mega Lion",s:56,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Shower Enclosures America",s:2016,sc:1,cc:0,bt:"General Plumbing"},{name:"Savoy Brass Mfg",s:79,sc:1,cc:1,bt:"Bathroom Specialist"},{name:"Lechang Industrial",s:158,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"Golden Industrial Supply",s:146,sc:1,cc:0,bt:"Bathroom Specialist"},{name:"D&L Supply And Mfg",s:43,sc:1,cc:1,bt:"Bathroom Specialist"}];

for(const c of companies){
  c.ct=companyType(c.name);
  c.fit=fitScore(c);
  c.con=contactability(c);
  c.out=Math.round(c.fit*0.6+c.con*0.4);
  const ss=salesStrategy(c);c.strat=ss.strat;c.prodRec=ss.product;c.stratReason=ss.reason;
  c.risk=riskAssessment(c);
}

const sorted=[...companies].sort((a,b)=>b.out-a.out||b.fit-a.fit);
const top20=sorted.slice(0,20);

// ═══ REPORT ═══
console.log(HH);
console.log("SPRINT 14.21 — SALES STRATEGY INTELLIGENCE");
console.log(HH);
console.log("37 buyers · Full pipeline: Qualification → Commercial → Outreach → Strategy · "+new Date().toISOString());

// 1. TOP 20 PROSPECTS
console.log();
console.log(HR);
console.log("1. TOP 20 YUNDOR PROSPECTS — Final Sales List");
console.log(HR);
console.log();
console.log("  #  Company                      Out  Fit  Con  Strategy                 Product                    CN  Risk");
console.log("  "+"─".repeat(103));
for(let i=0;i<top20.length;i++){
  const c=top20[i];
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,29).padEnd(30)}${String(c.out).padEnd(5)}${String(c.fit).padEnd(5)}${String(c.con).padEnd(5)}${c.strat.padEnd(25)}${c.prodRec.padEnd(27)}${c.cc?"✓":"✗"}  ${c.risk.slice(0,35)}`);
}

// 2. BY STRATEGY
console.log();
console.log(HR);
console.log("2. SALES STRATEGY BREAKDOWN");
console.log(HR);
const st={};
sorted.forEach(c=>{st[c.strat]=(st[c.strat]||[]);st[c.strat].push(c);});
for(const[strat,buyers]of Object.entries(st)){
  console.log(`\n  ${strat} (${buyers.length} buyers):`);
  for(const c of buyers.slice(0,5)){
    console.log(`    ${c.name.padEnd(35)} Out: ${c.out} · ${c.s} BOLs · ${c.ct} · → ${c.stratReason}`);
  }
  if(buyers.length>5)console.log(`    ... +${buyers.length-5} more`);
}

// 3. DETAILED APPROACH — Top 10
console.log();
console.log(HR);
console.log("3. DETAILED APPROACH — Top 10 Prospects");
console.log(HR);
for(let i=0;i<10;i++){
  const c=top20[i];
  console.log(`\n  ┌─ #${i+1} ${c.name}`);
  console.log(`  │  Final Score:   ${c.out}/100  (Fit: ${c.fit} + Contact: ${c.con})`);
  console.log(`  │  Company:       ${c.ct} · ${c.bt} · ${c.s} BOLs`);
  console.log(`  │  Why contact:   ${c.stratReason}`);
  console.log(`  │  Approach:      ${c.strat}`);
  console.log(`  │  Product:       ${c.prodRec}`);
  console.log(`  │  Risk:          ${c.risk}`);
  console.log(`  └`);
}

// 4. STRATEGY DISTRIBUTION
console.log();
console.log(HR);
console.log("4. STRATEGY DISTRIBUTION");
console.log(HR);
for(const[strat,buyers]of Object.entries(st)){
  const avgOut=Math.round(buyers.reduce((s,c)=>s+c.out,0)/buyers.length);
  console.log(`  ${strat.padEnd(28)} ${String(buyers.length).padStart(2)} buyers  ·  avg outreach: ${avgOut}`);
}

// 5. CREDIT
console.log();
console.log(HH);
console.log("5. CREDIT REPORT");
console.log(HH);
console.log();
console.log("  No API · 0 credits · Balance: 90.1 · Reserve: 80");
console.log();
console.log("  Complete intelligence pipeline:");
console.log("    Sprint 14.12 — Product Match + Buyer Type");
console.log("    Sprint 14.13 — Supplier Intelligence");
console.log("    Sprint 14.17 — Buyer Size Tier + Qualification");
console.log("    Sprint 14.19 — Commercial Fit + Company Type");
console.log("    Sprint 14.20 — Contactability + Outreach Score");
console.log("    Sprint 14.21 — Sales Strategy + Product Recommendation");
console.log();
