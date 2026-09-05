import type {
  DraftExtractor,
  MetricAlias,
  ObservationDraft,
  RecognitionDraft,
} from "@/server/recognition";
const RECOGNITION_VERSION = "local-2";

const NUMBER = "-?\\d+(?:[.,]\\d+)?";
const VALUE = new RegExp(`(?:^|[\\s:;=])([<>≤≥]?\\s*${NUMBER})`, "u");
const RANGE = new RegExp(`(${NUMBER})\\s*[-–—]\\s*(${NUMBER})`, "u");
const COMPARISON = new RegExp(`([<>≤≥]\\s*${NUMBER})`, "u");
const UNIT = new RegExp(
  "(?:10[\\^⁹³6\\d]*/[лl]|ммоль/[лl]|mmol/[лl]|мкмоль/[лl]|[µμu]mol/[лl]|мг/[дd][лl]|mg/dl|мг/[лl]|mg/[лl]|г/[лl]|g/[лl]|ед/[лl]|u/[лl]|iu/[лl]|мл/мин(?:/1[,.]73\\s*м²)?|ml/min(?:/1[,.]73\\s*m2)?|мг/г|mg/g|мг/ммоль|mg/mmol|%|фл|fl|пг|pg)",
  "iu",
);

export function createLocalDraftExtractor(): DraftExtractor {
  return { extract: extractDraft };
}

export function extractDraft(
  text: string,
  aliases: MetricAlias[],
): RecognitionDraft {
  const sortedAliases = [...aliases].sort(
    (a, b) => b.alias.length - a.alias.length,
  );
  const observations: ObservationDraft[] = [];
  const languageCounts = new Map<string, number>();
  const warnings: string[] = [];

  for (const sourceText of text.split(/\r?\n/)) {
    const line = sourceText.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const normalizedLine = normalize(line);
    const matchedAlias = sortedAliases.find(({ alias }) =>
      containsAlias(normalizedLine, normalize(alias)),
    );

    if (matchedAlias) {
      const parsed = parseKnownLine(line, normalizedLine, matchedAlias);
      if (parsed) {
        observations.push(parsed);
        languageCounts.set(
          matchedAlias.language,
          (languageCounts.get(matchedAlias.language) ?? 0) + 1,
        );
      }
      continue;
    }

    const unknown = parseUnknownLine(line);
    if (unknown) observations.push(unknown);
  }

  if (observations.length === 0) {
    warnings.push(
      "Показатели не найдены автоматически. Проверьте извлечённый текст.",
    );
  }
  if (observations.some(({ unit }) => !unit)) {
    warnings.push("У части показателей не определены единицы измерения.");
  }
  if (observations.some(({ metricDefinitionId }) => !metricDefinitionId)) {
    warnings.push("Часть показателей пока не сопоставлена с каталогом.");
  }

  return {
    recognitionVersion: RECOGNITION_VERSION,
    extractedText: text,
    detectedLanguage: mostFrequentLanguage(languageCounts),
    laboratoryName: findLaboratory(text),
    collectedAt: findDate(text),
    specimen: null,
    warnings,
    observations,
  };
}

function parseKnownLine(
  sourceText: string,
  normalizedLine: string,
  alias: MetricAlias,
) {
  const aliasText = normalize(alias.alias);
  const aliasIndex = normalizedLine.indexOf(aliasText);
  const remainder = normalizedLine.slice(aliasIndex + aliasText.length);
  const value = VALUE.exec(remainder);
  if (!value) return null;

  const valueText = numberOnly(value[1]);
  const afterValue = remainder.slice((value.index ?? 0) + value[0].length);
  const unit = UNIT.exec(afterValue)?.[0] ?? null;
  const reference = parseReference(afterValue);
  const confidence = unit ? 0.92 : 0.78;

  return {
    metricDefinitionId: alias.metricDefinitionId,
    originalName:
      sourceText
        .slice(0, Math.max(0, sourceText.search(/[<>≤≥]?\s*\d/)))
        .trim() || alias.alias,
    displayName: alias.displayName,
    category: alias.category,
    valueText,
    unit,
    ...reference,
    confidence,
    sourceText,
  } satisfies ObservationDraft;
}

function parseUnknownLine(sourceText: string) {
  const unit = UNIT.exec(sourceText);
  if (!unit) return null;

  const beforeUnit = sourceText.slice(0, unit.index);
  const values = [...beforeUnit.matchAll(new RegExp(NUMBER, "gu"))];
  const value = values.at(-1);
  if (!value || value.index === undefined) return null;

  const originalName = beforeUnit
    .slice(0, value.index)
    .replace(/[:;=\s]+$/u, "")
    .trim();
  if (originalName.length < 2 || originalName.length > 100) return null;

  const afterValue = sourceText.slice(value.index + value[0].length);
  return {
    metricDefinitionId: null,
    originalName,
    displayName: null,
    category: null,
    valueText: numberOnly(value[0]),
    unit: unit[0],
    ...parseReference(afterValue),
    confidence: 0.5,
    sourceText,
  } satisfies ObservationDraft;
}

function parseReference(value: string) {
  const range = RANGE.exec(value);
  if (range) {
    return {
      referenceLow: numberOnly(range[1]),
      referenceHigh: numberOnly(range[2]),
      referenceText: range[0],
    };
  }

  const comparison = COMPARISON.exec(value);
  return {
    referenceLow: null,
    referenceHigh: null,
    referenceText: comparison?.[0].replace(/\s/g, "") ?? null,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAlias(line: string, alias: string) {
  const index = line.indexOf(alias);
  if (index < 0) return false;

  const before = line[index - 1];
  const after = line[index + alias.length];
  return !isWordCharacter(before) && !isWordCharacter(after);
}

function isWordCharacter(value: string | undefined) {
  return value ? /[\p{L}\p{N}]/u.test(value) : false;
}

function numberOnly(value: string) {
  return value.replace(/[<>≤≥\s]/g, "").replace(",", ".");
}

function mostFrequentLanguage(counts: Map<string, number>) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

function findLaboratory(text: string) {
  const line = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(
      (value) =>
        value.length <= 140 &&
        /(?:лаборатор|laborator|laboratoire|laboratorio|labor\b)/iu.test(value),
    );
  return line || null;
}

function findDate(text: string) {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const european = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (european) {
    return validDate(
      Number(european[3]),
      Number(european[2]),
      Number(european[1]),
    );
  }
  return null;
}

function validDate(year: number, month: number, day: number) {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}
