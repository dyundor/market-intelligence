"use client";

import { useEffect, useMemo, useState } from "react";
import { SALES_PRODUCTS } from "../../lib/products/hot-products.ts";
import type { TrendMetric } from "../../lib/products/trend-metrics.ts";
import { TrendChart } from "./TrendChart.tsx";

const DAYS_TO_MONTHS: Record<number, number> = {
  30: 1,
  90: 3,
  180: 6,
};

const DAY_RANGE_OPTIONS = [30, 90, 180] as const;
type DayRange = (typeof DAY_RANGE_OPTIONS)[number];

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: TrendMetric };

export function ProductTrendDashboard({ locale = "en" }: { locale?: string }) {
  const zh = locale === "zh-CN";

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(SALES_PRODUCTS[0].id);
  const [dayRange, setDayRange] = useState<DayRange>(180);
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    const months = DAYS_TO_MONTHS[dayRange];

    setFetchState({ status: "loading" });

    fetch(
      `/api/hot-products/trend?product_id=${encodeURIComponent(selectedCategoryId)}&months=${months}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) {
            setFetchState({ status: "success", data: null as unknown as TrendMetric });
          } else {
            throw new Error(`HTTP ${r.status}`);
          }
          return;
        }
        const data: TrendMetric = await r.json();
        setFetchState({ status: "success", data });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setFetchState({ status: "error", message: err.message || String(err) });
      });

    return () => controller.abort();
  }, [selectedCategoryId, dayRange]);

  const selectedCategory = SALES_PRODUCTS.find((p) => p.id === selectedCategoryId);

  const summaryMetrics = useMemo(() => {
    if (fetchState.status !== "success" || !fetchState.data?.summary) return null;
    const s = fetchState.data.summary;
    return [
      {
        label: zh ? "总出货量" : "Total Shipments",
        value: s.totalShipments.toLocaleString(),
        metric: "shipments" as const,
      },
      {
        label: zh ? "总买家数" : "Total Buyers",
        value: s.totalBuyers.toLocaleString(),
        metric: "buyers" as const,
      },
      {
        label: zh ? "总重量" : "Total Weight",
        value: `${(s.totalWeightKg / 1000).toFixed(1)}t`,
        metric: "weightKg" as const,
      },
      {
        label: zh ? "月均增长" : "Avg MoM Growth",
        value: `${s.avgMonthlyGrowth > 0 ? "+" : ""}${s.avgMonthlyGrowth.toFixed(1)}%`,
        metric: "growthRate" as const,
      },
    ];
  }, [fetchState, zh]);

  const chartData = fetchState.status === "success" && fetchState.data ? fetchState.data.points : [];

  return (
    <div className="trend-dashboard">
      <div className="trend-dashboard-controls">
        <div className="trend-category-select">
          <label>{zh ? "产品类别" : "Category"}</label>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            {SALES_PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {zh ? p.name : p.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="trend-time-select">
          <label>{zh ? "时间范围" : "Time Range"}</label>
          <div className="trend-time-buttons">
            {DAY_RANGE_OPTIONS.map((days) => (
              <button
                key={days}
                className={dayRange === days ? "on" : ""}
                onClick={() => setDayRange(days)}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {fetchState.status === "loading" && (
        <div className="trend-dashboard-loading">
          <span className="query-spinner" />
          <p>{zh ? "加载趋势数据..." : "Loading trend data..."}</p>
        </div>
      )}

      {fetchState.status === "error" && (
        <div className="trend-dashboard-error">
          <span>{zh ? "加载失败" : "Load failed"}</span>
          <p>{fetchState.message}</p>
          <button onClick={() => setFetchState({ status: "idle" })}>
            {zh ? "重试" : "Retry"}
          </button>
        </div>
      )}

      {fetchState.status === "success" && (!fetchState.data || chartData.length === 0) && (
        <div className="trend-dashboard-empty">
          <div className="trend-empty-icon">
            <span>{zh ? "暂无趋势数据" : "No trend data"}</span>
          </div>
          <p>
            {zh
              ? `"${selectedCategory?.name ?? selectedCategoryId}" 在当前时间范围内没有找到出货记录。`
              : `No shipment records found for "${selectedCategory?.nameEn ?? selectedCategoryId}" in the selected time range.`}
          </p>
        </div>
      )}

      {fetchState.status === "success" && fetchState.data && chartData.length > 0 && (
        <>
          {summaryMetrics && (
            <div className="trend-summary-grid">
              {summaryMetrics.map((sm) => (
                <article key={sm.label} className="trend-summary-card">
                  <small>{sm.label}</small>
                  <strong>{sm.value}</strong>
                </article>
              ))}
            </div>
          )}

          <div className="trend-charts-grid">
            <div className="trend-chart-card">
              <h3>{zh ? "月度出货量" : "Monthly Shipments"}</h3>
              <TrendChart data={chartData} metric="shipments" height={160} locale={locale} />
            </div>
            <div className="trend-chart-card">
              <h3>{zh ? "月度买家数" : "Monthly Buyers"}</h3>
              <TrendChart data={chartData} metric="buyers" height={160} locale={locale} />
            </div>
            <div className="trend-chart-card">
              <h3>{zh ? "月度重量" : "Monthly Weight"}</h3>
              <TrendChart data={chartData} metric="weightKg" height={160} locale={locale} />
            </div>
            <div className="trend-chart-card">
              <h3>{zh ? "环比增长率" : "MoM Growth Rate"}</h3>
              <TrendChart data={chartData} metric="growthRate" height={160} locale={locale} />
            </div>
          </div>

          <div className="trend-data-legend">
            <span>
              {zh ? "周期" : "Period"}: {fetchState.data.summary.periodStart} ~{" "}
              {fetchState.data.summary.periodEnd}
            </span>
            <span>
              {zh ? "最佳月份" : "Best Month"}: {fetchState.data.summary.bestMonth}
            </span>
            <span>
              {zh ? "最低月份" : "Worst Month"}: {fetchState.data.summary.worstMonth}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

