import { NextRequest, NextResponse } from "next/server";
import { createProductionImportYetiGateway } from "../../_shared/importyeti-paid-production";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { requestId?: string; parameters?: Record<string, unknown> };
    if (!body.requestId || !body.parameters) {
      return NextResponse.json({ status: "failed", reason: "requestId and parameters are required" }, { status: 400 });
    }

    const gateway = createProductionImportYetiGateway();
    const result = await gateway.execute(body.requestId, body.parameters);

    if (result.status === "failed" || result.status === "execution_disabled") {
      return NextResponse.json(result, { status: result.status === "execution_disabled" ? 501 : 422 });
    }
    if (result.status === "reapproval_required") {
      return NextResponse.json(result, { status: 409 });
    }
    if (result.status === "credit_required") {
      return NextResponse.json(result, { status: 402 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        reason: error instanceof Error ? error.message : "ImportYeti execution failed",
      },
      { status: 500 },
    );
  }
}
