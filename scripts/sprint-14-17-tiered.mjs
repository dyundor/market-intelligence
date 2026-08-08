#!/usr/bin/env node
/**
 * Sprint 14.17 — Tiered Scoring + Buyer Size Tier
 *
 * Before: continuous logScale(volume, 500) — compressed range
 * After:  tiered shipment scoring + negative penalties + size tiers
 */

// ═══ Scoring functions ═══
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function ratioScale(v,b){if(b<=0)return 0;return clamp(Math.round(100*Math.min(v,b)/b),0,100);}

// OLD model (Sprint 14.16)
function logScale(v,b){if(v<=0)return 0;return clamp(Math.round(100*Math.log(1+v)/Math.log(1+b)),0,100);}
const OLD_W={sv:30,sr:20,sd:5,sc:5,cv:5,fv:5,pr:10,pc:10,ic:5,dc:5};
function oldScore(c){
  const s=c.shipments||0,sup=c.supC||0,chinaC=c.chinaC||0;
  const rec=s>0?80:0;
  const concentration=clamp((c.relevance||50)*0.7-(c.bt==="Mixed Bathroom/Kitchen"?15:0)-(/kitchen/i.test((c.products||[]).join(" "))?15:0),10,100);
  const pr=c.pm==="HIGH"?70:c.pm==="MEDIUM"?50:30;
  const factors=[logScale(s,500)*OLD_W.sv,rec*OLD_W.sr,ratioScale(sup,5)*OLD_W.sd,sup>0?ratioScale(chinaC,Math.min(sup,3))*OLD_W.sc:0,0,0,pr*OLD_W.pr,concentration*OLD_W.pc,ratioScale(c.identity||80,100)*OLD_W.ic,s>0?100*OLD_W.dc:50*OLD_W.dc];
  return clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
}

// NEW model (Sprint 14.17)
const NEW_W={sv:35,sr:20,sd:5,sc:5,cv:5,fv:5,pr:10,pc:12,ic:3,dc:5};
function tierShip(s){if(s>=500)return{val:100,tier:"Enterprise"};if(s>=100)return{val:70,tier:"Mid-market"};if(s>=20)return{val:40,tier:"Small"};return{val:15,tier:"Small"};}
function newScore(c){
  const s=c.shipments||0,sup=c.supC||0,chinaC=c.chinaC||0;
  const ts=tierShip(s);
  const rec=s>0?80:0;
  const concentration=clamp((c.relevance||50)*0.7-(c.bt==="Mixed Bathroom/Kitchen"?15:0)-(/kitchen/i.test((c.products||[]).join(" "))?15:0),10,100);
  const pr=c.pm==="HIGH"?70:c.pm==="MEDIUM"?50:30;
  const factors=[ts.val*NEW_W.sv,rec*NEW_W.sr,ratioScale(sup,5)*NEW_W.sd,sup>0?ratioScale(chinaC,Math.min(sup,3))*NEW_W.sc:0,0,0,pr*NEW_W.pr,concentration*NEW_W.pc,ratioScale(c.identity||80,100)*NEW_W.ic,s>0?100*NEW_W.dc:50*NEW_W.dc];
  let base=clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
  // Negative penalties
  const lp=(c.products||[]).join(" ").toLowerCase();
  if(/kitchen/i.test(lp)&&s>0)base-=5;
  if(/sauna/i.test(lp))base-=8;
  if(s<20&&s>0)base-=3;
  if((c.identity||80)<70)base-=3;
  c._tier=ts.tier;
  return clamp(base,0,100);
}

function priority(s){return s>=65?'A':s>=35?'B':'C';}

// ═══ 25 buyers ═══
const companies = [
  {name:"Sr Sunrise Sanitary",s:111,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:85.29,pd:["bathroom faucet"]},
  {name:"Smart Design Usa",s:290,sc:1,cc:0,pm:"HIGH",bt:"Bathroom Specialist",r:81.87,pd:["bathroom faucet"]},
  {name:"Mega Lion",s:56,sc:1,cc:0,pm:"HIGH",bt:"Bathroom Specialist",r:80.13,pd:["bathroom faucet"]},
  {name:"Rgm Distribution",s:641,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:99.98,pd:["bathroom faucet","basin faucet"]},
  {name:"Lechang Industrial",s:158,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:84.72,pd:["bathroom faucet"]},
  {name:"Minea Electrical Appliance C",s:440,sc:1,cc:0,pm:"HIGH",bt:"Bathroom Specialist",r:79.47,pd:["bathroom faucet"]},
  {name:"Jr Fast Trade",s:185,sc:1,cc:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",r:83.67,pd:["bathroom faucet","kitchen sink"]},
  {name:"Golden Industrial Supply",s:146,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:92.03,pd:["bathroom faucet","basin faucet"]},
  {name:"Tb Philly",s:90,sc:1,cc:0,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",r:82.59,pd:["bathroom faucet","kitchen"]},
  {name:"Qingyuan Trade",s:137,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:73.79,pd:["bathroom faucet"]},
  {name:"Bestuhom",s:85,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:76.5,pd:["basin faucet"]},
  {name:"Best Mart",s:858,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:70.08,pd:["basin faucet"]},
  {name:"Sturgeon",s:176,sc:1,cc:0,pm:"HIGH",bt:"Bathroom Specialist",r:76.01,pd:["basin faucet"]},
  {name:"Everpeak",s:134,sc:1,cc:0,pm:"HIGH",bt:"Bathroom Specialist",r:72.99,pd:["basin faucet"]},
  {name:"Perfetto Kitchen And Bath",s:360,sc:1,cc:1,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",r:87.18,pd:["basin faucet","kitchen sink"]},
  {name:"Torenfonder Enterprises",s:60,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:56.7,pd:["basin faucet"]},
  {name:"Elevate Building Supply",s:79,sc:1,cc:0,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",r:72.25,pd:["basin faucet","kitchen"]},
  {name:"Shower Enclosures America",s:2016,sc:1,cc:0,pm:"MEDIUM",bt:"General Plumbing",r:92.64,pd:["shower system"]},
  {name:"Josaur Tradind",s:1755,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:72.38,pd:["shower system"]},
  {name:"Yangyang Fashion Technology",s:1299,sc:1,cc:1,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",r:90.53,pd:["shower system","kitchen"]},
  {name:"Flying Bird Trade",s:2074,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:70.97,pd:["shower system"]},
  {name:"Stellar Innovations Group",s:878,sc:1,cc:0,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",r:80.07,pd:["shower system","kitchen"]},
  {name:"Flourishing Household",s:700,sc:1,cc:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",r:69.53,pd:["shower system","kitchen"]},
  {name:"Crestwind Innovations",s:287,sc:1,cc:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",r:72.79,pd:["shower system","kitchen"]},
  {name:"Etl",s:411,sc:1,cc:1,pm:"HIGH",bt:"Bathroom Specialist",r:53.58,pd:["rain shower"]},
];

// Score
for(const c of companies){
  c.shipments=c.s;c.supC=c.sc;c.chinaC=c.cc;c.relevance=c.r;c.products=c.pd;
  c.old=oldScore(c);c.new=newScore(c);
  c.oldP=priority(c.old);c.newP=priority(c.new);
  c.delta=c.new-c.old;c.identity=80;
  c.sizeTier=tierShip(c.s).tier;
}

const sorted=[...companies].sort((a,b)=>b.new-a.new||b.s-b.s);

// ═══ REPORT ═══
const HH="=".repeat(95),HR="─".repeat(95);
console.log(HH);
console.log("SPRINT 14.17 — TIERED SCORING + BUYER SIZE TIER");
console.log(HH);
console.log(`25 buyers · No API · ${new Date().toISOString()}`);

// 1. Before vs After
console.log();
console.log(HR);
console.log("1. BEFORE vs AFTER — All 25 Buyers");
console.log(HR);
console.log();
console.log("  #  Company                         Old  OP  New  NP   Δ   Size        BOLs   CN  Match  Type");
console.log("  "+"─".repeat(89));
for(let i=0;i<sorted.length;i++){
  const c=sorted[i];
  const dn=c.delta>0?"+"+c.delta:String(c.delta);
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${String(c.old).padEnd(4)}${c.oldP}  ${String(c.new).padEnd(4)}${c.newP} ${dn.padStart(3)}  ${c.sizeTier.padEnd(11)} ${String(c.s).padStart(5)}  ${c.cc?"✓":"✗"}  ${c.pm.padEnd(6)} ${c.bt.slice(0,22)}`);
}

// 2. Distribution
console.log();
console.log(HR);
console.log("2. DISTRIBUTION");
console.log(HR);
console.log();
const od={A:0,B:0,C:0},nd={A:0,B:0,C:0};
companies.forEach(c=>{od[c.oldP]++;nd[c.newP]++});
const st={Enterprise:0,"Mid-market":0,Small:0};
companies.forEach(c=>st[c.sizeTier]++);

console.log(`  Tier         Old     New     Size Tier       Count`);
console.log(`  ${"─".repeat(50)}`);
console.log(`  A (≥65)      ${od.A.toString().padStart(3)}     ${nd.A.toString().padStart(3)}     Enterprise       ${st.Enterprise.toString().padStart(3)}`);
console.log(`  B (35-64)    ${od.B.toString().padStart(3)}     ${nd.B.toString().padStart(3)}     Mid-market       ${st["Mid-market"].toString().padStart(3)}`);
console.log(`  C (<35)      ${od.C.toString().padStart(3)}     ${nd.C.toString().padStart(3)}     Small            ${st.Small.toString().padStart(3)}`);

const os=companies.map(c=>c.old).sort((a,b)=>a-b);
const ns=companies.map(c=>c.new).sort((a,b)=>a-b);
console.log();
console.log(`  Score:  ${os[0]}–${os[os.length-1]} → ${ns[0]}–${ns[ns.length-1]}  (range: ${os[os.length-1]-os[0]} → ${ns[ns.length-1]-ns[0]})`);
console.log(`  Median: ${[...companies].sort((a,b)=>a.old-b.old)[12].old} → ${[...companies].sort((a,b)=>a.new-b.new)[12].new}`);

// 3. Size breakdown
console.log();
console.log(HR);
console.log("3. BUYER SIZE TIER BREAKDOWN");
console.log(HR);
console.log();

for(const tier of ["Enterprise","Mid-market","Small"]){
  const buyers=sorted.filter(c=>c.sizeTier===tier);
  console.log(`  ${tier} (${buyers.length} buyers):`);
  for(const c of buyers.slice(0,8)){
    console.log(`    ${c.newP} ${String(c.new).padStart(3)}  ${c.name.slice(0,30).padEnd(31)} ${c.s} BOLs · ${c.bt}`);
  }
  if(buyers.length>8)console.log(`    ... +${buyers.length-8} more`);
  console.log();
}

// 4. Penalties applied
console.log(HR);
console.log("4. NEGATIVE PENALTIES APPLIED");
console.log(HR);
console.log();

const penalized=companies.filter(c=>c.delta<0||(c.new-c.old<3&&c.bt.includes("Mixed")));
for(const c of penalized){
  const reasons=[];
  if((c.pd||[]).join(" ").toLowerCase().includes("kitchen"))reasons.push("kitchen in products (-5)");
  if(c.bt.includes("Mixed"))reasons.push("mixed buyer type");
  if(c.r<60)reasons.push(`low API relevance (${c.r}%)`);
  if(c.s<20)reasons.push("very low volume (-3)");
  console.log(`  ${c.name} (${c.old}→${c.new}, ${c.delta>=0?"+"+c.delta:c.delta}): ${reasons.join("; ")}`);
}

// 5. TOP priority
console.log();
console.log(HR);
console.log("5. TOP PRIORITY — Immediate Sales Outreach");
console.log(HR);
console.log();

const top=sorted.filter(c=>c.newP==="A");
console.log(`  ${top.length} buyers recommended for immediate outreach:`);
for(const c of top){
  const pos=[],neg=[];
  if(c.s>=500)pos.push(`Enterprise (${c.s} BOLs)`);
  else if(c.s>=100)pos.push(`Mid-market (${c.s} BOLs)`);
  if(c.bt==="Bathroom Specialist")pos.push("Bathroom Specialist");
  if(c.cc>0)pos.push("China supplier ✓");
  if(c.bt.includes("Mixed"))neg.push("⚠ Mixed bathroom/kitchen");
  if(c.pm==="MEDIUM")neg.push("⚠ Medium product match");
  if(c.r<60)neg.push(`⚠ Low relevance (${c.r}%)`);
  console.log(`    ${c.name.padEnd(33)} ${c.new}/100  ${c.sizeTier.padEnd(11)}`);
  console.log(`      ${pos.join(" · ")}`);
  if(neg.length)console.log(`      ${neg.join(" · ")}`);
}
console.log();

// 6. CREDIT
console.log(HH);
console.log("6. CREDIT REPORT");
console.log(HH);
console.log();
console.log("  ╔══════════════════════════════════════╗");
console.log("  ║  本次消耗:        0.0 credits        ║");
console.log("  ║  累计消耗:        4.6 credits        ║");
console.log("  ║  当前余额:       94.8 credits        ║");
console.log("  ║  距80预留:       14.8 credits        ║");
console.log("  ╚══════════════════════════════════════╝");

console.log();
console.log(HR);
console.log("IMPLEMENTATION:");
console.log(`  lib/qualification/types.ts — BuyerSizeTier type, added to QualificationResult`);
console.log(`  lib/qualification/score.ts — tieredShipmentScore(), negative penalties`);
console.log(`  lib/qualification/factors.ts — buyerSizeTier passed through`);
console.log();
console.log(`  Weight:   sv:35 (tiered)  sr:20  sd:5  sc:5  pr:10  pc:12  ic:3  dc:5`);
console.log(`  Penalty:  kitchen: -5  sauna: -8  low-volume(<20): -3  low-identity(<70): -3`);
console.log();
