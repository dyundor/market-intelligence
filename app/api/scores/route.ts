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

  const shipments = new ShipmentRepository(env.DB);
  const scores = new ScoreRepository(env.DB);

  const productShipments = await shipments.findByProduct(product);
  const marketResult = marketScoreFromShipments(market, productShipments);
  const productResult = productScoreFromShipments(product, productShipments);
  await scores.save("market", marketResult);
  await scores.save("product", productResult);

  let buyerResult = null;
  if (buyerId) {
    const company = await new CompanyRepository(env.DB).findDetailById(buyerId);
    if (company && company.entity_type === "importer") {
      const buyerShipments = await shipments.findByImporter(buyerId);
      buyerResult = buyerScoreFromShipments(buyerShipments, { entityId: buyerId });
      await scores.save("buyer", buyerResult);
    }
  }

  return NextResponse.json({
    market: marketResult,
    product: productResult,
    buyer: buyerResult,
    dataset: "importyeti_free_web",
    scope: "Computed on demand from stored company BOL data using the existing opportunity engine (no external calls).",
  });
}
