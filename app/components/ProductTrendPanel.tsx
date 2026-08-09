"use client";

import { useEffect, useState } from "react";
import type { TrendMetric } from "../../lib/products/trend-metrics.ts";

type TrendMetricPayload = TrendMetric;

export function ProductTrendPanel({
  productId,
  productName,
  locale,
  onClose,
}: {
  productId: string;
  productName: string;
  locale: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<TrendMetricPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/hot-products/trend?product_id=${encodeURIComponent(productId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [productId]);

  if (loading) {
    return (
      <div className="trend-panel">
        <div className="trend-header">
          <strong>{productName}</strong>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="trend-loading">
          <span className="query-spinner" />
        </div>
      </div>
    );
  }

  if (!data || !data.points.length) {
    return (
      <div className="trend-panel">
        <div className="trend-header">
          <strong>{productName}</strong>
          <button onClick={onClose}>&times;</button>
        </div>
        <p className="trend-empty">
          {locale === "zh-CN"
            ? "暂无趋势数据"
            : "No trend data available"}
        </p>
      </div>
    );
  }

  const maxShipments = Math.max(...data.points.map((p) => p.shipments), 1);
  const maxBuyers = Math.max(...data.points.map((p) => p.buyers), 1);

  const zh = locale === "zh-CN";

  return (
    <div className="trend-panel">
      <div className="trend-header">
        <strong>
          {zh ? `趋势分析：${productName}` : `Trend: ${productName}`}
        </strong>
        <button onClick={onClose}>&times;</button>
      </div>

      <section className="trend-section">
        <h3>{zh ? "月度出货量" : "Monthly Shipments"}</h3>
        <div className="trend-chart">
          {data.points.map((point) => (
            <div key={point.month} className="trend-row">
              <span className="trend-label">{point.month}</span>
              <div className="trend-bar">
                <span
                  className="trend-shipment-bar"
                  style={{
                    width: `${Math.round((point.shipments / maxShipments) * 100)}%`,
                  }}
                >
                  <small>{point.shipments}</small>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="trend-section">
        <h3>{zh ? "买家数量" : "Buyer Count"}</h3>
        <div className="trend-chart">
          {data.points.map((point) => (
            <div key={point.month} className="trend-row">
              <span className="trend-label">{point.month}</span>
              <div className="trend-bar">
                <span
                  className="trend-buyer-bar"
                  style={{
                    width: `${Math.round((point.buyers / maxBuyers) * 100)}%`,
                  }}
                >
                  <small>{point.buyers}</small>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="trend-confidence">
        <h3>{zh ? "数据置信度" : "Data Confidence"}</h3>
        <div className="trend-confidence-body">
          <span className="trend-confidence-score">
            {data.points[0].confidence.score}/100
          </span>
          {data.summary.totalShipments < 30 && (
            <p className="trend-confidence-warning">
              {zh
                ? "样本量有限，趋势置信度较低"
                : "Limited trend confidence — small sample"}
            </p>
          )}
          <div className="trend-meta">
            <span>
              {zh ? "样本量" : "Sample size"}: {data.summary.totalShipments}
            </span>
            <span>
              {zh ? "周期" : "Period"}: {data.summary.periodStart} ~{" "}
              {data.summary.periodEnd}
            </span>
            <span>
              {zh ? "月均增长" : "Avg monthly growth"}:{" "}
              {data.summary.avgMonthlyGrowth > 0 ? "+" : ""}
              {data.summary.avgMonthlyGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
