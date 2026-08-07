export interface BuyerSupplierRelationship {
  buyerId: string;
  supplierId: string;
  productCategory: string;
  shipmentCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  source: string;
}

export interface RelationshipMetrics {
  shipmentCount: number;
  spanMonths: number;
}
