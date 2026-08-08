/**
 * ImportYeti Reports — Sprint 14.8
 *
 * Three separate report sections:
 *   A. ImportYeti account status (real API account)
 *   B. Project budget tracking (internal 100-credit budget)
 *   C. Operation credit report (per-query usage)
 *
 * Every report clearly shows execution mode (dry_run / capture_only / production).
 * Dry-run reports explicitly state "未消耗真实信用点".
 */

import type { CaptureReport, CreditUsageReport, ExecutionMode } from "./importyeti-capture-mode.ts";

// ─────── A. ImportYeti Account Status ───────

export function formatImportYetiAccountStatus(
  report: CreditUsageReport,
): string {
  const balance = report.importYetiAccountCredits !== null
    ? `${report.importYetiAccountCredits} 点`
    : "未知（API 未提供余额信息）";

  return [
    "",
    "========== ImportYeti 账户状态 ==========",
    "",
    `真实账户余额:    ${balance}`,
    "数据来源:        ImportYeti API",
    "",
    "================================",
    "",
  ].join("\n");
}

// ─────── B. Project Budget Tracking ───────

export function formatProjectBudget(report: CreditUsageReport): string {
  const modeLabel: Record<ExecutionMode, string> = {
    dry_run: "模拟模式（未消耗真实信用点）",
    capture_only: "捕获模式（仅验证，未入库）",
    production: "生产模式（完整入库）",
  };

  return [
    "",
    "========== 项目预算统计 ==========",
    "",
    `项目总预算:        ${report.totalBudget} 点`,
    `保护额度:          ${report.reserveBudget} 点`,
    `执行模式:          ${modeLabel[report.executionMode]}`,
    "",
    `累计真实消耗:      ${report.totalBudget - report.creditsAfter} 点`,
    `剩余可规划额度:    ${report.remainingAvailable} 点`,
    "",
    "================================",
    "",
  ].join("\n");
}

// ─────── C. Operation Credit Report ───────

export function formatOperationCreditReport(
  report: CreditUsageReport,
  query: string,
  success: boolean,
): string {
  const modeLabel: Record<ExecutionMode, string> = {
    dry_run: "模拟执行 (dry_run)",
    capture_only: "捕获验证 (capture_only)",
    production: "正式执行 (production)",
  };

  if (!success) {
    return [
      "",
      "========== 信用额度使用报告 ==========",
      "",
      "本次任务失败",
      `执行模式:    ${modeLabel[report.executionMode]}`,
      `信用点消耗:  0 点`,
      `当前剩余:    ${report.creditsBefore} 点`,
      "",
      "================================",
      "",
    ].join("\n");
  }

  const isDryRun = report.executionMode === "dry_run";
  const statusText = isDryRun
    ? "模拟执行，未消耗真实信用点"
    : "成功";

  const actualLine = isDryRun
    ? `  实际消耗:    0 点（模拟执行）`
    : `  实际消耗:    ${report.actualCost} 点`;

  return [
    "",
    "========== 信用额度使用报告 ==========",
    "",
    `数据源:        ImportYeti`,
    `任务:          ${query}`,
    `执行模式:      ${modeLabel[report.executionMode]}`,
    `状态:          ${statusText}`,
    "",
    `  预计消耗:    ${report.estimatedCost} 点`,
    actualLine,
    "",
    ...(isDryRun ? [
      "",
      "  ⚠ 当前为模拟执行模式",
      "  ⚠ 未调用真实 ImportYeti API",
      "  ⚠ 未消耗任何信用点",
      "  ⚠ 如需真实执行，请将 executionMode 设为 capture_only 或 production",
      "",
    ] : []),
    "================================",
    "",
  ].join("\n");
}

// ─────── D. Pre-Execution Approval ───────

export function formatPreExecutionApproval(
  query: string,
  mode: ExecutionMode,
  estimatedCost: number,
  currentCredits: number,
  remainingAfter: number,
): string {
  const modeLabel: Record<ExecutionMode, string> = {
    dry_run: "模拟 (dry_run)",
    capture_only: "捕获 (capture_only)",
    production: "正式 (production)",
  };

  const isDryRun = mode === "dry_run";

  return [
    "",
    "╔══════════════════════════════════════╗",
    "║  执行前信用检查                      ║",
    "╠══════════════════════════════════════╣",
    `║  查询:          ${query.padEnd(20)} ║`,
    `║  执行模式:      ${modeLabel[mode].padEnd(20)} ║`,
    `║  预计消耗:      ${isDryRun ? "0 (模拟)".padEnd(20) : String(estimatedCost) + " credits".padEnd(20)} ║`,
    `║  当前余额:      ${String(currentCredits).padEnd(2)} credits              ║`,
    `║  执行后余额:    ${String(remainingAfter).padEnd(2)} credits              ║`,
    ...(isDryRun ? [
      "╠══════════════════════════════════════╣",
      "║  ⚠ 模拟模式 — 不消耗真实信用点        ║",
    ] : [
      "╠══════════════════════════════════════╣",
      "║  需要审批确认后才能执行。              ║",
    ]),
    "╚══════════════════════════════════════╝",
    "",
  ].join("\n");
}

// ─────── E. Collection Summary ───────

export function formatCollectionSummary(
  report: CaptureReport,
): string {
  const rec = report.records;
  const risks: string[] = [];
  if (report.fieldSummary.importantMissing.length > 0) {
    risks.push(`部分字段缺失: ${report.fieldSummary.importantMissing.join("、")}`);
  }
  const needsReview = rec.totalCompanies - rec.uniqueNames;
  if (rec.withWebsite === 0) risks.push("所有公司缺少官网");
  if (needsReview > 0) risks.push(`有 ${needsReview} 家公司名称可能需要合并`);
  if (!risks.length) risks.push("无");

  const proceed = report.readyForFullPipeline ? "是 ✓" : "否 ✗";
  const modeLabel: Record<ExecutionMode, string> = {
    dry_run: "模拟 (dry_run)",
    capture_only: "捕获 (capture_only)",
    production: "正式 (production)",
  };

  return [
    "",
    "========== 数据采集结果报告 ==========",
    "",
    `查询:          ${report.query}`,
    `数据来源:      ImportYeti`,
    `执行模式:      ${modeLabel[report.executionMode]}`,
    "",
    "采集结果:",
    `  发现公司:              ${rec.totalCompanies} 家`,
    `  包含 Shipment:         ${rec.withShipmentData} 家`,
    `  无 Shipment 数据:      ${rec.withoutShipmentData} 家`,
    `  有官网:                ${rec.withWebsite} 家`,
    `  有地址:                ${rec.withAddress} 家`,
    "",
    "数据质量:",
    `  高质量买家:            ${rec.withShipmentData}`,
    `  候选买家:              ${rec.withoutShipmentData}`,
    `  需要人工检查:          ${needsReview}`,
    "",
    "主要风险:",
    ...risks.map(r => `  - ${r}`),
    "",
    `是否建议进入正式 Pipeline:  ${proceed}`,
    "",
    ...(report.status === "blocked"
      ? [`阻塞原因: ${report.errors.join("; ")}`, ""]
      : []),
    "================================",
    "",
  ].join("\n");
}

// ─────── F. Combined Full Report ───────

export function buildFullReport(
  query: string,
  report: CaptureReport,
  success: boolean,
  estimatedCost: number,
  currentCredits: number,
): string {
  const isDryRun = report.executionMode === "dry_run";
  const remainingAfter = currentCredits - (success && !isDryRun ? report.creditReport.actualCost : 0);

  const preExecution = formatPreExecutionApproval(query, report.executionMode, estimatedCost, currentCredits, remainingAfter);
  const accountStatus = formatImportYetiAccountStatus(report.creditReport);
  const budget = formatProjectBudget(report.creditReport);
  const operation = formatOperationCreditReport(report.creditReport, query, success);
  const collection = formatCollectionSummary(report);

  return [preExecution, accountStatus, budget, operation, collection].join("\n");
}
