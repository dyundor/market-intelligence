import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { ShipmentRepository } from "../../../lib/repositories/shipment-repository.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(10, Number(request.nextUrl.searchParams.get("pageSize") || 20)));
  const month = request.nextUrl.searchParams.get("month") || "";
  const result = await new ShipmentRepository(env.DB).listCompanyShipments(companyId, { month, page, pageSize });
  if (!result) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(result);
}
