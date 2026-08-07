import type { CompanyRepository } from "../repositories/company-repository.ts";
import type { ShipmentRepository } from "../repositories/shipment-repository.ts";

export interface CompanyIdentity {
  id: string;
  entityType: string;
  name: string;
  country: string | null;
  website: string | null;
  latestShipmentDate: string | null;
  totalShipments: number | null;
}

export interface CompanyProductActivity {
  category: string;
  shipmentCount: number;
}

export interface CompanyOriginCountry {
  country: string;
  supplierCount: number;
}

export interface CompanyProfile {
  companyId: string;
  identity: CompanyIdentity | null;
  products: CompanyProductActivity[];
  shipmentCount: number;
  supplierCount: number;
  activeMonths: string[];
  activeMonthCount: number;
  lastShipmentDate: string | null;
  originCountries: CompanyOriginCountry[];
  source: string;
  builtAt: string;
}

export interface CompanyProfileDeps {
  shipments: ShipmentRepository;
  companies: CompanyRepository;
}

export async function resolveCompanyId(deps: CompanyProfileDeps, company: string): Promise<string | null> {
  const trimmed = company.trim();
  if (!trimmed) return null;
  const direct = await deps.companies.findById(trimmed);
  if (direct) return trimmed;
  const matches = await deps.companies.findByName(trimmed);
  return matches.length ? String(matches[0].id) : null;
}

export async function buildCompanyProfile(deps: CompanyProfileDeps, companyId: string): Promise<CompanyProfile> {
  const [identity, shipments] = await Promise.all([
    deps.companies.findById(companyId),
    deps.shipments.findByImporter(companyId),
  ]);

  const productCounts = new Map<string, number>();
  const supplierSet = new Set<string>();
  const monthSet = new Set<string>();
  let lastShipmentDate: string | null = null;
  for (const shipment of shipments) {
    productCounts.set(shipment.productCategory, (productCounts.get(shipment.productCategory) || 0) + 1);
    if (shipment.supplierId) supplierSet.add(shipment.supplierId);
    if (shipment.month) monthSet.add(shipment.month);
    if (shipment.shipmentDate && (!lastShipmentDate || shipment.shipmentDate > lastShipmentDate)) {
      lastShipmentDate = shipment.shipmentDate;
    }
  }

  const suppliers = await deps.companies.findByIds([...supplierSet]);
  const originCountries = new Map<string, Set<string>>();
  for (const supplier of suppliers) {
    const country = supplier.country ? String(supplier.country) : "unknown";
    const seen = originCountries.get(country) || new Set<string>();
    seen.add(String(supplier.id));
    originCountries.set(country, seen);
  }
  const activeMonths = [...monthSet].sort();

  return {
    companyId,
    identity: identity
      ? {
          id: String(identity.id),
          entityType: String(identity.entity_type || ""),
          name: String(identity.name || ""),
          country: identity.country ? String(identity.country) : null,
          website: identity.website ? String(identity.website) : null,
          latestShipmentDate: identity.latest_shipment_date ? String(identity.latest_shipment_date) : null,
          totalShipments: identity.total_shipments ? Number(identity.total_shipments) : null,
        }
      : null,
    products: [...productCounts.entries()]
      .map(([category, shipmentCount]) => ({ category, shipmentCount }))
      .sort((left, right) => right.shipmentCount - left.shipmentCount || left.category.localeCompare(right.category)),
    shipmentCount: shipments.length,
    supplierCount: supplierSet.size,
    activeMonths,
    activeMonthCount: activeMonths.length,
    lastShipmentDate,
    originCountries: [...originCountries.entries()]
      .map(([country, ids]) => ({ country, supplierCount: ids.size }))
      .sort((left, right) => right.supplierCount - left.supplierCount || left.country.localeCompare(right.country)),
    source: "shipment_data",
    builtAt: new Date().toISOString(),
  };
}
