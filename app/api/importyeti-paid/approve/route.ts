import { NextRequest,NextResponse } from "next/server";
import { createProductionImportYetiGateway } from "../../_shared/importyeti-paid-production";
import { constantTimeSecretMatch } from "../../_shared/importyeti-credit-policy";

export async function POST(request:NextRequest) {
  const expected = process.env.IMPORTYETI_APPROVAL_ADMIN_KEY;
  const supplied = request.headers.get("x-importyeti-admin-key") || bearer(request.headers.get("authorization"));
  if (!constantTimeSecretMatch(supplied || undefined,expected)) return NextResponse.json({error:expected ? "Invalid administrator credentials" : "Approval is disabled until an administrator key is configured"},{status:403});
  try {
    const body = await request.json() as {requestId?:unknown;action?:unknown;approvedCost?:unknown};
    if (typeof body.requestId !== "string" || (body.action !== "approve" && body.action !== "reject")) return NextResponse.json({error:"requestId and explicit approve/reject action are required"},{status:400});
    if (body.action === "approve" && (typeof body.approvedCost !== "number" || !Number.isFinite(body.approvedCost))) return NextResponse.json({error:"approvedCost is required for approval"},{status:400});
    const result = await createProductionImportYetiGateway().approve(body.requestId,body.action === "approve" ? body.approvedCost as number : 0,body.action === "approve");
    return NextResponse.json(result,{status:result.status === "approved" ? 200 : result.status === "budget_blocked" ? 409 : 422});
  } catch (error) {
    return NextResponse.json({error:"Unable to process ImportYeti approval",detail:error instanceof Error ? error.message : "Unknown error"},{status:500});
  }
}

function bearer(value:string|null) { return value?.startsWith("Bearer ") ? value.slice(7) : null; }
