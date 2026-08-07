import { NextRequest, NextResponse } from "next/server";
import { createQueryEngine } from "../_shared/query-engine-production";

export async function GET(request: NextRequest) {
  const intent = (request.nextUrl.searchParams.get("intent") || "buyer_ranking") as string;
  const subject = request.nextUrl.searchParams.get("subject") || "faucet";
  const market = request.nextUrl.searchParams.get("market") || "US";
  const period = request.nextUrl.searchParams.get("period") || "2026-07";
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)));

  const engine = createQueryEngine();
  const result = await engine.execute({ intent, subject, market, period, ranking: { limit } });
  const status = result.status === "failed" ? 422 : 200;
  return NextResponse.json(result, { status });
}
