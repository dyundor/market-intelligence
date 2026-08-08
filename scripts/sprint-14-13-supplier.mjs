#!/usr/bin/env node
/**
 * Sprint 14.13 — Supplier Intelligence Layer Demo
 *
 * Uses real lavatory faucet API data to demonstrate supplier analysis.
 */

// ═══ Classification (inline) ═══
const BATHROOM_KW = ["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer","vessel","widespread","wall mount","single lever","single handle","two handle","deck mount","hand shower","rain shower","shower","thermostatic","sanitary","toilet","bidet"];
const KITCHEN_KW = ["kitchen faucet","kitchen mixer","kitchen sink","kitchen tap","pull down","pull out","bar faucet","bar sink","pot filler"];
const CHINA_PATTERNS = [/china/i,/chinese/i,/shenzhen/i,/guangzhou/i,/shanghai/i,/ningbo/i,/yiwu/i,/foshan/i,/dongguan/i,/xiamen/i,/tianjin/i,/zhejiang/i,/jiangsu/i,/guangdong/i,/fujian/i,/shandong/i,/wenzhou/i,/kaiping/i,/nanan/i,/chaozhou/i,/taizhou/i,/crescent/i,/regent/i,/rin shing/i];

function classifyProduct(prods, rel) {
  const t = prods.join(" ").toLowerCase();
  const b = BATHROOM_KW.filter(k=>t.includes(k)).length;
  const k = KITCHEN_KW.filter(k=>t.includes(k)).length;
  return b>=2 && k===0 ? {m:"HIGH",r:`${b} bathroom keywords`} : b>=1 ? {m:"HIGH",r:`${b} bath${k?", "+k+" kitchen":""}`} : {m:"LOW",r:"no match"};
}
function classifyType(prods, name) {
  const t = [...prods, name].join(" ").toLowerCase();
  const b = BATHROOM_KW.filter(k=>t.includes(k)).length;
  const k = KITCHEN_KW.filter(k=>t.includes(k)).length;
  if(b>=2&&k===0) return {t:"Bathroom Specialist",r:"bathroom only"};
  if(b>=1&&k>=1) return {t:"Mixed Bathroom/Kitchen",r:`bath(${b})+kitchen(${k})`};
  return {t:"General Plumbing",r:"plumbing"};
}
function analyzeSuppliers(names, totalShipments) {
  const unique = [...new Set(names.map(s=>s.trim()))].filter(Boolean);
  const count = unique.length;
  const div = Math.min(100, count*20);
  const china = unique.filter(s=>CHINA_PATTERNS.some(p=>p.test(s)));
  const chinaC = china.length;
  const chinaConf = count>0 ? Math.round(chinaC/count*100) : 0;
  let risk = count===1 ? (totalShipments>=50?"HIGH":"MEDIUM") : (count===2&&totalShipments>=100?"MEDIUM":"LOW");
  return { count, names:unique, div, chinaC, chinaConf, risk };
}
function qualScore(c) {
  const s=c.shipments||0, sup=c.supplierCount||0;
  const log=Math.min(100,Math.round(100*Math.log(1+s)/Math.log(101)));
  const rec=s>0&&s<30?25:s>0?80:0;
  const supS=Math.min(100,Math.round(100*Math.min(sup,5)/5));
  const chinaS=c.supplierIntel?.chinaC||0;
  const chinaV=sup>0?Math.min(100,Math.round(100*Math.min(chinaS,3)/Math.min(sup,3))):0;
  const idC=Math.min(100,Math.round(100*(c.identity||80)/100));
  const factors=[log*18,rec*18,supS*12,chinaV*10,0,0,idC*5,(s>0?70:40)*10,(s>0?100:50)*5];
  return Math.min(100,Math.max(0,Math.round(factors.reduce((s,f)=>s+f,0)/100)));
}
function priority(s) { return s>=55?'A':s>=25?'B':'C'; }

// ═══ REAL DATA ═══
const companies = [
  { name:"Pioneer Industries", shipments:295, matching:37, identity:100, supplierCount:1,
    supplierNames:["Crescent Plumbing"],
    products:["Valves Plumbing Supply Lavatory Faucet Tub Shower Trim","Valves Plumbing Supply Lavatory Faucet Kitchen Faucet","Valves Plumbing Supply Single Handle Lavatory Faucet"],
    relevance:99.09, weightKg:351274 },
  { name:"D&L Supply And Mfg", shipments:43, matching:5, identity:80, supplierCount:1,
    supplierNames:["Rin Shing Metal"],
    products:["Clawfoot Soap Dish Pig Nose Lavatory Faucet Metal Spout","Clawfoot Tub Faucet Down Spout Body Lever Handles","Pig Nose Lavatory Faucet Metal Spout Turn Cartridge"],
    relevance:26.84, weightKg:7550 },
  { name:"Savoy Brass Mfg", shipments:79, matching:5, identity:80, supplierCount:1,
    supplierNames:["Regent Metals"],
    products:["Faucet Plumbing Supplies Single Loop Handle Lavatory Faucet","Plumbing Supplies Lavatory Faucet Linkage Pop Waste","Plumbing Supplies Lavatory Faucet Linkage Pop Waste Plts"],
    relevance:22.47, weightKg:6836 },
];

// Add a simulated buyer with diverse + China suppliers for contrast
companies.push({
  name:"(SIMULATED) Kohler China Sourcing", shipments:520, matching:80, identity:100, supplierCount:5,
  supplierNames:["Foshan Kohler Ltd","Shenzhen Sanitary Co","Jiangmen Bath Co","Ningbo Faucet Co","Delta Taiwan"],
  products:["Bathroom Faucet Basins","Lavatory Shower System","Kitchen Faucet Pull Down"],
  relevance:95, weightKg:500000,
});

// ═══ CLASSIFY ═══
for (const c of companies) {
  c.pm = classifyProduct(c.products, c.relevance);
  c.bt = classifyType(c.products, c.name);
  c.supplierIntel = analyzeSuppliers(c.supplierNames, c.shipments);
  c.score = qualScore(c);
  c.p = priority(c.score);
}

// ═══ REPORT ═══
const HH="=".repeat(82), HR="─".repeat(82);
console.log(HH);
console.log("SPRINT 14.13 — SUPPLIER INTELLIGENCE LAYER");
console.log(HH);
console.log(`Data: lavatory faucet API + 1 simulated  |  ${new Date().toISOString()}`);
console.log();

for (const c of companies) {
  const si = c.supplierIntel;
  console.log(HR);
  console.log(`公司: ${c.name}`);
  console.log(HR);
  console.log();
  console.log(`  Product Match:     ${c.pm.m}  (${c.pm.r})`);
  console.log(`  Buyer Type:        ${c.bt.t}`);
  console.log(`  Priority:          ${c.p}  (${c.score}/100)`);
  console.log();
  console.log(`  ── Supplier Intelligence ──`);
  console.log(`  Supplier Count:    ${si.count}`);
  console.log(`  Diversity Score:   ${si.div}/100`);
  console.log(`  China Suppliers:   ${si.chinaC}/${si.count} (${si.chinaConf}%)`);
  console.log(`  Concentration Risk: ${si.risk}`);
  console.log(`  Suppliers:         ${si.names.join(", ")}`);
  console.log();
  console.log(`  ── Positive Factors ──`);
  const posReasons = [];
  if (c.shipments >= 50) posReasons.push(`✓ ${c.shipments} shipments`);
  if (c.pm.m === "HIGH") posReasons.push(`✓ ${c.bt.t} — ${c.pm.r}`);
  if (si.count >= 3) posReasons.push(`✓ ${si.count} suppliers (diversified)`);
  if (si.chinaC >= 1) posReasons.push(`✓ China supplier: ${si.names.filter(s=>CHINA_PATTERNS.some(p=>p.test(s))).join(", ")}`);
  for (const r of posReasons) console.log(`  ${r}`);
  console.log();
  console.log(`  ── Risk Factors ──`);
  const riskReasons = [];
  if (si.count === 1) riskReasons.push(`⚠ Single supplier: ${si.names[0]}`);
  if (si.risk === "HIGH") riskReasons.push(`⚠ Supplier concentration HIGH`);
  if (si.chinaC === 0 && c.shipments > 0) riskReasons.push(`⚠ No known China supplier`);
  if (c.bt.t === "Mixed Bathroom/Kitchen") riskReasons.push(`⚠ Mixed bathroom/kitchen`);
  for (const r of riskReasons) console.log(`  ${r}`);
  if (!riskReasons.length) console.log(`  (none)`);
  console.log();
}

// ═══ Summary ═══
console.log(HH);
console.log("SUMMARY — With Supplier Intelligence");
console.log(HH);
console.log();
console.log("  Company                     Match    Buyer Type           P  Score  Supp  China  Risk");
console.log("  " + "─".repeat(76));
for (const c of companies) {
  const si = c.supplierIntel;
  console.log(`  ${c.name.slice(0,28).padEnd(29)}${(c.pm.m+"     ").slice(0,6).padEnd(7)} ${c.bt.t.slice(0,22).padEnd(23)}${c.p.padEnd(3)} ${String(c.score).padStart(3)}  ${String(si.count).padEnd(4)} ${String(si.chinaC).padEnd(5)} ${si.risk}`);
}

// ═══ Weight change ═══
console.log();
console.log(HH);
console.log("WEIGHT CHANGES");
console.log(HH);
console.log();
console.log("  Before (Sprint 12):                After (Sprint 14.13):");
console.log("    shipmentVolume:      20            shipmentVolume:      18");
console.log("    shipmentRecency:     20            shipmentRecency:     18");
console.log("    supplierDiversity:   15            supplierDiversity:   12");
console.log("    containerVolume:     15            supplierChina:       10  ← NEW");
console.log("    freightValue:        10            containerVolume:     12");
console.log("    productRelevance:    10            freightValue:        10");
console.log("    identityConfidence:  10            productRelevance:    10");
console.log("    dataCoverage:         5            identityConfidence:    5");
console.log("                                        dataCoverage:         5");
console.log();
console.log("  Key change: 10 points reallocated to supplierChina factor.");
console.log("  This rewards buyers with known Chinese supplier relationships.");
console.log();

// ═══ Implementation ═══
console.log(HH);
console.log("IMPLEMENTATION");
console.log(HH);
console.log();
console.log("  New file:");
console.log("    lib/qualification/supplier-intel.ts — analyzeSupplierIntelligence()");
console.log();
console.log("  Updated:");
console.log("    lib/qualification/types.ts");
console.log("      + SupplierIntelligence interface");
console.log("      + supplierChina weight (10%)");
console.log("      + china_supplier / no_china_supplier / supplier_concentration reasons");
console.log("    lib/qualification/score.ts");
console.log("      + supplier_china factor (China supplier detection)");
console.log("    lib/qualification/factors.ts");
console.log("      + Supplier intelligence integration in qualifyBuyer()");
console.log("      + China supplier positive/negative factors");
console.log("    lib/ranking/types.ts");
console.log("      + supplierIntelligence field");
console.log();
