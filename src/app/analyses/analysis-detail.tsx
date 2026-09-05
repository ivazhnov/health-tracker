import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/app/confirmation/review-form";
import { SourcePanel } from "@/app/analyses/source-panel";
import { RetryRecognitionForm } from "@/app/analyses/retry-recognition-form";
import {
  formatDate,
  formatDateTime,
  metricValue,
  referenceStatus,
  referenceText,
} from "@/app/format";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { retryRecognitionAction } from "@/app/recognition/actions";
import type { ConfirmedLabSession } from "@/server/confirmation";
import {
  getConfirmedLabSession,
  getImport,
  getRecognitionDraft,
  listMetricDefinitions,
} from "@/server/services";

export async function AnalysisDetail({
  importId,
  personSlug,
  justConfirmed,
}: {
  importId: number;
  personSlug: string;
  justConfirmed: boolean;
}) {
  const item = getImport(importId);
  if (!item) notFound();
  const draft = getRecognitionDraft(item.id);
  const confirmed = getConfirmedLabSession(item.id);
  const metrics =
    draft && item.status === "needs_review" ? listMetricDefinitions() : [];
  const retryAction = retryRecognitionAction.bind(
    null,
    item.id,
    `/people/${personSlug}/analyses/${item.id}`,
  );
  return (
    <main className="person-page analysis-page">
      <div className="analysis-compact-header">
        <Link
          className="back-link compact"
          href={`/people/${personSlug}/analyses`}
        >
          ← Анализы
        </Link>
        <div className="analysis-heading">
          <div>
            <h1>
              {item.collectedAt
                ? `Анализ от ${formatDate(item.collectedAt)}`
                : item.originalFileName}
            </h1>
            <p>
              {[item.laboratoryName, item.originalFileName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="analysis-header-actions">
            {item.sourceDocumentId ? (
              <a
                className="secondary-button compact-button"
                href={`/api/documents/${item.sourceDocumentId}`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть оригинал ↗
              </a>
            ) : null}
            {item.sourceDocumentId && item.status !== "confirmed" ? (
              <details className="analysis-menu">
                <summary aria-label="Другие действия">•••</summary>
                <RetryRecognitionForm action={retryAction} />
              </details>
            ) : null}
          </div>
        </div>
        <div className="analysis-meta">
          <span className={`status-badge status-${item.status}`}>
            {statusLabel(item.status)}
          </span>
          <span>{formatSize(item.sizeBytes)}</span>
          <span>Загружено {formatDateTime(item.createdAt)}</span>
        </div>
      </div>
      {justConfirmed ? (
        <p className="notice success">
          Документ подтверждён и добавлен в историю.
        </p>
      ) : null}
      {item.errorMessage ? (
        <p className="notice error">{item.errorMessage}</p>
      ) : null}

      {confirmed ? <ConfirmedResults session={confirmed} /> : null}
      {draft && item.status === "needs_review" && item.sourceDocumentId ? (
        <>
          <section className="review-workspace compact-review">
            <SourcePanel
              extractedText={draft.extractedText}
              mediaType={item.mediaType}
              sourceDocumentId={item.sourceDocumentId}
            />
            <ReviewForm
              key={`${draft.recognitionVersion}-${item.updatedAt}`}
              draft={draft}
              importSessionId={item.id}
              metrics={metrics}
              returnTo={`/people/${personSlug}/analyses/${item.id}`}
              warnings={draft.warnings}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}

function ConfirmedResults({ session }: { session: ConfirmedLabSession }) {
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Результаты</h2>
        <span>{session.observations.length} показателей</span>
      </div>
      <div className="table-surface">
        <table className="data-table responsive-table numeric-table">
          <thead>
            <tr>
              <th>Показатель</th>
              <th>Результат</th>
              <th>Референс</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {session.observations.map((item) => {
              const status = referenceStatus(item);
              const kind =
                status === "В референсе"
                  ? "success"
                  : status === "Нет референса"
                    ? "neutral"
                    : "warning";
              return (
                <tr key={item.id}>
                  <td data-label="Показатель">
                    <strong>{item.displayName}</strong>
                    <small>{item.originalName}</small>
                  </td>
                  <td data-label="Результат">{metricValue(item)}</td>
                  <td data-label="Референс">{referenceText(item)}</td>
                  <td data-label="Статус">
                    <span className={`status-badge ${kind}`}>{status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {session.note ? <p className="analysis-note">{session.note}</p> : null}
      <div className="source-row">
        <strong>Источники</strong>
        {session.sources.map((source) => (
          <a
            key={source.sourceDocumentId}
            href={`/api/documents/${source.sourceDocumentId}`}
            target="_blank"
            rel="noreferrer"
          >
            {source.originalFileName} ↗
          </a>
        ))}
      </div>
    </section>
  );
}
