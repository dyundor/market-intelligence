"use client";

import { useMemo, useState } from "react";
import { SALES_PRODUCTS } from "../../lib/products/hot-products.ts";
import type { TrendPoint } from "../../lib/products/trend-metrics.ts";
import { TrendChart } from "./TrendChart.tsx";
import { useTrendData, type DayRange } from "./useTrendData.ts";

const DAY_RANGE_OPTIONS: DayRange[] = [30, 90, 180];

type MetricKey = "shipments" | "buyers" | "weightKg" | "growthRate";
const ALL_METRICS: MetricKey[] = ["shipments", "buyers", "weightKg", "growthRate"];

function metricTitle(metric: MetricKey, zh: boolean): string {
  switch (metric) {
    case "shipments": return zh ? "月度出货量" : "Monthly Shipments";
    case "buyers": return zh ? "月度买家数" : "Monthly Buyers";
    case "weightKg": return zh ? "月度重量" : "Monthly Weight";
    case "growthRate": return zh ? "环比增长率" : "MoM Growth Rate";
  }
}

export function TrendView({
  locale = "en",
  metrics = ALL_METRICS,
  showSummary = true,
  showLegend = true,
  initialCategoryId,
  initialDayRange,
}: {
  locale?: string;
  metrics?: MetricKey[];
  showSummary?: boolean;
  showLegend?: boolean;
  initialCategoryId?: string;
  initialDayRange?: DayRange;
}) {
  const zh = locale === "zh-CN";

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId ?? SALES_PRODUCTS[0].id,
  );
  const [dayRange, setDayRange] = useState<DayRange>(initialDayRange ?? 180);

  const { state, retry } = useTrendData(selectedCategoryId, dayRange);

  const selectedCategory = SALES_PRODUCTS.find((p) => p.id === selectedCategoryId);

  const summaryMetrics = useMemo(() => {
    if (state.status !== "success") return null;
    const s = state.data.summary;
    return [
      { label: zh ? "总出货量" : "Total Shipments", value: s.totalShipments.toLocaleString() },
      { label: zh ? "总买家数" : "Total Buyers", value: s.totalBuyers.toLocaleString() },
      { label: zh ? "总重量" : "Total Weight", value: `${(s.totalWeightKg / 1000).toFixed(1)}t` },
      { label: zh ? "月均增长" : "Avg MoM Growth", value: `${s.avgMonthlyGrowth > 0 ? "+" : ""}${s.avgMonthlyGrowth.toFixed(1)}%` },
    ];
  }, [state, zh]);

  const chartData: TrendPoint[] = state.status === "success" ? state.data.points : [];

  return (
    <div className="trend-view">
      <div className="trend-view-controls">
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

      {state.status === "loading" && (
        <div className="trend-view-loading">
          <span className="query-spinner" />
          <p>{zh ? "加载趋势数据..." : "Loading trend data..."}</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="trend-view-error">
          <span>{zh ? "加载失败" : "Load failed"}</span>
          <p>{state.message}</p>
          <button onClick={retry}>{zh ? "重试" : "Retry"}</button>
        </div>
      )}

      {state.status === "empty" && (
        <div className="trend-view-empty">
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

      {state.status === "idle" && (
        <div className="trend-view-loading">
          <p>{zh ? "选择类别以加载趋势..." : "Select a category to load trends..."}</p>
        </div>
      )}

      {state.status === "success" && (
        <>
          {showSummary && summaryMetrics && (
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
            {metrics.map((metric) => (
              <div key={metric} className="trend-chart-card">
                <h3>{metricTitle(metric, zh)}</h3>
                <TrendChart data={chartData} metric={metric} height={160} locale={locale} />
              </div>
            ))}
          </div>

          {showLegend && (
            <div className="trend-data-legend">
              <span>
                {zh ? "周期" : "Period"}: {state.data.summary.periodStart} ~{" "}
                {state.data.summary.periodEnd}
              </span>
              <span>
                {zh ? "最佳月份" : "Best Month"}: {state.data.summary.bestMonth}
              </span>
              <span>
                {zh ? "最低月份" : "Worst Month"}: {state.data.summary.worstMonth}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
