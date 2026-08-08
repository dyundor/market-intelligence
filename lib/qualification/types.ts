export interface Factor {
  id: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

/** Product match level — how well this buyer matches the target product category */
export type ProductMatch = "HIGH" | "MEDIUM" | "LOW";

/** Buyer type classification — what kind of buyer this is */
export type BuyerType = "Bathroom Specialist" | "Mixed Bathroom/Kitchen" | "General Plumbing" | "Unknown";

/** Supplier intelligence — relationship strength and risk signals */
export interface SupplierIntelligence {
  supplierCount: number;
  supplierNames: string[];
  diversityScore: number;
  chinaSupplierCount: number;
  chinaSupplierConfidence: number;
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
}

export interface QualificationResult {
  priority: "A" | "B" | "C";
  qualificationScore: number;
  productMatchConfidence: number;
  productMatch: ProductMatch;
  buyerType: BuyerType;
  classificationReason: string;
  supplierIntelligence: SupplierIntelligence;
  positiveFactors: string[];
  riskFactors: string[];
  factors: Factor[];
}

export interface QualificationContext {
  productCategory: string;
  productKeywords: string[];
  excludeKeywords: string[];
}

export interface PriorityWeights {
  shipmentVolume: number;
  shipmentRecency: number;
  supplierDiversity: number;
  supplierChina: number;
  containerVolume: number;
  freightValue: number;
  productRelevance: number;
  identityConfidence: number;
  dataCoverage: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = {
  shipmentVolume: 18,
  shipmentRecency: 18,
  supplierDiversity: 12,
  supplierChina: 10,
  containerVolume: 12,
  freightValue: 10,
  productRelevance: 10,
  identityConfidence: 5,
  dataCoverage: 5,
};

export const PRIORITY_THRESHOLDS = { a: 55, b: 25 };

export const POSITIVE_REASONS: Record<string, string> = {
  frequent_importer: "High shipment volume — established trading relationship",
  recent_imports: "Recent imports within 180 days — active buyer",
  multiple_suppliers: "Multiple suppliers — diversified sourcing",
  china_supplier: "Chinese supplier relationship — key Yundor market signal",
  diversified_sourcing: "Suppliers across multiple countries — low dependency risk",
  containerized_freight: "Containerized cargo — significant order scale",
  high_order_value: "High freight value — substantial purchase orders",
  product_focus: "Strong product relevance to target category",
  high_identity: "High entity identity confidence — verified company profile",
};

export const RISK_REASONS: Record<string, string> = {
  few_shipments: "Few shipments on record — limited trading history",
  no_recent_activity: "No recent import activity — possibly inactive",
  single_supplier: "Single supplier dependency — no alternative sourcing",
  no_china_supplier: "No known Chinese supplier — may not be relevant to Yundor",
  supplier_concentration: "Supplier concentration risk — all shipments from one supplier",
  no_containers: "No containerized shipments in selected period",
  missing_website: "No verified company website",
  low_identity: "Low entity identity confidence — possible duplicate",
  no_shipment_data: "No shipment records — import activity unconfirmed",
  product_mismatch: "Product descriptions contain excluded keywords — possible miscategorization",
  missing_suppliers: "Suspiciously few suppliers for shipment volume — relationship data may be incomplete",
};
