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

const INITIAL_STATE: ConfirmationActionState = { error: null };

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

  function addRow() {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((current) => [
      ...current,
      {
        key,
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

      <div className="review-rows">
        {rows.map((row, index) => (
          <fieldset className="content-card review-row" key={row.key}>
            <legend>Показатель {index + 1}</legend>
            <button
              className="remove-row-button"
              onClick={() => removeRow(row.key)}
              type="button"
            >
              Удалить
            </button>

            <div className="form-grid two-columns">
              <label className="field wide-field">
                <span>Показатель</span>
                <select
                  name="metricDefinitionId"
                  onChange={(event) =>
                    updateRow(
                      row.key,
                      "metricDefinitionId",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  required
                  value={row.metricDefinitionId ?? ""}
                >
                  <option disabled value="">
                    Выберите из каталога
                  </option>
                  {metrics.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.category} · {metric.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field wide-field">
                <span>Название в документе</span>
                <input
                  maxLength={200}
                  name="originalName"
                  onChange={(event) =>
                    updateRow(row.key, "originalName", event.target.value)
                  }
                  required
                  value={row.originalName}
                />
              </label>
              <label className="field">
                <span>Значение</span>
                <input
                  inputMode="decimal"
                  name="valueText"
                  onChange={(event) =>
                    updateRow(row.key, "valueText", event.target.value)
                  }
                  placeholder="Например, 3,1 или &lt;5"
                  required
                  value={row.valueText}
                />
              </label>
              <label className="field">
                <span>Единица</span>
                <input
                  maxLength={50}
                  name="unit"
                  onChange={(event) =>
                    updateRow(row.key, "unit", event.target.value)
                  }
                  value={row.unit}
                />
              </label>
              <label className="field">
                <span>Референс от</span>
                <input
                  inputMode="decimal"
                  name="referenceLow"
                  onChange={(event) =>
                    updateRow(row.key, "referenceLow", event.target.value)
                  }
                  value={row.referenceLow}
                />
              </label>
              <label className="field">
                <span>Референс до</span>
                <input
                  inputMode="decimal"
                  name="referenceHigh"
                  onChange={(event) =>
                    updateRow(row.key, "referenceHigh", event.target.value)
                  }
                  value={row.referenceHigh}
                />
              </label>
              <label className="field wide-field">
                <span>Референс текстом</span>
                <input
                  maxLength={200}
                  name="referenceText"
                  onChange={(event) =>
                    updateRow(row.key, "referenceText", event.target.value)
                  }
                  placeholder="Например, отрицательно или &lt;5"
                  value={row.referenceText}
                />
              </label>
            </div>
            <input
              name="sourceText"
              readOnly
              type="hidden"
              value={row.sourceText}
            />
          </fieldset>
        ))}
      </div>

      <button className="secondary-button add-row-button" onClick={addRow} type="button">
        + Добавить показатель
      </button>

      {state.error ? <p className="notice error">{state.error}</p> : null}

      <div className="confirmation-bar">
        <p>После подтверждения документ станет частью истории анализов.</p>
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Сохраняем…" : "Подтвердить документ"}
        </button>
      </div>
    </form>
  );
}
