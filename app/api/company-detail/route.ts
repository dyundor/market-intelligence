import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { CompanyRepository } from "../../../lib/repositories/company-repository.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  const repository = new CompanyRepository(env.DB);
  const company = await repository.findDetailById(id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const entityType = company.entity_type === "importer" ? "importer" : "supplier";
  const relations = await repository.listRelationships(id, entityType);
  const monthly = await repository.monthlyBreakdown(id, entityType);
  const aliases = await repository.listAliases(id);
  return NextResponse.json({
    company,
    aliases,
    relationshipRole: entityType === "importer" ? "upstream_suppliers" : "downstream_importers",
    relationships: relations,
    monthlyBreakdown: monthly,
    dataset: "importyeti_free_web",
    scope: "All stored relationships for this company; not restricted by the search category.",
  });
}
