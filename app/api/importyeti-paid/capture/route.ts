/**
 * ImportYeti Capture-Only Route — Sprint 14.5
 *
 * POST /api/importyeti-paid/capture
 *
 * Safe first-run mode: calls the API, validates the response,
 * returns a detailed report, but does NOT update ranking tables.
 *
 * Body: { query: "lavatory faucet", hsCode?: "8481.80" }
 *
 * After this report confirms the API works correctly,
 * regular execution (POST /api/importyeti-paid/execute) enables
 * the full pipeline including ranking, qualification, and entity storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { executeCaptureOnly } from "../../_shared/importyeti-capture-mode.ts";
import { buildFullReport } from "../../_shared/importyeti-reports.ts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      query?: string;
      hsCode?: string;
      executionMode?: "dry_run" | "capture_only";
    };

    const query = body.query?.trim();
    const mode = body.executionMode || "capture_only";

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { status: "failed", reason: "query is required (e.g. 'lavatory faucet')" },
        { status: 400 },
      );
    }

    if (query.length > 200) {
      return NextResponse.json(
        { status: "failed", reason: "query too long (max 200 chars)" },
        { status: 400 },
      );
    }

    // Dry-run mode: skip real API, generate simulated report
    if (mode === "dry_run") {
      return handleDryRun(query, body.hsCode?.trim());
    }

    // Capture-only: call real API
    const envVars: Record<string, string | undefined> = {
      IMPORTYETI_API_KEY: (env as Record<string, string>).IMPORTYETI_API_KEY,
      IMPORTYETI_API_URL: (env as Record<string, string>).IMPORTYETI_API_URL,
    };

    const result = await executeCaptureOnly(envVars, query, "capture_only", body.hsCode?.trim());
    const { report, raw, actualCost } = result;

    const fullReportText = buildFullReport(query, report, true, report.creditReport.estimatedCost, report.creditReport.creditsBefore);
    console.log(fullReportText);

    return NextResponse.json({
      mode: "capture_only",
      executionMode: "capture_only",
      status: report.status,
      query: report.query,
      actualCost,
      creditReport: report.creditReport,
      report,
      reportText: fullReportText,
      rawPreview: {
        totalResults: raw.totalResults, page: raw.page,
        companyCount: raw.companies.length,
        sampleNames: raw.companies.slice(0, 10).map(c => c.name),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown capture error";
    const isKeyError = message.includes("IMPORTYETI_API_KEY");
    const isUrlError = message.includes("IMPORTYETI_API_URL");
    const isTimeout = message.includes("timed out");

    const errorReport = {
      executionMode: "capture_only" as const,
      query: "", capturedAt: new Date().toISOString(),
      creditReport: {
        executionMode: "capture_only" as const,
        totalBudget: 100, reserveBudget: 25, creditsBefore: 100,
        estimatedCost: 0, actualCost: 0, creditsAfter: 100,
        remainingAvailable: 75, reserveRemaining: 25,
        percentOfTotalUsed: 0, importYetiAccountCredits: null,
      },
      records: { totalCompanies: 0, withShipmentData: 0, withoutShipmentData: 0, withWebsite: 0, withAddress: 0, withCountry: 0, uniqueNames: 0 },
      fieldSummary: { criticalMissing: [], importantMissing: [], optionalMissing: [] },
      fieldPresence: [], sampleCompanies: [], warnings: [], errors: [message],
      status: "blocked" as const, readyForFullPipeline: false,
    };

    const fullReportText = buildFullReport("", errorReport, false, 0, 100);

    return NextResponse.json(
      {
        mode: "capture_only", executionMode: "capture_only",
        status: "blocked", error: message,
        errorType: isKeyError ? "missing_key" : isUrlError ? "missing_url" : isTimeout ? "timeout" : "api_error",
        readyForFullPipeline: false,
        reportText: fullReportText,
      },
      { status: isKeyError || isUrlError ? 503 : 502 },
    );
  }
}

import type { CaptureReport, CreditUsageReport } from "../../_shared/importyeti-capture-mode.ts";

function handleDryRun(query: string, hsCode?: string): NextResponse {
  const report: CaptureReport = {
    executionMode: "dry_run",
    status: "ok",
    query,
    capturedAt: new Date().toISOString(),
    creditReport: {
      executionMode: "dry_run",
      totalBudget: 100, reserveBudget: 25,
      creditsBefore: 100, estimatedCost: 4, actualCost: 0,
      creditsAfter: 100, remainingAvailable: 75, reserveRemaining: 25,
      percentOfTotalUsed: 0, importYetiAccountCredits: null,
    },
    records: { totalCompanies: 0, withShipmentData: 0, withoutShipmentData: 0, withWebsite: 0, withAddress: 0, withCountry: 0, uniqueNames: 0 },
    fieldSummary: { criticalMissing: [], importantMissing: [], optionalMissing: [] },
    fieldPresence: [], sampleCompanies: [],
    warnings: ["dry_run 模式 — 未调用真实 ImportYeti API"],
    errors: [],
    readyForFullPipeline: false,
  };

  const fullReportText = buildFullReport(query, report, true, 4, 100);
  console.log(fullReportText);

  return NextResponse.json({
    mode: "dry_run",
    executionMode: "dry_run",
    status: "ok",
    query,
    actualCost: 0,
    creditReport: report.creditReport,
    report,
    reportText: fullReportText,
    rawPreview: null,
  });
}
