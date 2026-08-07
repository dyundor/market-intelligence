import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const paidApiCache = sqliteTable(
  "paid_api_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    provider: text("provider").notNull(),
    state: text("state").notNull().default("ready"),
    payload: text("payload"),
    fetchedAt: integer("fetched_at"),
    expiresAt: integer("expires_at").notNull().default(0),
    staleUntil: integer("stale_until").notNull().default(0),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [
    index("paid_api_cache_provider_expiry_idx").on(
      table.provider,
      table.expiresAt,
    ),
  ],
);

export const importYetiWebEntities = sqliteTable(
  "importyeti_web_entities",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    country: text("country"),
    countryCode: text("country_code"),
    admin1Code: text("admin1_code"),
    admin1Name: text("admin1_name"),
    cityName: text("city_name"),
    locationNames: text("location_names"),
    locationPrecision: text("location_precision").notNull().default("country"),
    locationSource: text("location_source"),
    website: text("website"),
    websiteStatus: text("website_status").notNull().default("unknown"),
    websiteSourceUrl: text("website_source_url"),
    websiteVerifiedAt: text("website_verified_at"),
    chineseName: text("chinese_name"),
    marketplaceUrls: text("marketplace_urls"),
    totalShipments: integer("total_shipments"),
    latestShipmentDate: text("latest_shipment_date"),
    avgTeuPerShipment: text("avg_teu_per_shipment"),
    avgTeuPerMonth: text("avg_teu_per_month"),
    estimatedShippingSpendUsd: integer("estimated_shipping_spend_usd"),
    shippingSpendCoveragePercent: integer("shipping_spend_coverage_percent"),
    contactDataStatus: text("contact_data_status")
      .notNull()
      .default("not_available"),
    sourceUrl: text("source_url").notNull(),
    sourceChannel: text("source_channel")
      .notNull()
      .default("importyeti_free_web"),
    sourceEntityKey: text("source_entity_key"),
    identityStatus: text("identity_status")
      .notNull()
      .default("source_verified"),
    firstSeenAt: text("first_seen_at"),
    updatedAt: text("updated_at"),
    recordVersion: integer("record_version").notNull().default(1),
    sourceAttribution: text("source_attribution")
      .notNull()
      .default("ImportYeti / U.S. Customs and Border Protection"),
    searchQuery: text("search_query"),
    capturedAt: text("captured_at").notNull(),
    rawEvidence: text("raw_evidence"),
  },
  (table) => [
    index("importyeti_web_entities_type_name_idx").on(
      table.entityType,
      table.name,
    ),
    index("importyeti_web_entities_query_idx").on(table.searchQuery),
    uniqueIndex("importyeti_web_entities_source_key_uq").on(
      table.sourceEntityKey,
    ),
  ],
);

export const companyIdentityAliases = sqliteTable(
  "company_identity_aliases",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    aliasType: text("alias_type").notNull(),
    aliasValue: text("alias_value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    sourceChannel: text("source_channel").notNull(),
    sourceUrl: text("source_url"),
    confidence: integer("confidence").notNull().default(100),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("company_identity_aliases_company_value_uq").on(
      table.companyId,
      table.aliasType,
      table.normalizedValue,
    ),
    index("company_identity_aliases_lookup_idx").on(
      table.aliasType,
      table.normalizedValue,
    ),
  ],
);

export const companyChangeLog = sqliteTable(
  "company_change_log",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    changeType: text("change_type").notNull().default("profile_update"),
    oldSnapshot: text("old_snapshot"),
    newSnapshot: text("new_snapshot"),
    sourceChannel: text("source_channel").notNull(),
    sourceUrl: text("source_url"),
    changedAt: text("changed_at").notNull(),
  },
  (table) => [
    index("company_change_log_company_date_idx").on(
      table.companyId,
      table.changedAt,
    ),
  ],
);

export const shipmentCollectionCoverage = sqliteTable(
  "shipment_collection_coverage",
  {
    id: text("id").primaryKey(),
    sourceChannel: text("source_channel").notNull(),
    entityId: text("entity_id").notNull(),
    entityRole: text("entity_role").notNull(),
    productKey: text("product_key").notNull(),
    hsCode: text("hs_code"),
    month: text("month").notNull(),
    status: text("status").notNull().default("uncollected"),
    observedShipments: integer("observed_shipments").notNull().default(0),
    pagesCompleted: integer("pages_completed").notNull().default(0),
    lastCursor: text("last_cursor"),
    classificationBasis: text("classification_basis"),
    sourceUrl: text("source_url"),
    firstObservedAt: text("first_observed_at"),
    lastAttemptAt: text("last_attempt_at"),
    completedAt: text("completed_at"),
    lastError: text("last_error"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("shipment_collection_coverage_scope_uq").on(
      table.sourceChannel,
      table.entityId,
      table.productKey,
      table.month,
    ),
    index("shipment_collection_coverage_product_month_idx").on(
      table.productKey,
      table.month,
      table.status,
    ),
  ],
);

export const shipmentCollectionJobs = sqliteTable(
  "shipment_collection_jobs",
  {
    id: text("id").primaryKey(),
    sourceChannel: text("source_channel").notNull(),
    entityId: text("entity_id").notNull(),
    entityRole: text("entity_role").notNull(),
    productKey: text("product_key").notNull(),
    hsCode: text("hs_code"),
    dateFrom: text("date_from").notNull(),
    dateTo: text("date_to").notNull(),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(100),
    cursor: text("cursor"),
    pagesCompleted: integer("pages_completed").notNull().default(0),
    shipmentsCollected: integer("shipments_collected").notNull().default(0),
    targetShipments: integer("target_shipments"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("shipment_collection_jobs_scope_uq").on(
      table.sourceChannel,
      table.entityId,
      table.productKey,
      table.dateFrom,
      table.dateTo,
    ),
    index("shipment_collection_jobs_queue_idx").on(
      table.status,
      table.priority,
      table.updatedAt,
    ),
  ],
);

export const importYetiWebRelationships = sqliteTable(
  "importyeti_web_relationships",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").notNull(),
    importerId: text("importer_id").notNull(),
    shipmentCount: integer("shipment_count"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    hsCodes: text("hs_codes"),
    productDescriptions: text("product_descriptions"),
    sourceUrl: text("source_url").notNull(),
    sourceChannel: text("source_channel")
      .notNull()
      .default("importyeti_free_web"),
    discoveryDirection: text("discovery_direction")
      .notNull()
      .default("supplier_profile"),
    evidenceStatus: text("evidence_status").notNull().default("verified"),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [
    index("importyeti_web_relationships_supplier_idx").on(table.supplierId),
    index("importyeti_web_relationships_importer_idx").on(table.importerId),
  ],
);

export const importYetiWebShipments = sqliteTable(
  "importyeti_web_shipments",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").notNull(),
    importerId: text("importer_id"),
    importerName: text("importer_name").notNull(),
    shipmentDate: text("shipment_date").notNull(),
    dateBasis: text("date_basis")
      .notNull()
      .default("source_displayed_date_unspecified"),
    exportDeclarationDate: text("export_declaration_date"),
    vesselDepartureDate: text("vessel_departure_date"),
    estimatedArrivalDate: text("estimated_arrival_date"),
    actualArrivalDate: text("actual_arrival_date"),
    importDeclarationDate: text("import_declaration_date"),
    customsReleaseDate: text("customs_release_date"),
    houseBol: text("house_bol"),
    masterBol: text("master_bol"),
    weightKg: integer("weight_kg"),
    quantity: integer("quantity"),
    quantityUnit: text("quantity_unit"),
    containerCount: integer("container_count"),
    productDescription: text("product_description"),
    estimatedFreightUsd: text("estimated_freight_usd"),
    sourceUrl: text("source_url").notNull(),
    sourceChannel: text("source_channel")
      .notNull()
      .default("importyeti_free_web"),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [
    index("importyeti_web_shipments_month_idx").on(table.shipmentDate),
    index("importyeti_web_shipments_supplier_idx").on(table.supplierId),
    index("importyeti_web_shipments_importer_idx").on(table.importerId),
    uniqueIndex("importyeti_web_shipments_source_house_bol_uq")
      .on(table.sourceChannel, table.houseBol)
      .where(sql`${table.houseBol} is not null and ${table.houseBol} <> ''`),
  ],
);

export const buyerSupplierRelationships = sqliteTable(
  "buyer_supplier_relationships",
  {
    id: text("id").primaryKey(),
    buyerId: text("buyer_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    productCategory: text("product_category").notNull().default("unknown"),
    shipmentCount: integer("shipment_count").notNull().default(0),
    firstSeen: text("first_seen"),
    lastSeen: text("last_seen"),
    source: text("source").notNull().default("importyeti_free_web"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("buyer_supplier_relationships_buyer_idx").on(
      table.buyerId,
      table.productCategory,
    ),
    index("buyer_supplier_relationships_supplier_idx").on(table.supplierId),
  ],
);

export const buyerMonthlyRankings = sqliteTable(
  "buyer_monthly_rankings",
  {
    id: text("id").primaryKey(),
    market: text("market").notNull(),
    productCategory: text("product_category").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    buyerId: text("buyer_id").notNull(),
    rank: integer("rank").notNull(),
    metric: text("metric").notNull(),
    metricValue: real("metric_value").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("buyer_monthly_rankings_scope_buyer_uq").on(
      table.market,
      table.productCategory,
      table.year,
      table.month,
      table.metric,
      table.buyerId,
    ),
    index("buyer_monthly_rankings_query_idx").on(
      table.market,
      table.productCategory,
      table.year,
      table.month,
      table.metric,
      table.rank,
    ),
  ],
);

export const apiUsageRequests = sqliteTable(
  "api_usage_requests",
  {
    id: text("id").primaryKey(),

    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    queryHash: text("query_hash").notNull(),
    queryDescription: text("query_description").notNull(),

    estimatedCost: text("estimated_cost").notNull(),
    approvedCost: text("approved_cost"),
    actualCost: text("actual_cost"),

    totalBudget: text("total_budget").notNull().default("100"),
    reserveBudget: text("reserve_budget").notNull().default("25"),
    remainingBudgetBefore: text("remaining_budget_before"),
    remainingBudgetAfter: text("remaining_budget_after"),

    percentOfTotalBudget: text("percent_of_total_budget"),
    percentOfRemainingBudget: text("percent_of_remaining_budget"),

    status: text("status").notNull().default("awaiting_approval"),

    failureReason: text("failure_reason"),
    approvedAt: text("approved_at"),
    executedAt: text("executed_at"),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("api_usage_requests_provider_status_idx").on(
      table.provider,
      table.status,
    ),
    index("api_usage_requests_query_hash_idx").on(table.queryHash),
    uniqueIndex("api_usage_requests_active_query_uq")
      .on(table.provider, table.queryHash)
      .where(sql`${table.status} IN ('awaiting_approval', 'approved', 'executing', 'reapproval_required')`),
  ],
);

export const apiUsageLog = sqliteTable(
  "api_usage_log",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    provider: text("provider").notNull(),
    queryHash: text("query_hash").notNull(),
    eventType: text("event_type").notNull(),
    estimatedCost: text("estimated_cost"),
    approvedCost: text("approved_cost"),
    actualCost: text("actual_cost"),
    remainingBudgetBefore: text("remaining_budget_before"),
    remainingBudgetAfter: text("remaining_budget_after"),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("api_usage_log_request_date_idx").on(table.requestId, table.createdAt),
    index("api_usage_log_provider_date_idx").on(table.provider, table.createdAt),
    index("api_usage_log_query_hash_idx").on(table.queryHash),
  ],
);
