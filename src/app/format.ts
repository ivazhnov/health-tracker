import type { MetricPoint } from "@/server/metric-history";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`)).replace(" г.", "");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value)).replace(" г.", "");
}

export function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function ageText(dateOfBirth: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) years -= 1;
  const word = years % 10 === 1 && years % 100 !== 11 ? "год" :
    [2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100) ? "года" : "лет";
  return `${years} ${word}`;
}

export function measurementText(measurement: { heightCm: number | null; weightKg: number | null } | null) {
  if (!measurement) return null;
  return [
    measurement.heightCm === null ? null : `${formatNumber(measurement.heightCm)} см`,
    measurement.weightKg === null ? null : `${formatNumber(measurement.weightKg)} кг`,
  ].filter(Boolean).join(" · ");
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 10 }).format(value);
}

export function countText(
  count: number,
  forms: [one: string, few: string, many: string],
) {
  const lastTwo = count % 100;
  const last = count % 10;
  const form = lastTwo >= 11 && lastTwo <= 14
    ? forms[2]
    : last === 1
      ? forms[0]
      : last >= 2 && last <= 4
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}

export function metricValue(point: Pick<MetricPoint, "comparator" | "valueText" | "unit">) {
  const comparator = point.comparator && !point.valueText.trim().startsWith(point.comparator)
    ? point.comparator
    : "";
  return [`${comparator}${point.valueText.replace(".", ",")}`, point.unit].filter(Boolean).join(" ");
}

export function referenceText(point: Pick<MetricPoint, "referenceLow" | "referenceHigh" | "referenceText">) {
  if (point.referenceText) return point.referenceText;
  if (point.referenceLow !== null && point.referenceHigh !== null) {
    return `${formatNumber(point.referenceLow)}–${formatNumber(point.referenceHigh)}`;
  }
  if (point.referenceLow !== null) return `от ${formatNumber(point.referenceLow)}`;
  if (point.referenceHigh !== null) return `до ${formatNumber(point.referenceHigh)}`;
  return "—";
}

export function referenceStatus(point: Pick<MetricPoint, "valueNumeric" | "comparator" | "referenceLow" | "referenceHigh">) {
  if (point.valueNumeric === null || point.comparator ||
      (point.referenceLow === null && point.referenceHigh === null)) return "Нет референса";
  if (point.referenceLow !== null && point.valueNumeric < point.referenceLow) return "Ниже референса";
  if (point.referenceHigh !== null && point.valueNumeric > point.referenceHigh) return "Выше референса";
  return "В референсе";
}

export function trendText(points: MetricPoint[]) {
  const [previous, latest] = points.slice(-2);
  if (!previous || !latest || previous.valueNumeric === null || latest.valueNumeric === null ||
      normalized(previous.unit) !== normalized(latest.unit) ||
      normalized(previous.specimen) !== normalized(latest.specimen)) return "—";
  const change = latest.valueNumeric - previous.valueNumeric;
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  return `${arrow} ${formatNumber(Math.abs(change))}`;
}

function normalized(value: string | null) {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
}
