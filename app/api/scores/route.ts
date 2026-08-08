import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { ShipmentRepository } from "../../../lib/repositories/shipment-repository.ts";
import { CompanyRepository } from "../../../lib/repositories/company-repository.ts";
import { ScoreRepository } from "../../../lib/repositories/score-repository.ts";
import { buyerScoreFromShipments } from "../../../lib/opportunity/buyer-score.ts";
import { marketScoreFromShipments } from "../../../lib/opportunity/market-score.ts";
import { productScoreFromShipments } from "../../../lib/opportunity/product-score.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const product = request.nextUrl.searchParams.get("product") || "龙头及阀类";
  const market = request.nextUrl.searchParams.get("market") || "美国";
  const buyerId = request.nextUrl.searchParams.get("buyerId") || "";
  const buyerIds = (request.nextUrl.searchParams.get("buyerIds") || "").split(",").filter(Boolean).slice(0, 20);

  const shipments = new ShipmentRepository(env.DB);
  const scores = new ScoreRepository(env.DB);

  const productShipments = await shipments.findByProduct(product);
  const marketResult = marketScoreFromShipments(market, productShipments);
  const productResult = productScoreFromShipments(product, productShipments);
  await scores.save("market", marketResult);
  await scores.save("product", productResult);

  const buyers: Array<ReturnType<typeof buyerScoreFromShipments>> = [];
  const singleBuyer = buyerId ? [buyerId] : [];
  for (const id of [...new Set([...singleBuyer, ...buyerIds])]) {
    const company = await new CompanyRepository(env.DB).findDetailById(id);
    if (!company || company.entity_type !== "importer") continue;
    const buyerShipments = await shipments.findByImporter(id);
    const result = buyerScoreFromShipments(buyerShipments, { entityId: id });
    await scores.save("buyer", result);
    buyers.push(result);
  }

  return NextResponse.json({
    market: marketResult,
    product: productResult,
    buyer: buyers.find(item => item.entityId === buyerId) || null,
    buyers,
    dataset: "importyeti_free_web",
    scope: "Computed on demand from stored company BOL data using the existing opportunity engine (no external calls).",
  });
}
