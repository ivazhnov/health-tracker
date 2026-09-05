import type { MetricPoint } from "@/server/metric-history";
import {
  buildChartGeometry,
  isOutsideReference,
} from "@/app/metrics/chart-geometry";

export function MetricChart({
  points,
  compact = false,
}: {
  points: MetricPoint[];
  compact?: boolean;
}) {
  const units = new Set(points.map((point) => point.unit));
  if (units.size > 1) {
    return <p className="muted-copy">Разные единицы измерения — сравните значения в истории.</p>;
  }
  const width = compact ? 320 : 760;
  const height = compact ? 110 : 280;
  const padding = compact ? 12 : 28;
  const geometry = buildChartGeometry(points, width, height, padding);
  const line = geometry.points.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <figure style={{ margin: 0 }}>
    <svg
      aria-label={`Динамика: ${points.length} ${measurementWord(points.length)}`}
      className={`metric-chart${compact ? " compact-chart" : ""}`}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {!compact ? (
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
      ) : null}
      {geometry.referenceArea ? (
        <polygon className="chart-reference" points={geometry.referenceArea} />
      ) : null}
      {geometry.points.length > 1 && points.every((point) => !point.comparator) ? (
        <polyline className="chart-line" points={line} />
      ) : null}
      {geometry.points.map((point) => (
        <circle
          className={
            isOutsideReference(point) ? "chart-point outside" : "chart-point"
          }
          cx={point.x}
          cy={point.y}
          key={point.observationId}
          r={compact ? 3.5 : 5}
        >
          <title>{`${point.collectedAt}: ${point.valueText} ${point.unit ?? ""}`}</title>
        </circle>
      ))}
    </svg>
    {!compact && points.length ? (
      <figcaption className="chart-legend" style={{ justifyContent: "space-between" }}>
        <span style={{ width: "auto", height: "auto", background: "none" }}>{points[0].collectedAt}</span>
        <span style={{ width: "auto", height: "auto", background: "none" }}>{points.at(-1)!.collectedAt}</span>
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

function measurementWord(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return "измерение";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "измерения";
  }
  return "измерений";
}
