#!/usr/bin/env node
/**
 * Sprint 14.16 — Qualification Model Recalibration
 *
 * Before vs After comparison using real 25-buyer dataset.
 * No API calls. No credits consumed.
 */

// ═══ Old weights (Sprint 14.13) ═══
const OLD_W = { sv:18, sr:18, sd:12, sc:10, cv:12, fv:10, pr:10, ic:5, dc:5 };

// ═══ New weights (Sprint 14.16) ═══
const NEW_W = { sv:30, sr:20, sd:5, sc:5, cv:5, fv:5, pr:10, pc:10, ic:5, dc:5 };

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function logScale(v,b){if(v<=0)return 0;return clamp(Math.round(100*Math.log(1+v)/Math.log(1+b)),0,100);}
function ratioScale(v,b){if(b<=0)return 0;return clamp(Math.round(100*Math.min(v,b)/b),0,100);}

function scoreWithWeights(c, w) {
  const s=c.shipments||0, sup=c.supC||0, chinaC=c.chinaC||0;
  const rec=s>0?80:0;
  const concentration = clamp((c.relevance||50)*0.7 - (c.bt==="Mixed Bathroom/Kitchen"?15:0) - (/kitchen/i.test((c.products||[]).join(" "))?15:0), 10, 100);
  const pr = c.pm==="HIGH"?70:c.pm==="MEDIUM"?50:30;
  const idC=ratioScale(c.identity||80,100);
  const dc=s>0?100:50;
  const factors=[
    logScale(s,500)*w.sv, rec*w.sr, ratioScale(sup,5)*w.sd,
    sup>0?ratioScale(chinaC,Math.min(sup,3))*w.sc:0,
    0*w.cv, 0*w.fv,
    pr*w.pr, concentration*(w.pc||0),
    idC*w.ic, dc*w.dc,
  ];
  return clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
}

function priority(s){return s>=65?'A':s>=35?'B':'C';}

// ═══ REAL 25-buyer dataset ═══
const companies = [
  {name:"Sr Sunrise Sanitary",shipments:111,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:85.29},
  {name:"Smart Design Usa",shipments:290,supC:1,chinaC:0,pm:"HIGH",bt:"Bathroom Specialist",relevance:81.87},
  {name:"Mega Lion",shipments:56,supC:1,chinaC:0,pm:"HIGH",bt:"Bathroom Specialist",relevance:80.13},
  {name:"Rgm Distribution",shipments:641,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:99.98},
  {name:"Lechang Industrial",shipments:158,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:84.72},
  {name:"Minea Electrical Appliance C",shipments:440,supC:1,chinaC:0,pm:"HIGH",bt:"Bathroom Specialist",relevance:79.47},
  {name:"Jr Fast Trade",shipments:185,supC:1,chinaC:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",relevance:83.67},
  {name:"Golden Industrial Supply",shipments:146,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:92.03},
  {name:"Tb Philly",shipments:90,supC:1,chinaC:0,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",relevance:82.59},
  {name:"Qingyuan Trade",shipments:137,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:73.79},
  {name:"Bestuhom",shipments:85,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:76.5},
  {name:"Best Mart",shipments:858,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:70.08},
  {name:"Sturgeon",shipments:176,supC:1,chinaC:0,pm:"HIGH",bt:"Bathroom Specialist",relevance:76.01},
  {name:"Everpeak",shipments:134,supC:1,chinaC:0,pm:"HIGH",bt:"Bathroom Specialist",relevance:72.99},
  {name:"Perfetto Kitchen And Bath",shipments:360,supC:1,chinaC:1,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",relevance:87.18},
  {name:"Torenfonder Enterprises",shipments:60,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:56.7},
  {name:"Elevate Building Supply",shipments:79,supC:1,chinaC:0,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",relevance:72.25},
  {name:"Shower Enclosures America",shipments:2016,supC:1,chinaC:0,pm:"MEDIUM",bt:"General Plumbing",relevance:92.64},
  {name:"Josaur Tradind",shipments:1755,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:72.38},
  {name:"Yangyang Fashion Technology",shipments:1299,supC:1,chinaC:1,pm:"MEDIUM",bt:"Mixed Bathroom/Kitchen",relevance:90.53},
  {name:"Flying Bird Trade",shipments:2074,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:70.97},
  {name:"Stellar Innovations Group",shipments:878,supC:1,chinaC:0,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",relevance:80.07},
  {name:"Flourishing Household",shipments:700,supC:1,chinaC:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",relevance:69.53},
  {name:"Crestwind Innovations",shipments:287,supC:1,chinaC:1,pm:"HIGH",bt:"Mixed Bathroom/Kitchen",relevance:72.79},
  {name:"Etl",shipments:411,supC:1,chinaC:1,pm:"HIGH",bt:"Bathroom Specialist",relevance:53.58},
];

// ═══ SCORE ═══
for (const c of companies) {
  c.oldScore = scoreWithWeights(c, OLD_W);
  c.newScore = scoreWithWeights(c, NEW_W);
  c.oldP = priority(c.oldScore);
  c.newP = priority(c.newScore);
  c.delta = c.newScore - c.oldScore;
  c.identity = c.identity || 80;
}

// ═══ SORT BY NEW SCORE ═══
const sorted = [...companies].sort((a,b)=>b.newScore-a.newScore||b.shipments-a.shipments);

// ═══ REPORT ═══
const HH="=".repeat(92), HR="─".repeat(92);
console.log(HH);
console.log("SPRINT 14.16 — QUALIFICATION MODEL RECALIBRATION");
console.log(HH);
console.log(`Dataset: 25 real buyers  |  No API calls  |  ${new Date().toISOString()}`);
console.log();

// 1. BEFORE vs AFTER
console.log(HR);
console.log("1. BEFORE vs AFTER — All 25 Buyers");
console.log(HR);
console.log();
console.log("  #  Company                         OldS  OldP  NewS  NewP  Δ   BOLs    CN  Match   Type");
console.log("  " + "─".repeat(86));
for (let i=0; i<sorted.length; i++) {
  const c = sorted[i];
  const dn = c.delta>0?"+"+c.delta:String(c.delta);
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${String(c.oldScore).padEnd(5)} ${c.oldP}   ${String(c.newScore).padEnd(5)}${c.newP}  ${dn.padStart(3)}  ${String(c.shipments).padStart(5)}  ${c.chinaC?"✓":"✗".padEnd(2)}  ${c.pm.padEnd(6)} ${c.bt.slice(0,22)}`);
}

// 2. DISTRIBUTION
console.log();
console.log(HR);
console.log("2. SCORE DISTRIBUTION CHANGE");
console.log(HR);
console.log();

const oldDist={A:0,B:0,C:0},newDist={A:0,B:0,C:0};
companies.forEach(c=>{oldDist[c.oldP]++;newDist[c.newP]++});

console.log(`  Tier      Before     After      Change`);
console.log(`  ${"─".repeat(40)}`);
console.log(`  A (≥65)   ${String(oldDist.A).padStart(3)}       ${String(newDist.A).padStart(3)}        ${newDist.A-oldDist.A>=0?"+"+String(newDist.A-oldDist.A):String(newDist.A-oldDist.A)}`);
console.log(`  B (35-64) ${String(oldDist.B).padStart(3)}       ${String(newDist.B).padStart(3)}        ${newDist.B-oldDist.B>=0?"+"+String(newDist.B-oldDist.B):String(newDist.B-oldDist.B)}`);
console.log(`  C (<35)   ${String(oldDist.C).padStart(3)}       ${String(newDist.C).padStart(3)}        ${newDist.C-oldDist.C>=0?"+"+String(newDist.C-oldDist.C):String(newDist.C-oldDist.C)}`);

console.log();
console.log(`  Score spread:`);
const olds=sorted.map(c=>c.oldScore).sort((a,b)=>a-b);
const news=sorted.map(c=>c.newScore).sort((a,b)=>a-b);
console.log(`    Old:    ${olds[0]}–${olds[olds.length-1]}  (range: ${olds[olds.length-1]-olds[0]})`);
console.log(`    New:    ${news[0]}–${news[news.length-1]}  (range: ${news[news.length-1]-news[0]})`);
console.log(`    Median: ${olds[12]} → ${news[12]}`);

// 3. PROMOTED/DEMOTED
console.log();
console.log(HR);
console.log("3. PRIORITY CHANGES");
console.log(HR);
console.log();

const promoted=companies.filter(c=>c.oldP!==c.newP&&(c.oldP==="B"&&c.newP==="A"||c.oldP==="C"&&(c.newP==="B"||c.newP==="A")));
const demoted=companies.filter(c=>c.oldP!==c.newP&&(c.oldP==="A"&&c.newP!=="A"||c.oldP==="B"&&c.newP==="C"));

if(promoted.length) {
  console.log("  PROMOTED:");
  for(const c of promoted) console.log(`    ↑ ${c.name}: ${c.oldP}→${c.newP} (${c.oldScore}→${c.newScore}) ${c.shipments}BOLs · ${c.bt}`);
}
if(demoted.length) {
  console.log("  DEMOTED:");
  for(const c of demoted) console.log(`    ↓ ${c.name}: ${c.oldP}→${c.newP} (${c.oldScore}→${c.newScore}) ${c.shipments}BOLs · ${c.bt}`);
}
const unchanged=companies.filter(c=>c.oldP===c.newP).length;
console.log(`  UNCHANGED: ${unchanged}/${companies.length}`);

// 4. WEIGHT COMPARISON
console.log();
console.log(HR);
console.log("4. WEIGHT MODEL COMPARISON");
console.log(HR);
console.log();

console.log("  Factor                  Old    New    Reason");
console.log("  " + "─".repeat(55));
console.log("  Shipment volume         18%    30%    Main differentiator — 2000 vs 50 BOLs");
console.log("  Shipment recency        18%    20%    Activity freshness");
console.log("  Supplier diversity      12%     5%    ↓ All buyers have 1 supplier (API limit)");
console.log("  China supplier          10%     5%    ↓ 60% have it — poor discriminator");
console.log("  Container volume        12%     5%    ↓ Always 0 in current data");
console.log("  Freight value           10%     5%    ↓ Always 0 in current data");
console.log("  Product relevance       10%    10%    Unchanged");
console.log("  Product concentration    —     10%    NEW — bathroom focus vs mixed");
console.log("  Identity confidence      5%     5%    Unchanged");
console.log("  Data coverage            5%     5%    Unchanged");

// 5. EXPLANATIONS
console.log();
console.log(HR);
console.log("5. EXPLANATIONS — Top 10 Buyers (New Model)");
console.log(HR);

for(let i=0;i<10;i++){
  const c=sorted[i];
  const pos=[],neg=[];
  if(c.shipments>=500)pos.push(`✓ 高 Shipment 量 (${c.shipments} BOLs)`);
  else if(c.shipments>=100)pos.push(`✓ Shipment 活跃 (${c.shipments} BOLs)`);
  if(c.pm==="HIGH")pos.push("✓ 浴室产品高匹配");
  if(c.bt==="Bathroom Specialist")pos.push("✓ 浴室专业买家 (无厨房产品)");
  if(c.chinaC>0)pos.push("✓ 中国供应商关系");
  if(c.bt==="Mixed Bathroom/Kitchen")neg.push("⚠ 混合品类 (浴室+厨房)");
  if(c.bt==="General Plumbing")neg.push("⚠ 通用管道品类");
  if(c.pm==="MEDIUM")neg.push("⚠ 中等产品匹配");
  if(c.supC===1)neg.push("⚠ 单一供应商");
  if(c.shipments<100)neg.push("⚠ 较低 Shipment 量");

  console.log();
  console.log(`  #${i+1} ${c.name.padEnd(34)} ${c.newScore}/100  ${c.newP}`);
  if(c.delta!==0)console.log(`     (${c.oldP}→${c.newP}, ${c.delta>0?"+"+c.delta:c.delta} points)`);
  console.log(`     ${c.shipments} BOLs · ${c.bt} · ${c.pm} · CN:${c.chinaC?"✓":"✗"}`);
  for(const p of pos)console.log(`     ${p}`);
  for(const n of neg)console.log(`     ${n}`);
}

// 6. CREDIT
console.log();
console.log(HH);
console.log("6. CREDIT REPORT");
console.log(HH);
console.log();
console.log("  ╔══════════════════════════════════════╗");
console.log("  ║  ImportYeti 账户                      ║");
console.log("  ╠══════════════════════════════════════╣");
console.log("  ║  本次消耗:        0.0 credits        ║");
console.log("  ║  累计消耗:        4.6 credits        ║");
console.log("  ║  当前余额:       94.8 credits        ║");
console.log("  ║  距80预留:       14.8 credits        ║");
console.log("  ╚══════════════════════════════════════╝");
console.log();

// 7. FILES
console.log(HH);
console.log("7. IMPLEMENTATION SUMMARY");
console.log(HH);
console.log();
console.log("  Updated weights:");
console.log("    lib/qualification/types.ts — DEFAULT_WEIGHTS redistributed");
console.log("    lib/qualification/score.ts — product_concentration factor added");
console.log();
console.log("  Weight redistribution:");
console.log("    18→30 shipmentVolume    (main differentiator)");
console.log("    12→5  supplierDiversity (data-limited)");
console.log("    10→5  supplierChina     (overrepresented)");
console.log("    12→5  containerVolume   (no data yet)");
console.log("    10→5  freightValue      (no data yet)");
console.log("    0→10  productConcentration  (NEW — bathroom focus)");
console.log();
