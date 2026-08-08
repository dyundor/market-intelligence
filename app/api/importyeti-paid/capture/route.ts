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
    };

    if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json(
        { status: "failed", reason: "query is required (e.g. 'lavatory faucet')" },
        { status: 400 },
      );
    }

    if (body.query.length > 200) {
      return NextResponse.json(
        { status: "failed", reason: "query too long (max 200 chars)" },
        { status: 400 },
      );
    }

    const envVars: Record<string, string | undefined> = {
      IMPORTYETI_API_KEY: (env as Record<string, string>).IMPORTYETI_API_KEY,
      IMPORTYETI_API_URL: (env as Record<string, string>).IMPORTYETI_API_URL,
    };

    const result = await executeCaptureOnly(
      envVars,
      body.query.trim(),
      body.hsCode?.trim(),
    );

    const { report, raw, actualCost } = result;

    const fullReport = buildFullReport(
      body.query.trim(),
      report,
      true,
      report.creditReport.estimatedCost,
      report.creditReport.creditsBefore,
    );

    console.log(fullReport.text);

    return NextResponse.json({
      mode: "capture_only",
      status: report.status,
      query: report.query,
      actualCost,
      creditReport: report.creditReport,
      report,
      reportText: fullReport.text,
      rawPreview: {
        totalResults: raw.totalResults,
        page: raw.page,
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
      query: "",
      capturedAt: new Date().toISOString(),
      creditReport: {
        totalBudget: 100, reserveBudget: 25,
        creditsBefore: 100, estimatedCost: 0, actualCost: 0,
        creditsAfter: 100, remainingAvailable: 75, reserveRemaining: 25,
        percentOfTotalUsed: 0,
      },
      records: { totalCompanies: 0, withShipmentData: 0, withoutShipmentData: 0, withWebsite: 0, withAddress: 0, withCountry: 0, uniqueNames: 0 },
      fieldSummary: { criticalMissing: [], importantMissing: [], optionalMissing: [] },
      fieldPresence: [], sampleCompanies: [], warnings: [], errors: [message],
      status: "blocked" as const, readyForFullPipeline: false,
    };

    const fullReport = buildFullReport("", errorReport, false, 0, 100);

    return NextResponse.json(
      {
        mode: "capture_only",
        status: "blocked",
        error: message,
        errorType: isKeyError ? "missing_key" : isUrlError ? "missing_url" : isTimeout ? "timeout" : "api_error",
        readyForFullPipeline: false,
        reportText: fullReport.text,
      },
      { status: isKeyError || isUrlError ? 503 : 502 },
    );
  }
}
