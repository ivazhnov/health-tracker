"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  returnTo?: string;
  warnings?: string[];
};
type ReviewRow = {
  valueKind: "number" | "text";
  needsReview: boolean;
  modified: boolean;
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
const NUMBER_VALUE = /^([<>]=?|≤|≥)?\s*-?\d+(?:[.,]\d+)?$/;

export function ReviewForm({
  importSessionId,
  draft,
  metrics,
  returnTo,
  warnings = [],
}: ReviewFormProps) {
  const nextKey = useRef(draft.observations.length);
  const [metadataEditing, setMetadataEditing] = useState(false);
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [dirty, setDirty] = useState(false);
  const [metadata, setMetadata] = useState({
    collectedAt: draft.collectedAt ?? "",
    laboratoryName: draft.laboratoryName ?? "",
    note: "",
  });
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    draft.observations.map((observation, key) => ({
      valueKind: inferValueKind(observation.valueText),
      needsReview: observation.confidence < 0.85,
      modified: false,
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
  const [state, formAction, pending] = useActionState(
    confirmImportAction.bind(null, importSessionId),
    INITIAL_STATE,
  );

  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [dirty]);

  const groups = new Map<number, { row: ReviewRow; index: number }[]>();
  rows.forEach((row, index) => {
    if (row.metricDefinitionId !== null)
      groups.set(row.metricDefinitionId, [
        ...(groups.get(row.metricDefinitionId) ?? []),
        { row, index },
      ]);
  });
  const duplicates = [...groups].filter(([, group]) => group.length > 1);
  const issueRows = rows.filter((row) => rowIssues(row).length > 0);
  const rowBlockers = rows.filter(
    (row) => !row.metricDefinitionId || !row.valueText.trim(),
  ).length;
  const blockers = rowBlockers + (metadata.collectedAt ? 0 : 1);
  const humanWarnings = warnings
    .map(humanizeWarning)
    .filter((value, index, list) => value && list.indexOf(value) === index);

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: nextKey.current++,
        valueKind: "number",
        needsReview: true,
        modified: true,
        metricDefinitionId: null,
        originalName: "Новый показатель",
        valueText: "",
        unit: "",
        referenceLow: "",
        referenceHigh: "",
        referenceText: "",
        sourceText: "Добавлено вручную",
      },
    ]);
    setDirty(true);
  }
  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    setDirty(true);
  }
  function updateRow<K extends keyof Omit<ReviewRow, "key">>(
    key: number,
    field: K,
    value: ReviewRow[K],
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: value,
              modified: true,
              needsReview:
                field === "metricDefinitionId" || field === "valueText"
                  ? false
                  : row.needsReview,
              ...(field === "valueText"
                ? { valueKind: inferValueKind(String(value)) }
                : {}),
            }
          : row,
      ),
    );
    setDirty(true);
  }
  function updateMetadata(field: keyof typeof metadata, value: string) {
    setMetadata((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  return (
    <form action={formAction} className="review-form">
      {returnTo ? (
        <input name="returnTo" type="hidden" value={returnTo} />
      ) : null}
      <input name="collectedAt" type="hidden" value={metadata.collectedAt} />
      <input
        name="laboratoryName"
        type="hidden"
        value={metadata.laboratoryName}
      />
      <input name="note" type="hidden" value={metadata.note} />

      {issueRows.length || humanWarnings.length ? (
        <details className="review-issue-summary">
          <summary>
            <span>
              <strong>
                {issueRows.length
                  ? `Проверьте ${issueRows.length} ${pluralRows(issueRows.length)}`
                  : "Есть замечания распознавания"}
              </strong>
              <small>
                {blockers
                  ? `${blockers} блокируют подтверждение`
                  : "Подтверждение доступно"}
              </small>
            </span>
            <span>Подробнее</span>
          </summary>
          <ul>
            {humanWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            {issueRows.some((row) => row.metricDefinitionId === null) ? (
              <li>Для части строк нужно выбрать показатель.</li>
            ) : null}
          </ul>
        </details>
      ) : null}

      <section className="review-metadata compact-metadata">
        <div className="metadata-heading">
          <h2>Данные анализа</h2>
          <button
            className="text-button"
            type="button"
            onClick={() => setMetadataEditing((value) => !value)}
          >
            {metadataEditing ? "Готово" : "Изменить"}
          </button>
        </div>
        {metadataEditing ? (
          <div className="metadata-edit-grid">
            <label>
              <span>Дата забора</span>
              <input
                required
                type="date"
                value={metadata.collectedAt}
                onChange={(event) =>
                  updateMetadata("collectedAt", event.target.value)
                }
              />
            </label>
            <label>
              <span>Лаборатория</span>
              <input
                maxLength={200}
                value={metadata.laboratoryName}
                onChange={(event) =>
                  updateMetadata("laboratoryName", event.target.value)
                }
              />
            </label>
            <label className="metadata-note">
              <span>Заметка</span>
              <input
                maxLength={2000}
                placeholder="Например, анализ сдан во время болезни"
                value={metadata.note}
                onChange={(event) => updateMetadata("note", event.target.value)}
              />
            </label>
          </div>
        ) : (
          <dl className="metadata-values">
            <div>
              <dt>Дата забора</dt>
              <dd>{formatDateValue(metadata.collectedAt)}</dd>
            </div>
            <div>
              <dt>Лаборатория</dt>
              <dd>{metadata.laboratoryName || "Не указана"}</dd>
            </div>
            {metadata.note ? (
              <div>
                <dt>Заметка</dt>
                <dd>{metadata.note}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      <section className="review-table-card">
        <div className="review-table-toolbar">
          <div>
            <h2>Показатели</h2>
            <span>{rows.length} строк</span>
          </div>
          <div
            className="compact-filter"
            role="group"
            aria-label="Фильтр показателей"
          >
            <button
              className={filter === "all" ? "active" : ""}
              type="button"
              onClick={() => setFilter("all")}
            >
              Все
            </button>
            <button
              className={filter === "issues" ? "active" : ""}
              type="button"
              onClick={() => setFilter("issues")}
            >
              Требуют внимания · {issueRows.length}
            </button>
          </div>
        </div>
        {duplicates.length ? (
          <p className="compact-notice">
            Есть повторы. Выберите основные значения под таблицей.
          </p>
        ) : null}
        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Показатель</th>
                <th>Результат</th>
                <th>Референс</th>
                <th>Проверка</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const issues = rowIssues(row);
                const metric = metrics.find(
                  ({ id }) => id === row.metricDefinitionId,
                );
                return (
                  <tr
                    key={row.key}
                    hidden={filter === "issues" && issues.length === 0}
                    className={issues.length ? "issue-row" : undefined}
                  >
                    <td data-label="Показатель">
                      <div className="metric-editor">
                        <select
                          aria-label={`Показатель, строка ${index + 1}`}
                          name="metricDefinitionId"
                          required
                          value={row.metricDefinitionId ?? ""}
                          onChange={(event) =>
                            updateRow(
                              row.key,
                              "metricDefinitionId",
                              event.target.value
                                ? Number(event.target.value)
                                : null,
                            )
                          }
                        >
                          <option value="">Не сопоставлен</option>
                          {metrics.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.displayName}
                            </option>
                          ))}
                        </select>
                        <small title={row.originalName}>{row.originalName}</small>
                        <em>{metric?.category ?? "Нужно сопоставить"}</em>
                      </div>
                      <input
                        name="originalName"
                        type="hidden"
                        value={row.originalName}
                      />
                      <input
                        name="sourceText"
                        type="hidden"
                        value={row.sourceText}
                      />
                    </td>
                    <td data-label="Результат">
                      <div className="result-editor">
                        <input
                          aria-label={`Результат, строка ${index + 1}`}
                          name="valueText"
                          required
                          maxLength={200}
                          value={row.valueText}
                          onChange={(event) =>
                            updateRow(row.key, "valueText", event.target.value)
                          }
                        />
                        <input
                          aria-label={`Единица, строка ${index + 1}`}
                          name="unit"
                          maxLength={50}
                          placeholder="ед."
                          value={row.unit}
                          onChange={(event) =>
                            updateRow(row.key, "unit", event.target.value)
                          }
                        />
                      </div>
                      <input
                        name="valueKind"
                        type="hidden"
                        value={row.valueKind}
                      />
                    </td>
                    <td data-label="Референс">
                      <details className="reference-editor">
                        <summary>{formatReference(row)}</summary>
                        <div>
                          <label>
                            От
                            <input
                              name="referenceLow"
                              value={row.referenceLow}
                              onChange={(event) =>
                                updateRow(
                                  row.key,
                                  "referenceLow",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label>
                            До
                            <input
                              name="referenceHigh"
                              value={row.referenceHigh}
                              onChange={(event) =>
                                updateRow(
                                  row.key,
                                  "referenceHigh",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label>
                            Текст
                            <input
                              name="referenceText"
                              maxLength={200}
                              value={row.referenceText}
                              onChange={(event) =>
                                updateRow(
                                  row.key,
                                  "referenceText",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </details>
                    </td>
                    <td data-label="Проверка">
                      <span
                        className={`row-review-state ${issues.length ? "attention" : "ready"}`}
                      >
                        {issues[0] ?? (row.modified ? "Изменено" : "Готово")}
                      </span>
                      {issues.length > 1 || (row.modified && issues.length) ? (
                        <small>
                          {[
                            ...issues.slice(1),
                            ...(row.modified ? ["Изменено"] : []),
                          ].join(" · ")}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Действия">
                      <details className="row-menu">
                        <summary aria-label={`Действия, строка ${index + 1}`}>
                          •••
                        </summary>
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                        >
                          Удалить строку
                        </button>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filter === "issues" && issueRows.length === 0 ? (
          <p className="empty-filter">Все строки готовы к подтверждению.</p>
        ) : null}
        <button
          className="text-button add-compact-row"
          onClick={addRow}
          type="button"
        >
          + Добавить показатель
        </button>
      </section>

      {duplicates.length ? (
        <section className="content-card conflict-section">
          <h2>Повторы в документе</h2>
          <p>
            Выберите основную строку для истории. Остальные варианты и их
            источники сохранятся.
          </p>
          <div className="conflict-list">
            {duplicates.map(([metricId, group]) => (
              <fieldset className="conflict-card" key={metricId}>
                <legend>
                  {
                    metrics.find((metric) => metric.id === metricId)
                      ?.displayName
                  }
                </legend>
                <input
                  type="hidden"
                  name="duplicateMetricDefinitionId"
                  value={metricId}
                />
                {group.map(({ row, index }) => (
                  <label key={row.key}>
                    <input
                      type="radio"
                      required
                      name={`duplicateChoice-${metricId}`}
                      value={index}
                    />
                    <span>
                      <small>
                        Строка {index + 1}: {row.originalName}
                      </small>
                      <strong>{formatConflictValue(row)}</strong>
                      <small>{formatReference(row)}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ) : null}
      {state.error ? (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      ) : null}
      {state.conflicts.length ? (
        <section className="content-card conflict-section">
          <h2>Нашли разные значения</h2>
          <p>Выберите основное значение. Оба источника сохранятся.</p>
          <div className="conflict-list">
            {state.conflicts.map((conflict) => (
              <fieldset
                className="conflict-card"
                key={conflict.metricDefinitionId}
              >
                <legend>{conflict.displayName}</legend>
                <input
                  name="conflictMetricDefinitionId"
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
        <p>
          <strong>
            {rows.length - rowBlockers} из {rows.length} готовы
          </strong>
          <span>
            {blockers
              ? `Исправьте обязательные поля: ${blockers}`
              : "Все обязательные данные заполнены"}
          </span>
        </p>
        <button className="primary-button" disabled={pending} type="submit">
          {pending
            ? "Сохраняем…"
            : `Подтвердить ${rows.length} ${pluralRows(rows.length)}`}
        </button>
      </div>
    </form>
  );
}

function inferValueKind(value: string): ReviewRow["valueKind"] {
  return NUMBER_VALUE.test(value.trim()) ? "number" : "text";
}
function rowIssues(row: ReviewRow) {
  const issues: string[] = [];
  if (row.metricDefinitionId === null) issues.push("Не сопоставлен");
  if (!row.valueText.trim()) issues.push("Нет результата");
  if (row.needsReview) issues.push("Низкая уверенность");
  return issues;
}
function formatReference(
  row: Pick<ReviewRow, "referenceLow" | "referenceHigh" | "referenceText">,
) {
  return (
    row.referenceText ||
    (row.referenceLow || row.referenceHigh
      ? `${row.referenceLow || "…"} — ${row.referenceHigh || "…"}`
      : "Не указан")
  );
}
function formatConflictValue(value: {
  valueText: string;
  unit: string | null;
}) {
  return [value.valueText, value.unit].filter(Boolean).join(" ");
}
function formatDateValue(value: string) {
  if (!value) return "Не указана";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}
function pluralRows(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "строк";
  if (last === 1) return "строку";
  if (last >= 2 && last <= 4) return "строки";
  return "строк";
}
function humanizeWarning(value: string) {
  const warning = value.toLocaleLowerCase();
  if (warning.includes("ai подготовил")) return "";
  if (warning.includes("единиц"))
    return "У части результатов не распознаны единицы измерения.";
  if (warning.includes("сопостав"))
    return "У части строк не найдено однозначное соответствие в каталоге.";
  if (warning.includes("не найдены"))
    return "Результаты не удалось уверенно выделить из документа.";
  if (warning.includes("дат")) return "Проверьте дату забора материала.";
  if (warning.includes("материал")) return "";
  return "Проверьте строки, отмеченные как требующие внимания.";
}
