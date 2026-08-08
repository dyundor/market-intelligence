import type { Provider } from "../types.ts";
import { importYetiWebCapability } from "../mock/capabilities.ts";
import type { QueryRequest } from "../../query/types.ts";
import { resolveProduct } from "../../products/resolver.ts";
import type { DbLike } from "../../db/types.ts";

export interface ImportYetiWebOptions {
  db: DbLike;
}

export class ImportYetiWebProvider implements Provider {
  readonly capability = importYetiWebCapability;
  private readonly db: DbLike;

  constructor(options: ImportYetiWebOptions) {
    this.db = options.db;
  }

  async fetch(query: QueryRequest): Promise<unknown> {
    const months = (query.months || []).filter(value => /^20\d{2}-\d{2}$/.test(value));
    const category = resolveProduct(query.subject);
    const hs = category?.defaultHsCode || "";
    const keyword = category?.keywords[0] || "";
    const hsLike = `%${hs}%`;
    const keywordLike = `%${keyword}%`;
    const monthPlaceholders = months.length ? months.map(() => "?").join(",") : "''";
    const sql = `WITH matching_rel AS (
        SELECT r.supplier_id,COUNT(DISTINCT r.importer_id) importer_count,SUM(r.shipment_count) relationship_shipments,GROUP_CONCAT(DISTINCT i.name) top_importers,GROUP_CONCAT(DISTINCT r.product_descriptions) products
        FROM importyeti_web_relationships r JOIN importyeti_web_entities i ON i.id=r.importer_id AND i.country='United States'
        WHERE r.hs_codes LIKE ? OR r.product_descriptions LIKE ? GROUP BY r.supplier_id
      ), month_shipments AS (
        SELECT supplier_id,COUNT(*) selected_month_shipments,SUM(weight_kg) selected_month_weight_kg,SUM(container_count) selected_month_containers,SUM(CAST(estimated_freight_usd AS REAL)) selected_month_freight_usd,COUNT(estimated_freight_usd) freight_covered_shipments
        FROM importyeti_web_shipments WHERE substr(shipment_date,1,7) IN (${monthPlaceholders}) GROUP BY supplier_id
      ) SELECT s.id,s.name,s.address,s.country,s.country_code,s.admin1_code,s.admin1_name,s.city_name,s.location_names,s.location_precision,s.website,s.website_status,s.website_source_url,s.website_verified_at,s.chinese_name,s.marketplace_urls,s.total_shipments,s.latest_shipment_date,s.avg_teu_per_shipment,s.avg_teu_per_month,s.estimated_shipping_spend_usd,s.shipping_spend_coverage_percent,s.source_url,
        r.importer_count,r.relationship_shipments,r.top_importers,r.products,COALESCE(m.selected_month_shipments,0) selected_month_shipments,COALESCE(m.selected_month_weight_kg,0) selected_month_weight_kg,COALESCE(m.selected_month_containers,0) selected_month_containers,COALESCE(m.selected_month_freight_usd,0) selected_month_freight_usd,COALESCE(m.freight_covered_shipments,0) freight_covered_shipments
      FROM matching_rel r JOIN importyeti_web_entities s ON s.id=r.supplier_id LEFT JOIN month_shipments m ON m.supplier_id=s.id
      ORDER BY selected_month_shipments DESC,relationship_shipments DESC,total_shipments DESC`;
    const importerSql = `WITH matching_rel AS (
        SELECT DISTINCT r.supplier_id,r.importer_id,r.shipment_count,r.product_descriptions,r.hs_codes
        FROM importyeti_web_relationships r WHERE r.hs_codes LIKE ? OR r.product_descriptions LIKE ?
      ), all_pairs AS (
        SELECT importer_id,supplier_id FROM importyeti_web_relationships
        UNION SELECT importer_id,supplier_id FROM importyeti_web_shipments WHERE importer_id IS NOT NULL
      ), all_counts AS (
        SELECT importer_id,COUNT(DISTINCT supplier_id) supplier_count FROM all_pairs GROUP BY importer_id
      ) SELECT i.id,i.name,i.address,i.country,i.country_code,i.admin1_code,i.admin1_name,i.city_name,i.location_names,i.location_precision,i.website,i.total_shipments,i.source_url,COALESCE(ac.supplier_count,0) supplier_count,(SELECT SUM(x.shipment_count) FROM matching_rel x WHERE x.importer_id=i.id) relationship_shipments,GROUP_CONCAT(DISTINCT s.name) suppliers,GROUP_CONCAT(DISTINCT r.product_descriptions) products,
        COUNT(DISTINCT sh.id) selected_month_shipments,COALESCE(SUM(sh.weight_kg),0) selected_month_weight_kg,COALESCE(SUM(sh.container_count),0) selected_month_containers,COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)),0) selected_month_freight_usd,COUNT(sh.estimated_freight_usd) freight_covered_shipments
      FROM matching_rel r JOIN importyeti_web_entities i ON i.id=r.importer_id AND i.country='United States' JOIN importyeti_web_entities s ON s.id=r.supplier_id LEFT JOIN all_counts ac ON ac.importer_id=i.id
      LEFT JOIN importyeti_web_shipments sh ON sh.supplier_id=r.supplier_id AND sh.importer_id=i.id AND substr(sh.shipment_date,1,7) IN (${monthPlaceholders})
      GROUP BY i.id ORDER BY selected_month_shipments DESC,relationship_shipments DESC,i.total_shipments DESC`;
    const coverageSql = `SELECT month,SUM(observed_shipments) shipments,
        CASE
          WHEN SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)>0 THEN 'failed'
          WHEN SUM(CASE WHEN status='partial' THEN 1 ELSE 0 END)>0 THEN 'partial'
          WHEN SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END)>0 THEN 'in_progress'
          WHEN SUM(CASE WHEN status='complete' THEN 1 ELSE 0 END)>0
            AND SUM(CASE WHEN status NOT IN ('complete','no_records') THEN 1 ELSE 0 END)=0 THEN 'complete'
          WHEN SUM(CASE WHEN status='no_records' THEN 1 ELSE 0 END)=COUNT(*) THEN 'no_records'
          ELSE 'uncollected'
        END status,
        SUM(pages_completed) pages_completed,COUNT(DISTINCT entity_id) entities_observed,
        MIN(first_observed_at) first_observed_at,MAX(updated_at) updated_at
      FROM shipment_collection_coverage WHERE product_key=?
      GROUP BY month ORDER BY month DESC LIMIT 36`;
    const [result, importers, coverage] = await Promise.all([
      this.db.prepare(sql).bind(hsLike, keywordLike, ...months).all(),
      this.db.prepare(importerSql).bind(hsLike, keywordLike, ...months).all(),
      this.db.prepare(coverageSql).bind(query.subject).all(),
    ]);
    const latestAvailableMonth = String((coverage.results[0] as { month?: string } | undefined)?.month || "");
    return {
      available: true,
      dataset: "importyeti_free_web",
      market: query.market,
      flow: query.flow || "import",
      product: query.subject,
      hsCode: hs.replace(".", ""),
      requestedMonths: months,
      latestAvailableMonth,
      importers: importers.results,
      suppliers: result.results,
      storedShipmentCoverage: coverage.results,
    };
  }
}
