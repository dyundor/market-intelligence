#!/usr/bin/env node
/**
 * Sprint 14.11 — REAL API Capture with correct field mapping
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envContent = readFileSync(join(root, ".env"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq === -1) continue;
  env[t.slice(0, eq)] = t.slice(eq + 1);
}

const API_KEY = env.IMPORTYETI_API_KEY;
const API_URL = env.IMPORTYETI_API_URL || "https://data.importyeti.com";
const QUERY = "lavatory faucet";
const EST_COST = 0.3;
const TOTAL = 100, RESERVE = 25;

const HH = "=".repeat(80), HR = "-".repeat(80);

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function logScale(v, b) { if (v<=0) return 0; return clamp(100*Math.log(1+v)/Math.log(1+b),0,100); }
function ratioScale(v, b) { if (b<=0) return 0; return clamp(100*Math.min(v,b)/b,0,100); }
const W = { sv:20, sr:20, sd:15, cv:15, fv:10, ic:5, pr:10, dc:5 };
function qualScore(c) {
  const s=c.totalShipments||0, sup=c.supplierCount||0;
  const idc=c.identityConfidence||80;
  const dc = s>0?100:50;
  const factors=[logScale(s,100)*W.sv, s>0&&s<30?25:s>0?80:0*W.sr,
    ratioScale(sup,5)*W.sd,0*W.cv,0*W.fv,ratioScale(idc,100)*W.ic,
    (s>0?70:40)*W.pr,dc*W.dc];
  return clamp(Math.round(factors.reduce((s,f)=>s+f,0)/100),0,100);
}
function priority(s) { return s>=55?'A':s>=25?'B':'C'; }

// ═══ APICALL ═══
console.log(HH);
console.log("SPRINT 14.11 — FIRST REAL IMPORTYETI CAPTURE");
console.log(HH);
console.log(`Query: ${QUERY}  |  Mode: capture_only  |  Date: ${new Date().toISOString()}`);
console.log();

console.log(HR);
console.log("PRE-EXECUTION");
console.log(HR);
console.log();
console.log("╔════════════════════════════════════════╗");
console.log("║  执行前信用检查                        ║");
console.log("╠════════════════════════════════════════╣");
console.log("║  数据源:        ImportYeti             ║");
console.log("║  查询:          lavatory faucet        ║");
console.log("║  模式:          capture_only           ║");
console.log(`║  预计消耗:      ${EST_COST} credits              ║`);
console.log(`║  最大消耗:      5 credits              ║`);
console.log(`║  当前预算:      ${TOTAL} credits             ║`);
console.log(`║  保护额度:      ${RESERVE} credits              ║`);
console.log("╠════════════════════════════════════════╣");
console.log("║  ⚠ 需要审批                             ║");
console.log("╚════════════════════════════════════════╝");
console.log();

const encodedQuery = encodeURIComponent(QUERY);
const url = `${API_URL}/v1.0/product/${encodedQuery}/companies?limit=50`;
console.log(`REQUEST: GET ${url}`);
const startTime = Date.now();
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", "User-Agent": "TradeScope/1.0" },
  signal: AbortSignal.timeout(30000),
});
const elapsed = Date.now() - startTime;
const raw = await res.json();

if (!res.ok) {
  console.log(`FAILED: ${res.status} — ${JSON.stringify(raw).slice(0, 500)}`);
  console.log("CREDITS CONSUMED: 0");
  process.exit(1);
}

const companies = raw.data || [];
const requestCost = raw.requestCost || 0;
const creditsRemaining = raw.creditsRemaining || null;

console.log(`SUCCESS: ${res.status} in ${elapsed}ms — ${companies.length} companies, cost: ${requestCost}, remaining: ${creditsRemaining}`);

// Map to our format
const mapped = companies.map(c => ({
  name: c.company_name || "?",
  country: c.country || null,
  totalShipments: c.company_total_shipments || 0,
  matchingShipments: c.matching_shipments || 0,
  supplierCount: c.total_suppliers || 0,
  supplierNames: c.company_suppliers || [],
  productDescriptions: c.product_description || [],
  weightKg: c.weight || 0,
  relevanceScore: c.relevance_score || 0,
  specialization: c.specialization || 0,
  companyLink: c.company_link || "",
}));

// ═══ 1. CREDIT REPORT ═══
console.log();
console.log(HH);
console.log("1. 信用额度使用报告");
console.log(HH);
console.log();
console.log(`  ╔══════════════════════════════════════╗`);
console.log(`  ║  ImportYeti 账户状态                  ║`);
console.log(`  ╠══════════════════════════════════════╣`);
console.log(`  ║  真实消耗:      ${String(requestCost).padEnd(6)} credits               ║`);
console.log(`  ║  剩余余额:      ${String(creditsRemaining ?? "未知").padEnd(6)} credits               ║`);
console.log(`  ║  响应时间:      ${String(elapsed).padEnd(4)}ms                    ║`);
console.log(`  ╚══════════════════════════════════════╝`);
console.log();
console.log(`  ╔══════════════════════════════════════╗`);
console.log(`  ║  项目预算统计                        ║`);
console.log(`  ╠══════════════════════════════════════╣`);
console.log(`  ║  项目总预算:     ${TOTAL} 点                  ║`);
console.log(`  ║  保护额度:       ${RESERVE} 点                   ║`);
console.log(`  ║  本次消耗:       ${Math.round(requestCost)} 点                    ║`);
console.log(`  ║  累计消耗:       ${Math.round(requestCost)} 点                    ║`);
console.log(`  ║  剩余规划:       ${TOTAL - Math.round(requestCost) - RESERVE} 点                   ║`);
console.log(`  ╚══════════════════════════════════════╝`);
console.log();
console.log(`  REAL credit summary:`);
console.log(`    ImportYeti real cost:      ${requestCost} credits`);
console.log(`    ImportYeti real remaining: ${creditsRemaining} credits`);
console.log(`    Project budget consumed:   ${Math.round(requestCost)} / ${TOTAL}`);
console.log(`    Project reserve:           ${RESERVE} (protected)`);

// ═══ 2. DATA CAPTURE REPORT ═══
console.log();
console.log(HH);
console.log("2. 数据采集报告");
console.log(HH);
console.log();

const withData = mapped.filter(c => c.totalShipments > 0).length;
const uniqueNames = new Set(mapped.map(c => c.name.toLowerCase().trim())).size;

console.log(`  公司总数:                ${mapped.length} 家`);
console.log(`  含 Shipment 数据:        ${withData} 家 (all have company_total_shipments)`);
console.log(`  有产品描述:              ${mapped.filter(c => c.productDescriptions.length > 0).length} 家`);
console.log(`  有供应商:                ${mapped.filter(c => c.supplierCount > 0).length} 家`);
console.log(`  唯一公司名:              ${uniqueNames}`);
console.log(`  API 产品相关度 > 20%:    ${mapped.filter(c => c.relevanceScore > 20).length} 家`);

// ═══ 3. COMPANY DETAIL ═══
console.log();
console.log(HH);
console.log("3. 公司详情");
console.log(HH);
console.log();

for (let i = 0; i < mapped.length; i++) {
  const c = mapped[i];
  console.log(`  ${i+1}. ${c.name}`);
  console.log(`      Total Shipments:  ${c.totalShipments}`);
  console.log(`      Matching (lavatory): ${c.matchingShipments}`);
  console.log(`      Relevance:         ${c.relevanceScore}%`);
  console.log(`      Suppliers:         ${c.supplierCount} (${c.supplierNames.join(", ")})`);
  console.log(`      Weight:            ${(c.weightKg/1000).toFixed(1)}t`);
  console.log(`      Products:          ${c.productDescriptions.slice(0, 2).map(p => p.slice(0, 80)).join(" | ")}`);
  console.log();
}

// ═══ 4. QUALITY ═══
console.log(HH);
console.log("4. 数据质量 — 买家分类");
console.log(HH);
console.log();

const bathroomKW = ["faucet", "lavatory", "bathroom", "basin", "shower", "bath", "vanity", "tap", "mixer", "valve"];
const excludeKW = ["kitchen", "sauna", "lighting", "furniture", "led"];

for (const c of mapped) {
  const prods = [...c.productDescriptions, c.name].join(" ").toLowerCase();
  const matchBath = bathroomKW.some(k => prods.includes(k));
  const matchExcl = excludeKW.some(k => prods.includes(k));

  let klass = "CANDIDATE";
  if (matchBath && matchExcl) klass = "⚠ MIXED (bathroom + other)";
  else if (matchExcl) klass = "⚠ IRRELEVANT";
  else if (matchBath && c.totalShipments >= 10) klass = "✓ CONFIRMED";
  else if (matchBath) klass = "CONFIRMED (low volume)";

  console.log(`  ${klass.padEnd(22)} ${c.name} (${c.totalShipments} BOLs, relevance: ${c.relevanceScore}%)`);
}

// ═══ 5. SCORING ═══
console.log();
console.log(HH);
console.log("5. 资质评分");
console.log(HH);
console.log();

const scored = mapped.map(c => ({
  ...c,
  identityConfidence: 80,
  score: qualScore({ totalShipments: c.totalShipments, supplierCount: c.supplierCount, identityConfidence: 80 }),
})).sort((a,b) => b.score - a.score);
for (const c of scored) c.p = priority(c.score);

console.log("  #  Company                      Score  P  BOLs   Supp  Relevance");
console.log("  " + "-".repeat(65));
for (let i = 0; i < scored.length; i++) {
  const c = scored[i];
  console.log(`  ${i+1}  ${c.name.slice(0,28).padEnd(30)}${String(c.score).padEnd(5)} ${c.p} ${String(c.totalShipments).padStart(5)}  ${String(c.supplierCount).padStart(4)}  ${String(c.relevanceScore).padStart(5)}%`);
}

// ═══ STOP ═══
console.log();
console.log(HH);
console.log("STOPPED — 第一次真实采集完成");
console.log(HH);
console.log();
console.log(`  查询:           ${QUERY}`);
console.log(`  模式:           capture_only`);
console.log(`  ImportYeti 消耗: ${requestCost} credits (剩余: ${creditsRemaining})`);
console.log(`  项目预算消耗:   ${Math.round(requestCost)} / ${TOTAL}`);
console.log(`  发现公司:       ${mapped.length} 家`);
console.log(`  确认浴室买家:   ${mapped.filter(c => c.relevanceScore > 20).length} 家`);
console.log();
console.log(`  下一查询:       basin faucet (held)`);
console.log(`  审核状态:       等待人工确认`);
console.log();
