export type NumericResult = {
  comparator: "<" | "<=" | ">" | ">=" | null;
  valueNumeric: number;
  valueText: string;
};

const NUMERIC_RESULT =
  /^([<>]=?|≤|≥)?\s*(-?\d+(?:[.,]\d+)?)(?:\s+[+\-−])?$/;

export function parseNumericResult(value: string): NumericResult | null {
  const match = value.trim().match(NUMERIC_RESULT);
  if (!match) return null;

  const numericText = match[2].replace(",", ".");
  const valueNumeric = Number(numericText);
  if (!Number.isFinite(valueNumeric)) return null;

  const comparator = normalizeComparator(match[1]);
  return {
    comparator,
    valueNumeric,
    valueText: `${comparator ?? ""}${numericText}`,
  };
}

function normalizeComparator(value: string | undefined) {
  if (!value) return null;
  if (value === "≤") return "<=";
  if (value === "≥") return ">=";
  return value as NumericResult["comparator"];
}
