"use client";

import { useActionState, useRef, useState } from "react";
import {
  confirmImportAction,
  type ConfirmationActionState,
} from "@/app/confirmation/actions";
import type { MetricDefinitionOption } from "@/server/confirmation";
import type { StoredRecognitionDraft } from "@/server/recognition";

type ReviewFormProps = {
  importSessionId: number;
  draft: StoredRecognitionDraft;
  metrics: MetricDefinitionOption[];
};

type ReviewRow = {
  valueKind: "number" | "text";
  needsReview: boolean;
  key: number;
  metricDefinitionId: number | null;
  originalName: string;
  valueText: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
  referenceText: string;
  sourceText: string;
};

const INITIAL_STATE: ConfirmationActionState = { error: null, conflicts: [] };

export function ReviewForm({ importSessionId, draft, metrics }: ReviewFormProps) {
  const nextKey = useRef(draft.observations.length);
  const [metadata, setMetadata] = useState({
    collectedAt: draft.collectedAt ?? "",
    laboratoryName: draft.laboratoryName ?? "",
    specimen: draft.specimen ?? "",
    note: "",
  });
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    draft.observations.map((observation, key) => ({
      valueKind: /^([<>]=?|≤|≥)?\s*-?\d+(?:[.,]\d+)?$/.test(observation.valueText.trim()) ? "number" : "text",
      needsReview: observation.confidence < 0.85,
      key,
      metricDefinitionId: observation.metricDefinitionId,
      originalName: observation.originalName,
      valueText: observation.valueText,
      unit: observation.unit ?? "",
      referenceLow: observation.referenceLow ?? "",
      referenceHigh: observation.referenceHigh ?? "",
      referenceText:
        observation.referenceLow || observation.referenceHigh
          ? ""
          : (observation.referenceText ?? ""),
      sourceText: observation.sourceText,
    })),
  );
  const action = confirmImportAction.bind(null, importSessionId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const groups = new Map<number, { row: ReviewRow; index: number }[]>();
  rows.forEach((row, index) => {
    if (row.metricDefinitionId === null) return;
    const group = groups.get(row.metricDefinitionId) ?? [];
    group.push({ row, index });
    groups.set(row.metricDefinitionId, group);
  });
  const duplicates = [...groups].filter(([, group]) => group.length > 1);

  function addRow() {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((current) => [
      ...current,
      {
        key,
        valueKind: "number",
        needsReview: true,
        metricDefinitionId: null,
        originalName: "",
        valueText: "",
        unit: "",
        referenceLow: "",
        referenceHigh: "",
        referenceText: "",
        sourceText: "",
      },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function updateRow<K extends keyof Omit<ReviewRow, "key">>(
    key: number,
    field: K,
    value: ReviewRow[K],
  ) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={formAction} className="review-form">
      <section className="content-card review-metadata">
        <div className="recent-imports-heading">
          <div>
            <p className="status-label">Проверка</p>
            <h2>Данные анализа</h2>
          </div>
          <span>{rows.length}</span>
        </div>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Дата забора</span>
            <input
              name="collectedAt"
              onChange={(event) =>
                setMetadata((current) => ({
                  ...current,
                  collectedAt: event.target.value,
                }))
              }
              required
              type="date"
              value={metadata.collectedAt}
            />
          </label>
          <label className="field">
            <span>Лаборатория</span>
            <input
              maxLength={200}
              name="laboratoryName"
              onChange={(event) =>
                setMetadata((current) => ({
                  ...current,
                  laboratoryName: event.target.value,
                }))
              }
              value={metadata.laboratoryName}
            />
          </label>
          <label className="field">
            <span>Материал</span>
            <input
              maxLength={100}
              name="specimen"
              onChange={(event) =>
                setMetadata((current) => ({
                  ...current,
                  specimen: event.target.value,
                }))
              }
              placeholder="Например, кровь или моча"
              value={metadata.specimen}
            />
          </label>
          <label className="field">
            <span>Заметка</span>
            <input
              maxLength={2000}
              name="note"
              onChange={(event) =>
                setMetadata((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Например, анализ сдан во время болезни"
              value={metadata.note}
            />
          </label>
        </div>
      </section>

      <section className="content-card review-table-card">
        <h2>Показатели</h2>
        <p className="muted-copy">Исправляйте данные прямо в ячейках. Показатель — единое название в каталоге, группа — его категория.</p>
        {duplicates.length ? <p className="notice">Есть повторяющиеся показатели. Выберите основные значения в разделе «Повторы в документе» под таблицей.</p> : null}
        <div className="table-wrap">
          <table className="review-table">
            <thead><tr>
              <th scope="col">Название в документе</th>
              <th scope="col">Показатель / группа</th>
              <th scope="col">Значение</th><th scope="col">Единица</th>
              <th scope="col">Референс от</th><th scope="col">До</th>
              <th scope="col">Референс текстом</th><th scope="col">Действия</th>
            </tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={row.key} className={row.metricDefinitionId === null || row.needsReview ? "unmapped-row" : undefined}>
                <td><input aria-label={`Название в документе, строка ${index + 1}`} name="originalName" required maxLength={200} value={row.originalName} onChange={(event) => updateRow(row.key, "originalName", event.target.value)} />
                  <input name="sourceText" type="hidden" value={row.sourceText} readOnly />
                </td>
                <td><select aria-label={`Показатель, строка ${index + 1}`} name="metricDefinitionId" required value={row.metricDefinitionId ?? ""} onChange={(event) => updateRow(row.key, "metricDefinitionId", event.target.value ? Number(event.target.value) : null)}>
                  <option value="">Не сопоставлен</option>
                  {metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.displayName}</option>)}
                </select><small>{metrics.find((metric) => metric.id === row.metricDefinitionId)?.category ?? "Нужно сопоставить"}</small></td>
                {(["valueText", "unit", "referenceLow", "referenceHigh", "referenceText"] as const).map((field) => (
                  <td key={field}><input
                    aria-label={`${({valueText: "Значение", unit: "Единица", referenceLow: "Референс от", referenceHigh: "Референс до", referenceText: "Референс текстом"})[field]}, строка ${index + 1}`}
                    name={field} value={row[field]} required={field === "valueText"}
                    onChange={(event) => updateRow(row.key, field, event.target.value)}
                  />{field === "valueText" ? <select aria-label={`Тип результата, строка ${index + 1}`} name="valueKind" value={row.valueKind} onChange={(event) => updateRow(row.key, "valueKind", event.target.value as ReviewRow["valueKind"])}><option value="number">Число</option><option value="text">Текст</option></select> : null}</td>
                ))}
                <td><button className="text-button" aria-label={`Удалить строку ${index + 1}`} onClick={() => removeRow(row.key)} type="button">Удалить</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <button className="secondary-button add-row-button" onClick={addRow} type="button">
        + Добавить показатель
      </button>

      {duplicates.length ? (
        <section className="content-card conflict-section">
          <h2>Повторы в документе</h2>
          <p>Один показатель встречается в нескольких строках. Выберите основную строку для истории. Все варианты и их референсы сохранятся. Если это разные показатели, исправьте сопоставление в таблице.</p>
          <div className="conflict-list">
            {duplicates.map(([metricId, group]) => (
              <fieldset className="conflict-card" key={JSON.stringify(group)}>
                <legend>{metrics.find((metric) => metric.id === metricId)?.displayName}</legend>
                <input type="hidden" name="duplicateMetricDefinitionId" value={metricId} readOnly />
                {group.map(({ row, index }) => (
                  <label key={row.key}>
                    <input type="radio" required name={`duplicateChoice-${metricId}`} value={index} />
                    <span><small>Строка {index + 1}: {row.originalName}</small>
                      <strong>{formatConflictValue(row)}</strong>
                      <small>Референс: {row.referenceText || [row.referenceLow || "…", row.referenceHigh || "…"].join(" — ")}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ) : null}

      {state.error ? <p role="alert" className="notice error">{state.error}</p> : null}

      {state.conflicts.length ? (
        <section className="content-card conflict-section">
          <p className="status-label">Нужно выбрать</p>
          <h2>Нашли разные значения</h2>
          <p>
            Выберите основное значение для каждого показателя. Оба источника
            сохранятся.
          </p>
          <div className="conflict-list">
            {state.conflicts.map((conflict) => (
              <fieldset className="conflict-card" key={conflict.metricDefinitionId}>
                <legend>{conflict.displayName}</legend>
                <input
                  name="conflictMetricDefinitionId"
                  readOnly
                  type="hidden"
                  value={conflict.metricDefinitionId}
                />
                <label>
                  <input
                    name={`conflictChoice-${conflict.metricDefinitionId}`}
                    required
                    type="radio"
                    value="existing"
                  />
                  <span>
                    <small>Уже сохранено</small>
                    <strong>{formatConflictValue(conflict.existing)}</strong>
                  </span>
                </label>
                <label>
                  <input
                    name={`conflictChoice-${conflict.metricDefinitionId}`}
                    required
                    type="radio"
                    value="incoming"
                  />
                  <span>
                    <small>В этом документе</small>
                    <strong>{formatConflictValue(conflict.incoming)}</strong>
                  </span>
                </label>
              </fieldset>
            ))}
          </div>
        </section>
      ) : null}

      <div className="confirmation-bar">
        <p>После подтверждения документ станет частью истории анализов.</p>
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Сохраняем…" : "Подтвердить документ"}
        </button>
      </div>
    </form>
  );
}

function formatConflictValue(value: { valueText: string; unit: string | null }) {
  return [value.valueText, value.unit].filter(Boolean).join(" ");
}
