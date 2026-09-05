import type {
  ConfirmationObservationInput,
  ConfirmationRepository,
  ConfirmImportInput,
  ConfirmImportResult,
  MetricDefinitionOption,
  ValidatedConfirmation,
  ValidatedObservation,
} from "@/server/confirmation";

const NUMBER = /^-?\d+(?:[.,]\d+)?$/;
const VALUE = /^([<>]=?|≤|≥)?\s*(-?\d+(?:[.,]\d+)?)$/;

export function createConfirmationService(repository: ConfirmationRepository) {
  return {
    confirm(input: ConfirmImportInput): ConfirmImportResult {
      const validation = validateConfirmation(
        input,
        repository.listMetricDefinitions(),
      );
      if (!validation.ok) return validation;

      const result = repository.confirm(validation.value);
      if (result.status === "not_reviewable") {
        return {
          ok: false,
          error: "Эту загрузку уже нельзя подтвердить. Обновите страницу.",
        };
      }
      if (result.status === "conflicts") {
        return {
          ok: false,
          error: "Выберите значение для каждого конфликта.",
          conflicts: result.conflicts,
        };
      }

      return {
        ok: true,
        labSessionId: result.labSessionId,
        alreadyConfirmed: result.status === "already_confirmed",
        summary: result.summary,
      };
    },
  };
}

export function validateConfirmation(
  input: ConfirmImportInput,
  metrics: MetricDefinitionOption[],
): { ok: true; value: ValidatedConfirmation } | { ok: false; error: string } {
  if (!Number.isInteger(input.importSessionId) || input.importSessionId < 1) {
    return invalid("Не удалось определить загрузку.");
  }
  if (!validDate(input.collectedAt)) {
    return invalid("Укажите корректную дату забора материала.");
  }

  const laboratoryName = optionalText(input.laboratoryName, 200);
  if (laboratoryName === undefined) {
    return invalid("Название лаборатории не должно быть длиннее 200 символов.");
  }
  const note = input.note.trim();
  if (note.length > 2000) {
    return invalid("Заметка не должна быть длиннее 2000 символов.");
  }
  if (input.observations.length === 0) {
    return invalid("Добавьте хотя бы один показатель.");
  }
  if (input.observations.length > 200) {
    return invalid("В одном документе может быть не больше 200 показателей.");
  }

  const metricIds = new Set(metrics.map(({ id }) => id));
  const conflictResolutions = new Map<number, "existing" | "incoming">();
  for (const resolution of input.conflictResolutions ?? []) {
    const metricDefinitionId = Number(resolution.metricDefinitionId);
    if (
      !Number.isInteger(metricDefinitionId) ||
      !metricIds.has(metricDefinitionId) ||
      (resolution.choice !== "existing" && resolution.choice !== "incoming")
    ) {
      return invalid("Не удалось прочитать выбор для конфликта.");
    }
    if (conflictResolutions.has(metricDefinitionId)) {
      return invalid("Для одного конфликта передано несколько решений.");
    }
    conflictResolutions.set(metricDefinitionId, resolution.choice);
  }
  const parsed: ValidatedObservation[] = [];

  for (let index = 0; index < input.observations.length; index += 1) {
    const row = input.observations[index];
    const result = validateObservation(row, metricIds);
    if (!result.ok) {
      return invalid(`Строка ${index + 1}: ${result.error}`);
    }
    parsed.push(result.value);
  }

  const choices = new Map<number, number>();
  for (const choice of input.duplicateResolutions ?? []) {
    const metricId = Number(choice.metricDefinitionId);
    const rowIndex = Number(choice.rowIndex);
    if (
      !choice.rowIndex.trim() ||
      !Number.isInteger(rowIndex) ||
      parsed[rowIndex]?.metricDefinitionId !== metricId ||
      choices.has(metricId)
    ) {
      return invalid(
        "Выберите основную строку для каждого повтора в документе.",
      );
    }
    choices.set(metricId, rowIndex);
  }
  const observations: ValidatedObservation[] = [];
  for (const metricId of new Set(parsed.map((row) => row.metricDefinitionId))) {
    const group = parsed.filter((row) => row.metricDefinitionId === metricId);
    if (group.length === 1) {
      observations.push(group[0]);
      continue;
    }
    const selectedIndex = choices.get(metricId);
    if (selectedIndex === undefined) {
      const name = metrics.find(
        (metric) => metric.id === metricId,
      )!.displayName;
      return invalid(
        `«${name}» уже есть в нескольких строках. Выберите основную строку в разделе «Повторы в документе».`,
      );
    }
    const selected = parsed[selectedIndex];
    observations.push({
      ...selected,
      documentAlternatives: group.filter((row) => row !== selected),
    });
  }

  return {
    ok: true,
    value: {
      importSessionId: input.importSessionId,
      collectedAt: input.collectedAt,
      laboratoryName,
      note,
      observations,
      conflictResolutions,
    },
  };
}

function validateObservation(
  input: ConfirmationObservationInput,
  metricIds: Set<number>,
): { ok: true; value: ValidatedObservation } | { ok: false; error: string } {
  const metricDefinitionId = Number(input.metricDefinitionId);
  if (
    !Number.isInteger(metricDefinitionId) ||
    !metricIds.has(metricDefinitionId)
  ) {
    return invalid("выберите показатель из каталога.");
  }

  const originalName = input.originalName.trim();
  if (!originalName || originalName.length > 200) {
    return invalid("укажите исходное название до 200 символов.");
  }

  const valueText = input.valueText.trim();
  const textResult = input.valueKind === "text";
  if (input.valueKind && input.valueKind !== "number" && !textResult) {
    return invalid("выберите тип результата: число или текст.");
  }
  if (!valueText || valueText.length > 200) {
    return invalid("укажите результат до 200 символов.");
  }
  const value = valueText.match(VALUE);
  if (!textResult && !value) {
    return invalid(
      "значение должно быть числом, можно со знаком <, ≤, > или ≥.",
    );
  }
  const comparator = textResult ? null : normalizeComparator(value![1]);
  const numericText = textResult ? "" : value![2].replace(",", ".");
  const valueNumeric = textResult ? null : Number(numericText);
  if (valueNumeric !== null && !Number.isFinite(valueNumeric)) {
    return invalid("значение должно быть конечным числом.");
  }

  const unit = optionalText(input.unit, 50);
  if (unit === undefined) return invalid("единица слишком длинная.");
  const referenceLow = optionalNumber(input.referenceLow);
  if (referenceLow === undefined)
    return invalid("нижний референс должен быть числом.");
  const referenceHigh = optionalNumber(input.referenceHigh);
  if (referenceHigh === undefined)
    return invalid("верхний референс должен быть числом.");
  if (
    referenceLow !== null &&
    referenceHigh !== null &&
    referenceLow > referenceHigh
  ) {
    return invalid("нижний референс не может быть больше верхнего.");
  }
  const referenceText = optionalText(input.referenceText, 200);
  if (referenceText === undefined)
    return invalid("текст референса слишком длинный.");
  return {
    ok: true,
    value: {
      metricDefinitionId,
      originalName,
      valueText: textResult ? valueText : `${comparator ?? ""}${numericText}`,
      valueNumeric,
      comparator,
      unit,
      referenceLow,
      referenceHigh,
      referenceText,
      sourceText: input.sourceText.slice(0, 2000),
    },
  };
}

function optionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!NUMBER.test(normalized)) return undefined;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
}

function normalizeComparator(value: string | undefined) {
  if (!value) return null;
  if (value === "≤") return "<=";
  if (value === "≥") return ">=";
  return value as "<" | "<=" | ">" | ">=";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function invalid(error: string) {
  return { ok: false as const, error };
}
