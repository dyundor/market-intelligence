"use client";

import { useMemo, useRef, useState } from "react";
import type { TrendPoint } from "../../lib/products/trend-metrics.ts";

type MetricKey = "shipments" | "buyers" | "weightKg" | "growthRate";

const CHART_PADDING = { top: 20, right: 24, bottom: 32, left: 48 };
const CHART_HEIGHT = 180;

function formatValue(value: number, metric: MetricKey, locale: string): string {
  if (metric === "weightKg") {
    return `${Math.round(value).toLocaleString()} kg`;
  }
  if (metric === "growthRate") {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
}

function formatYLabel(value: number, metric: MetricKey): string {
  if (metric === "weightKg") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${value}`;
  }
  if (metric === "growthRate") return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
  return `${value}`;
}

function metricLabel(metric: MetricKey, locale: string): string {
  const zh = locale === "zh-CN";
  switch (metric) {
    case "shipments": return zh ? "出货量" : "Shipments";
    case "buyers": return zh ? "买家数" : "Buyers";
    case "weightKg": return zh ? "重量" : "Weight";
    case "growthRate": return zh ? "环比增长" : "MoM Growth";
  }
}

function metricColor(metric: MetricKey): string {
  switch (metric) {
    case "shipments": return "#4e9b85";
    case "buyers": return "#5aa376";
    case "weightKg": return "#3b82a3";
    case "growthRate": return "#d46d2e";
  }
}

interface TooltipInfo {
  x: number;
  y: number;
  month: string;
  value: number;
}

export function TrendChart({
  data,
  metric,
  height = CHART_HEIGHT,
  locale = "en",
}: {
  data: TrendPoint[];
  metric: MetricKey;
  height?: number;
  locale?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const { pathD, points, yTicks, maxVal } = useMemo(() => {
    if (data.length === 0) return { pathD: "", points: [], yTicks: [] as number[], maxVal: 0 };

    const values = data.map((p) => p[metric]);
    const isGrowth = metric === "growthRate";
    const allZero = values.every((v) => v === 0);
    const maxAbs = Math.max(...values.map(Math.abs), 1);

    let min: number;
    let max: number;

    if (isGrowth) {
      max = Math.max(maxAbs, 10);
      min = -max;
    } else {
      min = 0;
      max = allZero ? 1 : Math.max(...values);
    }

    const paddedMax = max * 1.12;
    const paddedMin = isGrowth ? min * 1.12 : 0;

    const chartW = 600;
    const chartH = height;
    const w = chartW - CHART_PADDING.left - CHART_PADDING.right;
    const h = chartH - CHART_PADDING.top - CHART_PADDING.bottom;
    const range = paddedMax - paddedMin || 1;

    const xStep = data.length > 1 ? w / (data.length - 1) : w / 2;
    const x0 = CHART_PADDING.left + (data.length === 1 ? w / 2 : 0);

    const scaleX = (i: number) => x0 + i * (data.length > 1 ? xStep : 0);
    const scaleY = (v: number) => CHART_PADDING.top + h - ((v - paddedMin) / range) * h;

    const pts = data.map((p, i) => ({
      x: scaleX(i),
      y: scaleY(p[metric]),
      month: p.month,
      value: p[metric],
    }));

    const path = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

    const tickCount = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const val = paddedMin + (range / tickCount) * i;
      ticks.push(Math.round(val * 100) / 100);
    }

    return { pathD: path, points: pts, yTicks: ticks, maxVal: paddedMax };
  }, [data, metric, height]);

  if (data.length === 0) {
    return (
      <div className="trend-chart-empty">
        <span>{locale === "zh-CN" ? "暂无数据" : "No data"}</span>
      </div>
    );
  }

  const chartW = 600;
  const chartH = height;
  const w = chartW - CHART_PADDING.left - CHART_PADDING.right;
  const h = chartH - CHART_PADDING.top - CHART_PADDING.bottom;
  const color = metricColor(metric);

  return (
    <div className="trend-chart-wrapper">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="trend-chart-svg"
        role="img"
        aria-label={`${metricLabel(metric, locale)} chart`}
      >
        <defs>
          <linearGradient id={`trend-area-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = CHART_PADDING.top + h - ((tick - (yTicks[0] ?? 0)) / (maxVal - (yTicks[0] ?? 0) || 1)) * h;
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                y1={y}
                x2={chartW - CHART_PADDING.right}
                y2={y}
                stroke="#e5e9e5"
                strokeWidth="0.7"
              />
              <text
                x={CHART_PADDING.left - 6}
                y={y + 3}
                textAnchor="end"
                className="trend-chart-axis-label"
              >
                {formatYLabel(tick, metric)}
              </text>
            </g>
          );
        })}

        {points.map((_pt, i) => {
          if (data.length <= 8 || i % Math.ceil(data.length / 8) === 0) {
            const x = i === 0
              ? CHART_PADDING.left
              : i === data.length - 1
                ? chartW - CHART_PADDING.right
                : CHART_PADDING.left + (i / (data.length - 1)) * w;
            return (
              <text
                key={data[i].month}
                x={x}
                y={chartH - 4}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                className="trend-chart-axis-label"
              >
                {data[i].month.slice(5)}
              </text>
            );
          }
          return null;
        })}

        {pathD && (
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${CHART_PADDING.top + h} L ${points[0].x} ${CHART_PADDING.top + h} Z`}
            fill={`url(#trend-area-${metric})`}
          />
        )}

        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((pt, i) => (
          <g key={pt.month}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill="white"
              stroke={color}
              strokeWidth="2"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setTooltip({ x: pt.x, y: pt.y, month: pt.month, value: pt.value })}
              onMouseLeave={() => setTooltip(null)}
            />
            {tooltip?.month === pt.month && (
              <g>
                <rect
                  x={pt.x - 40}
                  y={pt.y - 36}
                  width="80"
                  height="22"
                  rx="4"
                  fill="#172f2b"
                />
                <text
                  x={pt.x}
                  y={pt.y - 20}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                >
                  {pt.month}: {formatValue(pt.value, metric, locale)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

