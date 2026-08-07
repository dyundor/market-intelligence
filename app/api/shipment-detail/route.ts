import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { ShipmentRepository } from "../../../lib/repositories/shipment-repository.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  const shipment = await new ShipmentRepository(env.DB).findById(id);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  return NextResponse.json({ shipment, dataset: "importyeti_free_web", disclaimer: "Displayed date follows the source page date basis; estimated freight is not declared cargo value." });
}
