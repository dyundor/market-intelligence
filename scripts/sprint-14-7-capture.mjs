#!/usr/bin/env node
/**
 * Sprint 14.7 — First Real Capture Dry-Run
 *
 * Demonstrates the complete output that would be generated when
 * running the first real capture for "lavatory faucet".
 *
 * Usage:
 *   node scripts/sprint-14-7-capture.mjs
 */

// ── Report formatters (mirrors importyeti-reports.ts) ──
function creditReport(report, query, success) {
  if (!success) {
    return [
      "", "========== 信用额度使用报告 ==========",
      "", "本次任务失败",
      "信用点消耗: 0 点",
      `当前剩余: ${report.creditsBefore} 点`,
      "", "================================", "",
    ].join("\n");
  }
  return [
    "", "========== 信用额度使用报告 ==========",
    "", `数据源:    ImportYeti`,
    `任务:      ${query}`,
    `执行状态:  成功`,
    "",
    "执行前:",
    `  总信用额度:      ${report.totalBudget} 点`,
    `  当前剩余:        ${report.creditsBefore} 点`,
    `  本次预计消耗:    ${report.estimatedCost} 点`,
    "",
    `  本次实际消耗:    ${report.actualCost} 点`,
    "",
    "执行后:",
    `  剩余总额度:      ${report.creditsAfter} 点`,
    `  可继续使用额度:  ${report.remainingAvailable} 点`,
    `  保护额度:        ${report.reserveRemaining} 点`,
    "",
    `  累计使用:        ${report.totalBudget - report.creditsAfter} 点`,
    `  累计使用比例:    ${report.percentOfTotalUsed}%`,
    "", "================================", "",
  ].join("\n");
}

function preExecApproval(query, estimatedCost, current, after) {
  return [
    "", "╔══════════════════════════════════════╗",
    "║  执行前信用检查                      ║",
    "╠══════════════════════════════════════╣",
    `║  查询:          ${query.padEnd(20)} ║`,
    `║  预计消耗:      ${String(estimatedCost).padEnd(2)} credits              ║`,
    `║  当前余额:      ${String(current).padEnd(2)} credits              ║`,
    `║  执行后预计余额: ${String(after).padEnd(2)} credits              ║`,
    "╠══════════════════════════════════════╣",
    "║  需要审批确认后才能执行。              ║",
    "╚══════════════════════════════════════╝", "",
  ].join("\n");
}

function collectionSummary(report) {
  const rec = report.records;
  const risks = [];
  if (report.fieldSummary.importantMissing.length > 0)
    risks.push(`部分字段缺失: ${report.fieldSummary.importantMissing.join("、")}`);
  if (rec.withWebsite === 0) risks.push("所有公司缺少官网");
  if (rec.totalCompanies - rec.uniqueNames > 0)
    risks.push(`有 ${rec.totalCompanies - rec.uniqueNames} 家公司名称可能需要合并`);
  if (!risks.length) risks.push("无");
  const proceed = report.readyForFullPipeline ? "是 ✓" : "否 ✗";
  return [
    "", "========== 数据采集结果报告 ==========",
    "", `查询:        ${report.query}`,
    "数据来源:    ImportYeti",
    "",
    "采集结果:",
    `  发现公司:            ${rec.totalCompanies} 家`,
    `  包含 Shipment:       ${rec.withShipmentData} 家`,
    `  无 Shipment 数据:    ${rec.withoutShipmentData} 家`,
    `  有官网:              ${rec.withWebsite} 家`,
    `  有地址:              ${rec.withAddress} 家`,
    "",
    "数据质量:",
    `  高质量买家:          ${rec.withShipmentData}`,
    `  候选买家:            ${rec.withoutShipmentData}`,
    `  需要人工检查:        ${rec.totalCompanies - rec.uniqueNames}`,
    "",
    "主要风险:",
    ...risks.map(r => `  - ${r}`),
    "",
    `是否建议进入正式 Pipeline:  ${proceed}`,
    "", "================================", "",
  ].join("\n");
}

// ── Simulated capture result (18 companies, good quality) ──
const companies = [];
const companyNames = [
  "Symmons Industries Inc", "California Faucets Inc", "Watermark Designs Ltd",
  "Kingston Brass Inc", "Premier Faucet Co", "Elements of Design Corp",
  "Vigo Industries Llc", "Luxury Bath Collection", "Whitehaus Collection LLC",
  "Phoenix Faucets Co", "Danze Inc", "Pfister Faucets",
  "Hansgrohe USA", "Grohe Americas", "Toto USA Inc",
  "American Standard Brands", "Delta Faucet Company", "Moen Incorporated",
];

for (let i = 0; i < 18; i++) {
  const s = i < 15 ? (18 - i) * 35 : 0;
  companies.push({
    id: `importyeti_lavatory_faucet_${i}`,
    name: companyNames[i],
    address: i < 14 ? `${100 + i * 10} Commerce Way, City, CA` : undefined,
    country: "United States",
    countryCode: i < 16 ? "US" : undefined,
    website: i < 12 ? `https://www.${companyNames[i].toLowerCase().replace(/[^a-z]/g, "")}.com` : undefined,
    totalShipments: s,
    latestShipmentDate: i < 15 ? `2026-0${Math.min(7, Math.ceil((18 - i) / 3))}-15` : undefined,
    supplierCount: i < 14 ? Math.min(i % 8 + 1, 10) : undefined,
    productDescriptions: i < 15 ? ["bathroom faucet", "lavatory basin mixer", "vanity faucet"] : [],
  });
}

const report = {
  query: "lavatory faucet",
  status: "ok",
  readyForFullPipeline: true,
  capturedAt: new Date().toISOString(),
  creditReport: {
    totalBudget: 100, reserveBudget: 25,
    creditsBefore: 100, estimatedCost: 4, actualCost: 3,
    creditsAfter: 97, remainingAvailable: 72, reserveRemaining: 25,
    percentOfTotalUsed: 3,
  },
  records: {
    totalCompanies: 18, withShipmentData: 15, withoutShipmentData: 3,
    withWebsite: 12, withAddress: 14, withCountry: 18, uniqueNames: 18,
  },
  fieldSummary: { criticalMissing: [], importantMissing: [], optionalMissing: ["countryCode"] },
  sampleCompanies: companies.slice(0, 5).map(c => ({
    name: c.name, country: c.country, totalShipments: c.totalShipments,
    latestShipmentDate: c.latestShipmentDate, supplierCount: c.supplierCount,
    website: c.website ? "✓" : "✗", address: c.address ? "✓" : "✗",
  })),
  warnings: [],
  errors: [],
};

// ── OUTPUT ──
console.log("=".repeat(78));
console.log("SPRINT 14.7 — FIRST REAL CAPTURE (DRY-RUN)");
console.log("=".repeat(78));
console.log(`Query:    lavatory faucet`);
console.log(`HS Code:  8481.80`);
console.log(`Date:     ${new Date().toISOString()}`);
console.log();

// 1. Pre-execution approval
console.log(preExecApproval("lavatory faucet", 4, 100, 96));

// 2. Simulated execution
console.log("─".repeat(78));
console.log("EXECUTING...");
console.log("  → POST /api/importyeti-paid/capture");
console.log(`  → GET ${process.env.IMPORTYETI_API_URL || "https://api.importyeti.com"}/search?q=lavatory+faucet&entity_type=importer&hs_code=8481.80&limit=50`);
console.log("  → Response received: 200 OK");
console.log("  → Validating 18 companies...");
console.log("  → All 2 critical fields present ✓");
console.log("  → 1 optional field missing (countryCode) - informational");
console.log("  → Validation PASSED");
console.log("─".repeat(78));
console.log();

// 3. Credit usage report
console.log(creditReport(report.creditReport, "lavatory faucet", true));

// 4. Collection summary
console.log(collectionSummary(report));

// 5. Sample companies
console.log("─".repeat(78));
console.log("SAMPLE COMPANIES (top 5 by shipment count)");
console.log("─".repeat(78));
console.log();
for (const c of report.sampleCompanies) {
  console.log(`  ${c.name}`);
  console.log(`    Country:     ${c.country}`);
  console.log(`    Shipments:   ${c.totalShipments}`);
  console.log(`    Last seen:   ${c.latestShipmentDate}`);
  console.log(`    Suppliers:   ${c.supplierCount}`);
  console.log(`    Website:     ${c.website}`);
  console.log(`    Address:     ${c.address}`);
  console.log();
}

// 6. Pipeline validation
console.log("─".repeat(78));
console.log("PIPELINE VALIDATION (after entering full execution)");
console.log("─".repeat(78));
console.log();
console.log("  ✓ Normalizer:     rankBuyers() will sort by shipment_count");
console.log("  ✓ Identity:       companyIdentityKey will normalize all 18 names");
console.log("  ✓ Shipments:      ON CONFLICT(id) DO NOTHING — idempotent");
console.log("  ✓ Relationships:  new supplier→importer links created");
console.log("  ✓ Ranking:        buyer_monthly_rankings updated");
console.log("  ✓ Qualification:  8-factor scoring applied to all new buyers");

// 7. What happens next
console.log();
console.log("=".repeat(78));
console.log("NEXT STEPS");
console.log("=".repeat(78));
console.log();
console.log("  After capture validation passes:");
console.log();
console.log("  1. POST /api/importyeti-paid");
console.log("     { operation: \"importyeti_company_search\",");
console.log("       parameters: { query: \"lavatory faucet\", hs_code: \"8481.80\" } }");
console.log();
console.log("  2. POST /api/importyeti-paid/approve");
console.log("     { requestId: \"...\", approvedCost: 3, approve: true }");
console.log();
console.log("  3. POST /api/importyeti-paid/execute");
console.log("     { requestId: \"...\", parameters: { query: \"lavatory faucet\" } }");
console.log();
console.log("  This will persist data to importyeti_web_entities,");
console.log("  importyeti_web_relationships, importyeti_web_shipments,");
console.log("  and buyer_monthly_rankings.");
console.log();

// 8. Machine JSON (what API actually returns)
console.log("─".repeat(78));
console.log("API RESPONSE (machine-readable JSON)");
console.log("─".repeat(78));
const apiJson = {
  mode: "capture_only",
  status: "ok",
  query: "lavatory faucet",
  actualCost: 3,
  creditReport: report.creditReport,
  report: {
    records: report.records,
    fieldSummary: report.fieldSummary,
    sampleCompanies: report.sampleCompanies,
    warnings: report.warnings,
    errors: report.errors,
    readyForFullPipeline: true,
  },
  rawPreview: {
    totalResults: 18,
    page: 1,
    companyCount: 18,
    sampleNames: companies.slice(0, 10).map(c => c.name),
  },
  reportText: "(see human-readable report above)",
};
console.log(JSON.stringify(apiJson, null, 2));

console.log();
console.log("=".repeat(78));
console.log("DRY-RUN COMPLETE");
console.log("=".repeat(78));
