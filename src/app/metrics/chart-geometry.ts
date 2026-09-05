import type { MetricPoint } from "@/server/metric-history";

export type ChartPoint = MetricPoint & { x: number; y: number };

export function buildChartGeometry(
  points: MetricPoint[],
  width: number,
  height: number,
  padding: number,
) {
  if (points.length === 0) {
    return { points: [] as ChartPoint[], min: 0, max: 0, referenceArea: null };
  }

  const scaleValues = points.flatMap((point) => [
    point.valueNumeric,
    ...(point.referenceLow === null ? [] : [point.referenceLow]),
    ...(point.referenceHigh === null ? [] : [point.referenceHigh]),
  ]);
  let min = Math.min(...scaleValues);
  let max = Math.max(...scaleValues);
  if (min === max) {
    const margin = Math.max(Math.abs(min) * 0.1, 1);
    min -= margin;
    max += margin;
  }

  const dates = points.map((point) => Date.parse(`${point.collectedAt}T00:00:00Z`));
  const firstDate = Math.min(...dates);
  const lastDate = Math.max(...dates);
  const xAt = (index: number) =>
    firstDate === lastDate
      ? width / 2
      : padding + ((dates[index] - firstDate) / (lastDate - firstDate)) * (width - padding * 2);
  const yAt = (value: number) =>
    height - padding - ((value - min) / (max - min)) * (height - padding * 2);
  const chartPoints = points.map((point, index) => ({
    ...point,
    x: xAt(index),
    y: yAt(point.valueNumeric),
  }));
  const hasCompleteReference = points.every(
    (point) => point.referenceLow !== null && point.referenceHigh !== null,
  );
  const referenceArea = !hasCompleteReference
    ? null
    : points.length === 1
      ? [
          `${padding},${yAt(points[0].referenceHigh!)}`,
          `${width - padding},${yAt(points[0].referenceHigh!)}`,
          `${width - padding},${yAt(points[0].referenceLow!)}`,
          `${padding},${yAt(points[0].referenceLow!)}`,
        ].join(" ")
      : [
        ...points.map((point, index) =>
          `${xAt(index)},${yAt(point.referenceHigh!)}`,
        ),
        ...points
          .map((point, index) => `${xAt(index)},${yAt(point.referenceLow!)}`)
          .reverse(),
      ].join(" ");

  return { points: chartPoints, min, max, referenceArea };
}

export function isOutsideReference(point: MetricPoint) {
  // A reporting threshold is not an exact measurement.
  if (point.comparator) return false;
  return (
    (point.referenceLow !== null && point.valueNumeric < point.referenceLow) ||
    (point.referenceHigh !== null && point.valueNumeric > point.referenceHigh)
  );
}
