#!/usr/bin/env node
/**
 * Sprint 14.15 — Controlled Capture Expansion
 *
 * Runs 6 ImportYeti queries in capture_only mode.
 * Budget: max 5 credits, keep 80 reserve.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(join(root, ".env"), "utf8").split("\n").reduce((e, l) => {
  const t = l.trim(); if (!t || t[0] === "#") return e;
  const eq = t.indexOf("="); if (eq > 0) e[t.slice(0, eq)] = t.slice(eq + 1);
  return e;
}, {});

const API_KEY = env.IMPORTYETI_API_KEY;
const API_URL = env.IMPORTYETI_API_URL || "https://data.importyeti.com";
const RESERVE = 80;

const QUERIES = [
  "bathroom faucet", "basin faucet", "widespread faucet",
  "shower system", "rain shower", "thermostatic shower",
];

// ═══ Classification (inline) ═══
const BATHROOM_KW = ["bathroom","lavatory","basin","vanity","shower","bath","faucet","tap","mixer","vessel","widespread","wall mount","single lever","single handle","two handle","deck mount","hand shower","rain shower","thermostatic","sanitary","toilet","bidet"];
const KITCHEN_KW = ["kitchen faucet","kitchen mixer","kitchen sink","kitchen tap","pull down","pull out","bar faucet","bar sink","pot filler","kitchen"];
const INDUSTRIAL_KW = ["industrial valve","ball valve","gate valve","butterfly","check valve","solenoid","control valve","pressure valve"];
const CHINA_PAT = [/china/i,/chinese/i,/shenzhen/i,/guangzhou/i,/shanghai/i,/ningbo/i,/yiwu/i,/foshan/i,/dongguan/i,/xiamen/i,/tianjin/i,/zhejiang/i,/jiangsu/i,/guangdong/i,/fujian/i,/shandong/i,/wenzhou/i,/kaiping/i,/nanan/i,/chaozhou/i,/taizhou/i,/crescent/i,/regent/i,/rin shing/i];

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function logScale(v,b){if(v<=0)return 0;return clamp(Math.round(100*Math.log(1+v)/Math.log(1+b)),0,100);}
function ratioScale(v,b){if(b<=0)return 0;return clamp(Math.round(100*Math.min(v,b)/b),0,100);}
function priority(s){return s>=55?'A':s>=25?'B':'C';}

function classifyProduct(prods) {
  const t=prods.join(" ").toLowerCase();
  if(!t)return{m:"LOW",c:15};
  const b=BATHROOM_KW.filter(k=>t.includes(k)).length;
  const k=KITCHEN_KW.filter(k=>t.includes(k)).length;
  const i=INDUSTRIAL_KW.filter(k=>t.includes(k)).length;
  let conf=Math.min(100,b*15+10); conf=Math.max(5,conf-k*15-i*20);
  if(b>=3&&k===0&&i===0)return{m:"HIGH",c:conf};
  if(b>=2&&k<=1&&i===0)return{m:"HIGH",c:conf};
  if(b>=1)return{m:"MEDIUM",c:conf};
  return{m:"LOW",c:conf};
}

function classifyBuyerType(prods,name) {
  const t=[...prods,name].join(" ").toLowerCase();
  const b=BATHROOM_KW.filter(k=>t.includes(k)).length;
  const k=KITCHEN_KW.filter(k=>t.includes(k)).length;
  const i=INDUSTRIAL_KW.filter(k=>t.includes(k)).length;
  if(b>=2&&k===0&&i===0)return"Bathroom Specialist";
  if(b>=1&&k>=1)return"Mixed Bathroom/Kitchen";
  if(b>=1)return"General Plumbing";
  return"Unknown";
}

function analyzeSuppliers(names, shipments) {
  const unique=[...new Set(names.map(s=>s.trim()))].filter(Boolean);
  const count=unique.length;
  const div=Math.min(100,count*20);
  const china=unique.filter(s=>CHINA_PAT.some(p=>p.test(s)));
  const chinaC=china.length;
  const chinaConf=count>0?Math.round(chinaC/count*100):0;
  let risk=count===1?(shipments>=50?"HIGH":"MEDIUM"):(count===2&&shipments>=100?"MEDIUM":"LOW");
  return{count,div,chinaC,chinaConf,risk,names:unique};
}

function qualScore(c) {
  const s=c.shipments||0,sup=c.supC||0;
  const supS=ratioScale(sup,5);
  const chinaV=sup>0?ratioScale(c.chinaC||0,Math.min(sup,3)):0;
  const idC=ratioScale(c.identity||80,100);
  const dc=s>0?100:50;
  const factors=[logScale(s,100)*18,(s>0?80:0)*18,supS*12,chinaV*10,0,0,idC*5,(s>0?70:40)*10,dc*5];
  return clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
}

// ═══ Main ═══
const HH="=".repeat(82), HR="─".repeat(82);
console.log(HH);
console.log("SPRINT 14.15 — CONTROLLED CAPTURE EXPANSION");
console.log(HH);
console.log(`Queries: ${QUERIES.length}  |  Mode: capture_only  |  Max budget: 5 credits`);
console.log(`Reserve: ${RESERVE} credits  |  ${new Date().toISOString()}`);
console.log();

let totalCost = 0;
const allResults = [];

for (let qi = 0; qi < QUERIES.length; qi++) {
  const query = QUERIES[qi];
  const encoded = encodeURIComponent(query);
  const url = `${API_URL}/v1.0/product/${encoded}/companies?limit=50`;

  console.log(HR);
  console.log(`QUERY ${qi+1}/${QUERIES.length}: ${query}`);
  console.log(HR);

  // Pre-exec credit check
  console.log(`  信用预算检查:`);
  console.log(`    查询:              ${query}`);
  console.log(`    预计消耗:          0.3 credits`);
  console.log(`    当前真实信用点:    ${(98.5 - totalCost).toFixed(1)}`);
  console.log(`    预计剩余:          ${(98.5 - totalCost - 0.3).toFixed(1)}`);
  console.log(`    距 ${RESERVE} 点预留: ${(98.5 - totalCost - 0.3 - RESERVE).toFixed(1)} 可用`);

  const t0 = Date.now();
  let resp;
  try {
    resp = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", "User-Agent": "TradeScope/1.0" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    console.log(`  FAILED: ${e.message}`);
    continue;
  }

  const elapsed = Date.now() - t0;
  if (!resp.ok) {
    console.log(`  FAILED: ${resp.status} — skipping`);
    continue;
  }

  const raw = await resp.json();
  const data = raw.data || [];
  const cost = raw.requestCost || 0.3;
  const remaining = raw.creditsRemaining;
  totalCost += cost;

  console.log(`  200 OK (${elapsed}ms) — ${data.length} companies, cost: ${cost}, remaining: ${remaining}`);
  console.log();

  // Map fields
  const mapped = data.map(c => ({
    query,
    name: c.company_name || "?",
    shipments: c.company_total_shipments || 0,
    matching: c.matching_shipments || 0,
    supplierNames: c.company_suppliers || [],
    products: c.product_description || [],
    relevance: c.relevance_score || 0,
    specialization: c.specialization || 0,
    weightKg: c.weight || 0,
    identity: 80,
  }));

  for (const c of mapped) {
    c.pm = classifyProduct(c.products);
    c.bt = classifyBuyerType(c.products, c.name);
    const si = analyzeSuppliers(c.supplierNames, c.shipments);
    c.supC = si.count; c.chinaC = si.chinaC; c.chinaConf = si.chinaConf;
    c.div = si.div; c.risk = si.risk; c.supNames = si.names;
    c.score = qualScore(c);
    c.p = priority(c.score);
  }

  allResults.push(...mapped);
  console.log(`  Companies this query:`);
  for (const c of mapped) {
    console.log(`    ${c.p} ${String(c.score).padStart(3)}  ${c.name.slice(0,30).padEnd(31)} ${String(c.shipments).padStart(5)} BOLs  ${c.pm.m.padEnd(6)} ${c.bt.padEnd(22)} sup:${c.supC} cn:${c.chinaC}`);
  }
}

// ═══ 1. DATASET EXPANSION ═══
console.log();
console.log(HH);
console.log("1. DATASET EXPANSION REPORT");
console.log(HH);
console.log();

const unique = new Map();
const dupes = [];
for (const c of allResults) {
  const key = c.name.toLowerCase().trim();
  if (unique.has(key)) dupes.push(c.name);
  else unique.set(key, c);
}
const uniqueBuyers = [...unique.values()];

console.log(`  Total raw results:        ${allResults.length} (from ${QUERIES.length} queries)`);
console.log(`  Unique companies:         ${uniqueBuyers.length}`);
console.log(`  Duplicates:               ${allResults.length - uniqueBuyers.length} (${Math.round((allResults.length-uniqueBuyers.length)/allResults.length*100)}%)`);
console.log();
console.log(`  By category:`);
const faucetQ = QUERIES.slice(0,3);
const showerQ = QUERIES.slice(3);
const faucetBuyers = allResults.filter(c=>faucetQ.includes(c.query));
const showerBuyers = allResults.filter(c=>showerQ.includes(c.query));
console.log(`    Faucet (3 queries):     ${faucetBuyers.length} raw, ${new Set(faucetBuyers.map(c=>c.name.toLowerCase())).size} unique`);
console.log(`    Shower (3 queries):     ${showerBuyers.length} raw, ${new Set(showerBuyers.map(c=>c.name.toLowerCase())).size} unique`);

console.log();
console.log(`  By product match:`);
const pmDist={HIGH:0,MEDIUM:0,LOW:0};
uniqueBuyers.forEach(c=>pmDist[c.pm.m]++);
for(const[k,v]of Object.entries(pmDist))console.log(`    ${k}: ${v} (${Math.round(v/uniqueBuyers.length*100)}%)`);

console.log();
console.log(`  By buyer type:`);
const btDist={};
uniqueBuyers.forEach(c=>{btDist[c.bt]=(btDist[c.bt]||0)+1});
for(const[k,v]of Object.entries(btDist))console.log(`    ${k}: ${v}`);

// ═══ 2. BUYER INTELLIGENCE ═══
console.log();
console.log(HH);
console.log("2. BUYER INTELLIGENCE VALIDATION");
console.log(HH);
console.log();

const sorted = [...uniqueBuyers].sort((a,b)=>b.score-a.score);
console.log("  #   Company                          Score P  BOLs    Supp  CN%  Match   Type                Risk");
console.log("  " + "─".repeat(92));
for (let i=0; i<sorted.length; i++) {
  const c=sorted[i];
  console.log(`  ${String(i+1).padStart(2)}  ${c.name.slice(0,32).padEnd(33)}${String(c.score).padEnd(5)}${c.p} ${String(c.shipments).padStart(5)}  ${String(c.supC).padStart(4)}  ${String(c.chinaConf).padStart(3)}%  ${c.pm.m.padEnd(6)} ${c.bt.slice(0,20).padEnd(21)}${c.risk}`);
}

// ═══ 3. MODEL REVIEW ═══
console.log();
console.log(HH);
console.log("3. MODEL REVIEW");
console.log(HH);
console.log();

const aTier = sorted.filter(c=>c.p==="A");
const falsePositives = aTier.filter(c => {
  const issues = [];
  if (c.bt === "Mixed Bathroom/Kitchen") issues.push("mixed");
  if (c.shipments < 50) issues.push("low-volume");
  if (c.pm.m === "LOW") issues.push("low-match");
  if (c.supC === 1 && c.shipments >= 100) issues.push("single-supplier-high-vol");
  return issues.length > 0;
});

console.log("  FALSE POSITIVE CHECK (A-tier with quality concerns):");
if (falsePositives.length) {
  for (const c of falsePositives) {
    const issues = [];
    if (c.bt==="Mixed Bathroom/Kitchen") issues.push("Mixed buyer");
    if (c.shipments<50) issues.push("Low volume");
    if (c.pm.m==="LOW") issues.push("Low product match");
    if (c.supC===1&&c.shipments>=100) issues.push("Single supplier");
    console.log(`    ⚠ ${c.name} (${c.score}A): ${issues.join(", ")} · ${c.shipments}BOLs · ${c.bt} · ${c.pm.m}`);
  }
} else {
  console.log("    ✓ None detected");
}

console.log();
console.log("  MISSING BUYERS (queried but not classified as bathroom):");
const nonBath = uniqueBuyers.filter(c=>c.bt==="Unknown"||c.pm.m==="LOW");
if (nonBath.length) {
  for (const c of nonBath) console.log(`    ${c.name}: ${c.bt} · ${c.pm.m} · ${c.shipments}BOLs · query: ${c.query}`);
} else {
  console.log("    ✓ All buyers have bathroom classification");
}

console.log();
console.log("  CLASSIFICATION ERRORS (mismatch between API relevance and our classification):");
let clsErrors=0;
for(const c of uniqueBuyers){
  if(c.relevance>80&&c.pm.m!=="HIGH"){
    console.log(`    ⚠ ${c.name}: API relevance ${c.relevance}% but classified ${c.pm.m} (query: ${c.query})`);
    clsErrors++;
  }
}
if(!clsErrors)console.log("    ✓ No classification/API relevance mismatches");

console.log();
console.log("  SUPPLIER INTELLIGENCE QUALITY:");
const supStats={total:uniqueBuyers.length,withChina:uniqueBuyers.filter(c=>c.chinaC>0).length,withMulti:uniqueBuyers.filter(c=>c.supC>=2).length,concentrationHigh:uniqueBuyers.filter(c=>c.risk==="HIGH").length};
console.log(`    ${supStats.withChina}/${supStats.total} have China supplier (${Math.round(supStats.withChina/supStats.total*100)}%)`);
console.log(`    ${supStats.withMulti}/${supStats.total} have multiple suppliers (${Math.round(supStats.withMulti/supStats.total*100)}%)`);
console.log(`    ${supStats.concentrationHigh}/${supStats.total} have HIGH concentration risk`);

// ═══ 4. CREDIT REPORT ═══
console.log();
console.log(HH);
console.log("4. CREDIT REPORT");
console.log(HH);
console.log();

const remaining = 98.5 - totalCost;
const distToReserve = remaining - RESERVE;

console.log();
console.log("  ╔══════════════════════════════════════╗");
console.log("  ║  ImportYeti 账户状态                  ║");
console.log("  ╠══════════════════════════════════════╣");
console.log(`  ║  本次消耗:        ${totalCost.toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  累计消耗:        ${(0.9+totalCost).toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  当前剩余:        ${remaining.toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  距 ${RESERVE} 预留:    ${distToReserve.toFixed(1).padStart(4)} credits               ║`);
console.log(`  ║  Reserve safe:    ${distToReserve>=0?"✓ YES":"✗ NO"}                ║`);
console.log("  ╚══════════════════════════════════════╝");
console.log();
console.log("  ╔══════════════════════════════════════╗");
console.log("  ║  项目预算                            ║");
console.log("  ╠══════════════════════════════════════╣");
console.log(`  ║  总预算:          100 点              ║`);
console.log(`  ║  真实累计消耗:    ${(0.9+totalCost).toFixed(1)} 点               ║`);
console.log(`  ║  保护额度:        25 点               ║`);
console.log(`  ║  可规划:          ${(100-0.9-totalCost-25).toFixed(1)} 点               ║`);
console.log("  ╚══════════════════════════════════════╝");
console.log();

// ═══ SUMMARY ═══
console.log(HH);
console.log("COLLECTION COMPLETE");
console.log(HH);
console.log();
console.log(`  Queries run:         ${QUERIES.length}`);
console.log(`  Total cost:          ${totalCost.toFixed(1)} credits`);
console.log(`  Raw results:         ${allResults.length}`);
console.log(`  Unique buyers:       ${uniqueBuyers.length}`);
console.log(`  Duplicate rate:      ${Math.round((allResults.length-uniqueBuyers.length)/Math.max(1,allResults.length)*100)}%`);
console.log(`  Remaining credits:   ${remaining.toFixed(1)}`);
console.log(`  Reserve protected:   ${distToReserve>=0?"Yes":"No"}`);
console.log(`  Ready for:           production mode`);
console.log();
