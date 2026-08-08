/**
 * Supplier Intelligence — Sprint 14.13
 *
 * Analyses buyer-supplier relationships for sales signals.
 * Key signals for Yundor: Chinese supplier connections, diversity, concentration risk.
 */

import type { SupplierIntelligence } from "./types.ts";

// ─────── China-related keywords for supplier country detection ───────

const CHINA_SUPPLIER_PATTERNS = [
  /china/i, /chinese/i, /shenzhen/i, /guangzhou/i, /shanghai/i,
  /ningbo/i, /yiwu/i, /foshan/i, /dongguan/i, /xiamen/i, /tianjin/i,
  /zhejiang/i, /jiangsu/i, /guangdong/i, /fujian/i, /shandong/i,
  /wenzhou/i, /kaiping/i, /nanan/i, /chaozhou/i, /taizhou/i,
  /crescent/i, /regent/i, /rin shing/i,
];

// ─────── Analysis ───────

export function analyzeSupplierIntelligence(
  supplierNames: string[],
  totalShipments: number,
): SupplierIntelligence {
  const uniqueSuppliers = [...new Set(supplierNames.map(s => s.trim()))].filter(Boolean);
  const supplierCount = uniqueSuppliers.length;

  // Diversity: scale 0-100 based on supplier count
  // 1 supplier = 20, 2 = 40, 3 = 60, 4 = 80, 5+ = 100
  const diversityScore = Math.min(100, supplierCount * 20);

  // China suppliers
  const chinaSuppliers = uniqueSuppliers.filter(s =>
    CHINA_SUPPLIER_PATTERNS.some(p => p.test(s)),
  );
  const chinaSupplierCount = chinaSuppliers.length;
  const chinaSupplierConfidence = supplierCount > 0
    ? Math.round(chinaSupplierCount / supplierCount * 100)
    : 0;

  // Concentration risk
  let concentrationRisk: SupplierIntelligence["concentrationRisk"] = "LOW";
  if (supplierCount === 1) {
    concentrationRisk = totalShipments >= 50 ? "HIGH" : "MEDIUM";
  } else if (supplierCount === 2 && totalShipments >= 100) {
    concentrationRisk = "MEDIUM";
  }

  return {
    supplierCount,
    supplierNames: uniqueSuppliers.slice(0, 10),
    diversityScore,
    chinaSupplierCount,
    chinaSupplierConfidence,
    concentrationRisk,
  };
}
