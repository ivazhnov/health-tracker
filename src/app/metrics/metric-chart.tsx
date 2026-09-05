"use client";

import { useState } from "react";
import type { MetricPoint } from "@/server/metric-history";
import {
  buildChartGeometry,
  isOutsideReference,
} from "@/app/metrics/chart-geometry";

export function MetricChart({
  points,
}: {
  points: MetricPoint[];
}) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, points.length - 1));
  if (points.some((point) => point.valueNumeric === null)) {
    return <p className="muted-copy">Есть текстовые результаты — сравните их в истории. Числовой график не строится.</p>;
  }
  const units = new Set(points.map((point) => point.unit));
  if (units.size > 1) {
    return <p className="muted-copy">Разные единицы измерения — сравните значения в истории.</p>;
  }
  if (points.length < 2) {
    return <div className="chart-empty"><strong>Недостаточно данных для графика</strong><span>Нужно как минимум два сопоставимых измерения.</span></div>;
  }
  const width = 920;
  const height = 220;
  const padding = 28;
  const geometry = buildChartGeometry(points, width, height, padding);
  const line = geometry.points.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <figure className="chart-figure">
    <svg
      aria-label={`Динамика: ${points.length} измерений`}
      className="metric-chart"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      onPointerLeave={() => setActiveIndex(points.length - 1)}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * width;
        const nearest = geometry.points.reduce((best, point, index) =>
          Math.abs(point.x - x) < Math.abs(geometry.points[best].x - x) ? index : best, 0);
        setActiveIndex(nearest);
      }}
    >
        <>
          <line
            className="chart-grid"
            x1={padding}
            x2={width - padding}
            y1={padding}
            y2={padding}
          />
          <line
            className="chart-grid"
            x1={padding}
            x2={width - padding}
            y1={height - padding}
            y2={height - padding}
          />
          <text className="chart-label" x={padding} y={padding - 7}>
            {formatNumber(geometry.max)}
          </text>
          <text className="chart-label" x={padding} y={height - 6}>
            {formatNumber(geometry.min)}
          </text>
        </>
      {geometry.referenceArea ? (
        <polygon className="chart-reference" points={geometry.referenceArea} />
      ) : null}
      {points.every((point) => !point.comparator) ? (
        <polyline className="chart-line" points={line} />
      ) : null}
      <line className="chart-guide" x1={geometry.points[activeIndex].x} x2={geometry.points[activeIndex].x} y1={padding} y2={height - padding} />
      {geometry.points.map((point) => (
        <circle
          className={
            isOutsideReference(point) ? "chart-point outside" : "chart-point"
          }
          cx={point.x}
          cy={point.y}
          key={point.observationId}
          r={point.observationId === geometry.points[activeIndex].observationId ? 6 : 4}
        >
          <title>{`${point.collectedAt}: ${point.valueText} ${point.unit ?? ""}`}</title>
        </circle>
      ))}
    </svg>
    {points.length ? (
      <figcaption className="chart-legend" style={{ justifyContent: "space-between" }}>
        <span>{points[0].collectedAt}</span>
        <strong>{geometry.points[activeIndex].collectedAt} · {geometry.points[activeIndex].valueText} {geometry.points[activeIndex].unit ?? ""}</strong>
        <span>{points.at(-1)!.collectedAt}</span>
      </figcaption>
    ) : null}
    </figure>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    value,
  );
}
