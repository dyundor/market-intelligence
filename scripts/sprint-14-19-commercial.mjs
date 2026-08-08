#!/usr/bin/env node
/**
 * Sprint 14.19 — Commercial Fit Intelligence Layer
 *
 * Adds business-fit scoring on top of technical qualification.
 * "Who is big" → "Who is suitable for Yundor OEM/ODM"
 */

// ═══ Technical scoring (same as Sprint 14.17) ═══
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function ratioScale(v,b){if(b<=0)return 0;return clamp(Math.round(100*Math.min(v,b)/b),0,100);}
function tierShip(s){if(s>=500)return{val:100,t:"Enterprise"};if(s>=100)return{val:70,t:"Mid-market"};if(s>=20)return{val:40,t:"Small"};return{val:15,t:"Small"};}
function priority(s){return s>=65?'A':s>=35?'B':'C';}
function classPM(pd){const t=pd.join(" ").toLowerCase();if(!t)return"M";const b=["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer","vessel"].filter(k=>t.includes(k)).length;return b>=2?"H":b>=1?"M":"L";}
function classBT(pd,n){const t=[...pd,n].join(" ").toLowerCase();const b=["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer"].filter(k=>t.includes(k)).length;const k=["kitchen"].filter(k=>t.includes(k)).length;if(b>=2&&k===0)return"Bathroom Specialist";if(b>=1&&k>=1)return"Mixed Bathroom/Kitchen";return"General Plumbing";}
const CH=[/china/i,/chinese/i,/shenzhen/i,/guangzhou/i,/shanghai/i,/ningbo/i,/yiwu/i,/foshan/i,/dongguan/i,/xiamen/i,/tianjin/i,/crescent/i,/regent/i,/rin shing/i];

// ═══ Company Type (Sprint 14.19) ═══
const TYPE_PATTERNS={
  "Distributor":[/distribution/i,/supply co/i,/wholesale/i,/supplies/i,/building supply/i],
  "Manufacturer":[/manufactur/i,/industrial/i,/factory/i,/mfg/i,/production/i],
  "Retailer":[/retail/i,/store/i,/shop/i,/mart/i,/home center/i],
  "Trading Company":[/trade/i,/trading/i,/import export/i,/international/i],
  "Brand Owner":[/inc$/i,/corp/i,/llc$/i,/ltd$/i,/group$/i,/brands?$/i,/collection$/i,/designs?$/i],
};
function classifyCompanyType(name){
  const n=name.toLowerCase();
  for(const [type,pats] of Object.entries(TYPE_PATTERNS)){
    for(const p of pats) if(p.test(n)) return type;
  }
  return "Importer";
}

// ═══ Yundor Commercial Fit (Sprint 14.19) ═══
function yundorFit(c){
  const s=c.s||0,name=(c.name||"").toLowerCase(),pd=(c.pd||[]).join(" ").toLowerCase();
  let score=0; const details=[];

  // 1. OEM Potential (25%) — best for brand owners without own manufacturing
  let oem=50;
  if(c.companyType==="Brand Owner"){oem=95;details.push("Brand owner — high OEM interest");}
  else if(c.companyType==="Distributor"){oem=85;details.push("Distributor — private label potential");}
  else if(c.companyType==="Retailer"){oem=70;details.push("Retailer — house brand opportunity");}
  else if(c.companyType==="Trading Company"){oem=65;details.push("Trading co — reseller opportunity");}
  else if(c.companyType==="Manufacturer"){oem=20;details.push("⚠ Manufacturer — low OEM need");}
  else {oem=55;details.push("Importer — moderate OEM potential");}
  score+=oem*0.25;

  // 2. Private Label Potential (20%)
  let pl=50;
  if(c.companyType==="Brand Owner"&&s>=100){pl=90;details.push("Brand owner + volume → private label likely");}
  else if(c.companyType==="Distributor"){pl=75;details.push("Distributor — private label buyer");}
  else if(c.companyType==="Brand Owner"){pl=70;}
  else if(c.companyType==="Retailer"){pl=60;}
  else pl=30;
  score+=pl*0.20;

  // 3. China Sourcing (20%)
  let cs=0;
  if(c.cc>0){cs=90;details.push("Already sourcing from China ✓");}
  else{cs=30;details.push("No China supplier — opportunity to enter");}
  score+=cs*0.20;

  // 4. Mid-market Fit (20%) — sweet spot for OEM factories
  let mm=60;
  if(s>=100&&s<=1000){mm=95;details.push(`OEM sweet spot (${s} BOLs)`);}
  else if(s>1000){mm=70;details.push("Large importer — competitive bidding");}
  else if(s>=50){mm=60;details.push("Growing importer");}
  else{mm=30;}
  score+=mm*0.20;

  // 5. Competitive Risk (15%) — subtract if they're a competitor's customer
  let cr=85;
  if(c.companyType==="Manufacturer"){cr=40;details.push("⚠ They are a manufacturer — may compete");}
  if(s>2000){cr-=15;details.push("Very large — may prefer existing suppliers");}
  if(c.bt==="General Plumbing"){cr-=10;}
  score+=Math.max(0,cr)*0.15;

  // Sales Priority
  let sp="B";
  if(score>=70)sp="A";
  else if(score<45)sp="C";

  // Summary
  let summary="";
  if(sp==="A")summary=oem>=80?"高 OEM 潜力 — 优先联系":cs>=80?"已有中国采购 — 建立关系":"中等规模 — 开发潜力";
  else if(sp==="B")summary=oem<40?"制造商 — 低 OEM 需求":"需进一步研究";
  else summary="低优先级 — 规模太小或竞争风险高";

  return{score:Math.round(score),oem,pl,cs,mm,cr,sp,summary,details};
}

// ═══ 37 BUYERS ═══
const companies=[
  {name:"Rgm Distribution",s:641,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:99.98,pd:["bathroom faucet"]},
  {name:"Best Mart",s:858,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:70.08,pd:["basin faucet"]},
  {name:"Josaur Tradind",s:1755,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:72.38,pd:["shower system"]},
  {name:"Flying Bird Trade",s:2074,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:70.97,pd:["shower system"]},
  {name:"Afs Advantage",s:615,sc:1,cc:1,pm:"M",bt:"General Plumbing",r:48.43,pd:["hand shower"]},
  {name:"Delta Faucet",s:6096,sc:1,cc:1,pm:"M",bt:"Bathroom Specialist",r:49.01,pd:["hand shower"]},
  {name:"Am Conservation Group",s:1187,sc:1,cc:1,pm:"M",bt:"General Plumbing",r:54.12,pd:["hand shower"]},
  {name:"Waxman Consumer Products Group",s:943,sc:1,cc:1,pm:"M",bt:"General Plumbing",r:48.43,pd:["hand shower"]},
  {name:"Water Safety",s:653,sc:1,cc:1,pm:"M",bt:"General Plumbing",r:65.13,pd:["hand shower"]},
  {name:"Shower Enclosures America",s:2016,sc:1,cc:0,pm:"M",bt:"General Plumbing",r:92.64,pd:["shower system"]},
  {name:"Interlink Products International",s:536,sc:1,cc:0,pm:"M",bt:"General Plumbing",r:69.12,pd:["hand shower"]},
  {name:"Gisela Supplies",s:940,sc:1,cc:0,pm:"M",bt:"General Plumbing",r:67.08,pd:["hand shower"]},
  {name:"Yangyang Fashion Technology",s:1299,sc:1,cc:1,pm:"H",bt:"Mixed Bathroom/Kitchen",r:90.53,pd:["shower system"]},
  {name:"Flourishing Household",s:700,sc:1,cc:1,pm:"H",bt:"Mixed Bathroom/Kitchen",r:69.53,pd:["shower system"]},
  {name:"Service Partners Supply",s:104,sc:1,cc:1,pm:"M",bt:"General Plumbing",r:45.33,pd:["hand shower"]},
  {name:"Kes Hili",s:1171,sc:1,cc:0,pm:"H",bt:"Mixed Bathroom/Kitchen",r:57.42,pd:["hand shower"]},
  {name:"Pioneer Industries",s:295,sc:1,cc:1,pm:"H",bt:"Mixed Bathroom/Kitchen",r:99.09,pd:["lavatory faucet"]},
  {name:"Qingyuan Trade",s:137,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:73.79,pd:["bathroom faucet"]},
  {name:"Stellar Innovations Group",s:878,sc:1,cc:0,pm:"H",bt:"Mixed Bathroom/Kitchen",r:80.07,pd:["shower system"]},
  {name:"Etl",s:411,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:53.58,pd:["rain shower"]},
  {name:"Sr Sunrise Sanitary",s:111,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:85.29,pd:["bathroom faucet"]},
  {name:"Smart Design Usa",s:290,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:81.87,pd:["bathroom faucet"]},
  {name:"Sturgeon",s:176,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:76.01,pd:["basin faucet"]},
  {name:"Everpeak",s:134,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:72.99,pd:["basin faucet"]},
  {name:"Lechang Industrial",s:158,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:84.72,pd:["bathroom faucet"]},
  {name:"Minea Electrical Appliance C",s:440,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:79.47,pd:["bathroom faucet"]},
  {name:"Golden Industrial Supply",s:146,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:92.03,pd:["bathroom faucet"]},
  {name:"Jr Fast Trade",s:185,sc:1,cc:1,pm:"H",bt:"Mixed Bathroom/Kitchen",r:83.67,pd:["bathroom faucet"]},
  {name:"Bestuhom",s:85,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:76.5,pd:["basin faucet"]},
  {name:"Crestwind Innovations",s:287,sc:1,cc:1,pm:"H",bt:"Mixed Bathroom/Kitchen",r:72.79,pd:["shower system"]},
  {name:"Perfetto Kitchen And Bath",s:360,sc:1,cc:0,pm:"H",bt:"Mixed Bathroom/Kitchen",r:87.18,pd:["basin faucet"]},
  {name:"Torenfonder Enterprises",s:60,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:56.7,pd:["basin faucet"]},
  {name:"Mega Lion",s:56,sc:1,cc:0,pm:"H",bt:"Bathroom Specialist",r:80.13,pd:["bathroom faucet"]},
  {name:"D&L Supply And Mfg",s:43,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:26.84,pd:["lavatory faucet"]},
  {name:"Savoy Brass Mfg",s:79,sc:1,cc:1,pm:"H",bt:"Bathroom Specialist",r:22.47,pd:["lavatory faucet"]},
  {name:"Tb Philly",s:90,sc:1,cc:0,pm:"H",bt:"Mixed Bathroom/Kitchen",r:82.59,pd:["bathroom faucet"]},
  {name:"Elevate Building Supply",s:79,sc:1,cc:0,pm:"H",bt:"Mixed Bathroom/Kitchen",r:72.25,pd:["basin faucet"]},
];

// Classify
for(const c of companies){
  c.companyType=classifyCompanyType(c.name);
  const fit=yundorFit(c);
  c.fit=fit.score;c.fitSp=fit.sp;c.fitDetail=fit.details.slice(0,3).join(" · ");c.fitSummary=fit.summary;
  c.tier=tierShip(c.s).t;
}

const sorted=[...companies].sort((a,b)=>b.fit-a.fit||b.s-a.s);

// ═══ REPORT ═══
const HH="=".repeat(105),HR="─".repeat(105);
console.log(HH);
console.log("SPRINT 14.19 — COMMERCIAL FIT INTELLIGENCE");
console.log(HH);
console.log("37 buyers · Yundor OEM/ODM perspective · No API · "+new Date().toISOString());

// 1. FULL TABLE
console.log();
console.log(HR);
console.log("1. COMMERCIAL FIT — All 37 Buyers (sorted by Yundor Fit)");
console.log(HR);
console.log();
console.log("  #  Company                         Size        Type            Fit   SP  BOLs  CN  Recommend");
console.log("  "+"─".repeat(95));
for(let i=0;i<sorted.length;i++){
  const c=sorted[i];
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${c.tier.padEnd(12)}${c.companyType.padEnd(16)}${String(c.fit).padEnd(5)}${c.fitSp} ${String(c.s).padStart(5)}  ${c.cc?"✓":"✗"}  ${c.fitSummary.slice(0,40)}`);
}

// 2. FIT DISTRIBUTION
console.log();
console.log(HR);
console.log("2. FIT DISTRIBUTION");
console.log(HR);
const fd={A:0,B:0,C:0};
sorted.forEach(c=>fd[c.fitSp]++);
console.log(`\n  Sales Priority A (fit ≥70): ${fd.A} buyers — immediate outreach`);
console.log(`  Sales Priority B (45-69):   ${fd.B} buyers — research first`);
console.log(`  Sales Priority C (<45):     ${fd.C} buyers — low priority`);
console.log(`\n  Company Types:`);
const ct={};
sorted.forEach(c=>{ct[c.companyType]=(ct[c.companyType]||0)+1});
for(const[t,n]of Object.entries(ct).sort((a,b)=>b[1]-a[1]))console.log(`    ${t}: ${n}`);

// 3. TOP OEM PROSPECTS
console.log();
console.log(HR);
console.log("3. TOP OEM/ODM PROSPECTS — Best Yundor Fit");
console.log(HR);
const top=sorted.filter(c=>c.fitSp==="A");
for(const c of top){
  console.log(`\n  ${c.name.padEnd(35)} Fit: ${c.fit}/100  SP: ${c.fitSp}`);
  console.log(`    Size: ${c.tier} · ${c.s} BOLs · ${c.companyType} · ${c.bt}`);
  console.log(`    ${c.fitDetail}`);
  console.log(`    → ${c.fitSummary}`);
}

// 4. LOW FIT (likely not OEM)
console.log();
console.log(HR);
console.log("4. LOW OEM FIT — May not be suitable");
console.log(HR);
const low=sorted.filter(c=>c.fitSp==="C");
for(const c of low){
  console.log(`  ${c.name.padEnd(35)} Fit: ${c.fit}/100  ${c.tier} · ${c.companyType}`);
  console.log(`    ${c.fitDetail}`);
}

// 5. CONTRAST: big but not OEM
console.log();
console.log(HR);
console.log("5. CONTRAST — Big ≠ Good OEM Fit");
console.log(HR);
console.log();
console.log("  Delta Faucet (6,096 BOLs):        Large buyer, but they ARE a brand — low OEM need");
console.log("  Rgm Distribution (641 BOLs):       Distributor with China sourcing — HIGH OEM fit");
console.log("  Flying Bird Trade (2,074 BOLs):    Trading company — reseller, good for volume");
console.log();
console.log("  Big importers may have existing supplier relationships.");
console.log("  Distributors and brand owners are better OEM targets.");

// 6. CREDIT
console.log();
console.log(HH);
console.log("6. CREDIT REPORT");
console.log(HH);
console.log();
console.log("  No API usage · Real credits consumed: 0 · Balance: 90.1 · Reserve: 80");
console.log();
console.log("  New layers added:");
console.log("    Company Type classification — inferred from name patterns");
console.log("    Yundor Commercial Fit — OEM + Private Label + China + Mid-market + Risk");
console.log("    Sales Priority — A (high fit) / B (potential) / C (low)");
console.log();
