import { NextRequest,NextResponse } from "next/server";
import { createProductionImportYetiGateway,D1UsageStore } from "../_shared/importyeti-paid-production";
import type { QueryParameters } from "../_shared/importyeti-credit-policy";

export async function GET(request:NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({error:"Request id is required"},{status:400});
  try {
    const usage = await new D1UsageStore().get(id);
    return usage ? NextResponse.json({request:usage}) : NextResponse.json({error:"Usage request not found"},{status:404});
  } catch (error) {
    return NextResponse.json({error:"Usage database unavailable",detail:error instanceof Error ? error.message : "Unknown error"},{status:503});
  }
}

export async function POST(request:NextRequest) {
  try {
    const body = await request.json() as {operation?:unknown;parameters?:unknown};
    if (typeof body.operation !== "string" || !isParameters(body.parameters)) return NextResponse.json({error:"A registered operation and JSON parameters are required"},{status:400});
    const result = await createProductionImportYetiGateway().preflight(body.operation,body.parameters);
    const status = result.status === "failed" ? 422 : result.status === "budget_blocked" ? 409 : 200;
    return NextResponse.json(result,{status});
  } catch (error) {
    return NextResponse.json({error:"Unable to create ImportYeti usage request",detail:error instanceof Error ? error.message : "Unknown error"},{status:500});
  }
}

function isParameters(value:unknown):value is QueryParameters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(item => item === null || ["string","number","boolean"].includes(typeof item) || (Array.isArray(item) && item.every(entry => entry === null || ["string","number","boolean"].includes(typeof entry))));
}
