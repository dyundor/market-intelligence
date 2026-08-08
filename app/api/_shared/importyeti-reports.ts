/**
 * ImportYeti Reports — Sprint 14.7
 *
 * Human-readable Chinese/English reports for paid operations.
 * Every paid operation generates both JSON (machine) and text (human) output.
 */

import type { CaptureReport, CreditUsageReport } from "./importyeti-capture-mode.ts";

// ─────── Credit Usage Report ───────

export function formatCreditReport(
  report: CreditUsageReport,
  query: string,
  success: boolean,
): string {
  if (!success) {
    return [
      "",
      "========== 信用额度使用报告 ==========",
      "",
      "本次任务失败",
      `信用点消耗: 0 点`,
      `当前剩余: ${report.creditsBefore} 点`,
      "",
      "================================",
      "",
    ].join("\n");
  }

  const statusText = report.actualCost > 0 ? "成功" : "成功（无消耗）";

  return [
    "",
    "========== 信用额度使用报告 ==========",
    "",
    `数据源:    ImportYeti`,
    `任务:      ${query}`,
    `执行状态:  ${statusText}`,
    "",
    "执行前:",
    `  总信用额度:      ${report.totalBudget} 点`,
    `  当前剩余:        ${report.creditsBefore} 点`,
    "",
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
    "",
    "================================",
    "",
  ].join("\n");
}

// ─────── Collection Result Summary ───────

export function formatCollectionSummary(
  report: CaptureReport,
): string {
  const rec = report.records;
  const highQuality = rec.withShipmentData;
  const candidateCount = rec.withoutShipmentData;
  const needsReview = rec.totalCompanies - rec.uniqueNames;

  // Risk assessment
  const risks: string[] = [];
  if (report.fieldSummary.importantMissing.length > 0) {
    risks.push(`部分字段缺失: ${report.fieldSummary.importantMissing.join("、")}`);
  }
  if (rec.withWebsite === 0) risks.push("所有公司缺少官网");
  if (needsReview > 0) risks.push(`有 ${needsReview} 家公司名称可能需要合并`);
  if (report.warnings.length > 0) {
    for (const w of report.warnings.slice(0, 3)) {
      const short = w.includes("—") ? w.split("—")[0].trim() : w.slice(0, 60);
      if (!risks.includes(short)) risks.push(short);
    }
  }
  if (risks.length === 0) risks.push("无");

  const canProceed = report.readyForFullPipeline ? "是 ✓" : "否 ✗";

  return [
    "",
    "========== 数据采集结果报告 ==========",
    "",
    `查询:        ${report.query}`,
    `数据来源:    ImportYeti`,
    "",
    "采集结果:",
    `  发现公司:            ${rec.totalCompanies} 家`,
    `  包含 Shipment:       ${rec.withShipmentData} 家`,
    `  无 Shipment 数据:    ${rec.withoutShipmentData} 家`,
    `  有官网:              ${rec.withWebsite} 家`,
    `  有地址:              ${rec.withAddress} 家`,
    "",
    "数据质量:",
    `  高质量买家:          ${highQuality}`,
    `  候选买家:            ${candidateCount}`,
    `  需要人工检查:        ${needsReview}`,
    "",
    "主要风险:",
    ...risks.map(r => `  - ${r}`),
    "",
    `是否建议进入正式 Pipeline:  ${canProceed}`,
    "",
    ...(report.status === "blocked"
      ? [`阻塞原因: ${report.errors.join("; ")}`, ""]
      : []),
    "================================",
    "",
  ].join("\n");
}

// ─────── Pre-Execution Approval Text ───────

export function formatPreExecutionApproval(
  query: string,
  estimatedCost: number,
  currentCredits: number,
  remainingAfter: number,
): string {
  return [
    "",
    "╔══════════════════════════════════════╗",
    "║  执行前信用检查                      ║",
    "╠══════════════════════════════════════╣",
    `║  查询:          ${query.padEnd(20)} ║`,
    `║  预计消耗:      ${String(estimatedCost).padEnd(2)} credits              ║`,
    `║  当前余额:      ${String(currentCredits).padEnd(2)} credits              ║`,
    `║  执行后预计余额: ${String(remainingAfter).padEnd(2)} credits              ║`,
    "╠══════════════════════════════════════╣",
    "║  需要审批确认后才能执行。              ║",
    "╚══════════════════════════════════════╝",
    "",
  ].join("\n");
}

// ─────── Combined full report ───────

export interface FullReport {
  /** Machine-readable JSON */
  json: Record<string, unknown>;
  /** Human-readable Chinese text */
  text: string;
  /** Pre-execution approval text */
  preExecution: string;
}

export function buildFullReport(
  query: string,
  report: CaptureReport,
  success: boolean,
  estimatedCost: number,
  currentCredits: number,
): FullReport {
  const remainingAfter = currentCredits - (success ? report.creditReport.actualCost : 0);

  const preExecution = formatPreExecutionApproval(
    query,
    estimatedCost,
    currentCredits,
    remainingAfter,
  );

  const creditText = formatCreditReport(report.creditReport, query, success);
  const collectionText = formatCollectionSummary(report);

  const text = [preExecution, creditText, collectionText].join("\n");

  const json = {
    query,
    success,
    status: report.status,
    readyForFullPipeline: report.readyForFullPipeline,
    creditReport: report.creditReport,
    records: report.records,
    fieldSummary: report.fieldSummary,
    sampleCompanies: report.sampleCompanies,
    warnings: report.warnings,
    errors: report.errors,
  };

  return { json, text, preExecution };
}
