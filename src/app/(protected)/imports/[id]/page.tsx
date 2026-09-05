import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/app/confirmation/review-form";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { retryRecognitionAction } from "@/app/recognition/actions";
import type {
  ConfirmedLabSession,
  ConfirmedObservation,
} from "@/server/confirmation";
import {
  getConfirmedLabSession,
  getImport,
  getRecognitionDraft,
  listMetricDefinitions,
} from "@/server/services";

type ImportPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmed?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
  searchParams,
}: ImportPageProps) {
  const importId = Number((await params).id);
  const item = Number.isInteger(importId) ? getImport(importId) : null;

  if (!item) notFound();

  const draft = getRecognitionDraft(item.id);
  const confirmed = getConfirmedLabSession(item.id);
  const metrics =
    draft && item.status === "needs_review" ? listMetricDefinitions() : [];
  const retryAction = retryRecognitionAction.bind(null, item.id);
  const justConfirmed = (await searchParams).confirmed === "1";

  return (
    <main className="form-page wide-page">
      <Link className="back-link" href="/imports">
        ← История загрузок
      </Link>
      <p className="eyebrow">Сессия #{item.id}</p>
      <h1 className="file-title">{item.originalFileName}</h1>

      {justConfirmed ? (
        <p className="notice success">Документ подтверждён и добавлен в историю.</p>
      ) : null}

      <section className="document-layout">
        <div className="content-card document-details">
          <dl>
            <Detail label="Профиль" value={item.profileName} />
            <Detail label="Статус" value={statusLabel(item.status)} />
            <Detail label="Размер" value={formatSize(item.sizeBytes)} />
            <Detail label="Тип" value={item.mediaType} />
            <Detail label="Создана" value={formatDateTime(item.createdAt)} />
            {item.sha256 ? <Detail label="SHA-256" value={item.sha256} mono /> : null}
          </dl>

          {item.duplicateOfImportSessionId ? (
            <p className="duplicate-note">
              Это точная копия файла из сессии{" "}
              <Link href={`/imports/${item.duplicateOfImportSessionId}`}>
                #{item.duplicateOfImportSessionId}
              </Link>
              . Новый оригинал не создавался.
            </p>
          ) : null}

          {item.errorMessage ? (
            <p className="notice error">{item.errorMessage}</p>
          ) : null}

          <div className="document-actions">
            {item.sourceDocumentId ? (
              <a
                className="secondary-button"
                href={`/api/documents/${item.sourceDocumentId}`}
                rel="noreferrer"
                target="_blank"
              >
                Открыть оригинал
              </a>
            ) : null}
            {item.sourceDocumentId &&
            (item.status === "uploaded" || item.status === "failed" || item.status === "needs_review") ? (
              <form action={retryAction}>
                <button className="primary-button" type="submit">
                  {item.status === "needs_review" ? "Распознать заново" : item.status === "failed" ? "Попробовать снова" : "Распознать"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="content-card next-stage-card">
          <p className="status-label">Документ</p>
          <h2>
            {confirmed
              ? "Подтверждён"
              : draft
                ? "Готов к проверке"
                : statusLabel(item.status)}
          </h2>
          <p>{documentHint(item.status, Boolean(draft), Boolean(confirmed))}</p>
        </div>
      </section>

      {confirmed && item.sourceDocumentId ? (
        <section className="review-workspace">
          <DocumentPreview
            extractedText={draft?.extractedText ?? ""}
            mediaType={item.mediaType}
            sourceDocumentId={item.sourceDocumentId}
          />
          <ConfirmedView session={confirmed} />
        </section>
      ) : null}

      {draft && item.status === "needs_review" && item.sourceDocumentId ? (
        <>
          <p className="notice">
            {process.env.OPENAI_API_KEY ? "AI-разбор включён." : "Локальный разбор. Для AI-сопоставления добавьте OPENAI_API_KEY в настройки сервера."}
            {" "}Повторное распознавание заменяет черновик и несохранённые правки.
          </p>
          {draft.warnings.length ? (
            <section className="warning-list">
              {draft.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </section>
          ) : null}
          <section className="review-workspace">
            <DocumentPreview
              extractedText={draft.extractedText}
              mediaType={item.mediaType}
              sourceDocumentId={item.sourceDocumentId}
            />
            <ReviewForm
              key={`${draft.recognitionVersion}-${item.updatedAt}`}
              draft={draft}
              importSessionId={item.id}
              metrics={metrics}
            />
          </section>
          <details className="content-card extracted-text">
            <summary>Извлечённый текст</summary>
            <pre>{draft.extractedText}</pre>
          </details>
        </>
      ) : null}
    </main>
  );
}

function DocumentPreview({
  extractedText,
  mediaType,
  sourceDocumentId,
}: {
  extractedText: string;
  mediaType: string;
  sourceDocumentId: number;
}) {
  return (
    <section className="content-card document-preview-card">
      <div className="preview-heading">
        <div>
          <p className="status-label">Оригинал</p>
          <h2>Документ</h2>
        </div>
        <a
          href={`/api/documents/${sourceDocumentId}`}
          rel="noreferrer"
          target="_blank"
        >
          Открыть отдельно
        </a>
      </div>
      {mediaType === "text/plain" ? (
        <pre className="text-document-preview">{extractedText}</pre>
      ) : (
        <object
          className="document-preview"
          data={`/api/documents/${sourceDocumentId}`}
          type={mediaType}
        >
          <p>
            Предпросмотр недоступен.{" "}
            <a
              href={`/api/documents/${sourceDocumentId}`}
              rel="noreferrer"
              target="_blank"
            >
              Откройте документ отдельно
            </a>
            .
          </p>
        </object>
      )}
    </section>
  );
}

function ConfirmedView({ session }: { session: ConfirmedLabSession }) {
  return (
    <section className="content-card confirmed-card">
      <p className="status-label">Сохранено</p>
      <h2>Результаты анализа</h2>
      <p className="deduplication-summary">{summaryText(session)}</p>
      <dl className="confirmed-metadata">
        <Detail label="Дата забора" value={session.collectedAt} />
        <Detail
          label="Лаборатория"
          value={session.laboratoryName || "Не указана"}
        />
        <Detail label="Материал" value={session.specimen || "Не указан"} />
        <Detail
          label="Подтверждено"
          value={formatDateTime(session.confirmedAt)}
        />
      </dl>
      {session.note ? <p className="session-note">{session.note}</p> : null}
      <div className="confirmed-observations">
        {session.observations.map((observation) => (
          <ConfirmedRow key={observation.id} observation={observation} />
        ))}
      </div>
      <div className="confirmed-sources">
        <h3>Источники · {session.sources.length}</h3>
        {session.sources.map((source) => (
          <article key={source.sourceDocumentId}>
            <a
              href={`/api/documents/${source.sourceDocumentId}`}
              rel="noreferrer"
              target="_blank"
            >
              {source.originalFileName}
            </a>
            <small>
              {[source.specimen, source.note].filter(Boolean).join(" · ") ||
                "Без заметки"}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfirmedRow({ observation }: { observation: ConfirmedObservation }) {
  return (
    <article>
      <div>
        <strong>{observation.displayName}</strong>
        <small>{observation.category}</small>
      </div>
      <div>
        <strong>
          {observation.valueText} {observation.unit}
        </strong>
        <small>
          {[referenceText(observation), observation.specimen]
            .filter(Boolean)
            .join(" · ")}
        </small>
        <small>Источников: {observation.sourceCount}</small>
      </div>
    </article>
  );
}

function summaryText(session: ConfirmedLabSession) {
  const summary = session.summary;
  if (summary.outcome === "created") {
    return `Создан новый анализ. Показателей: ${summary.addedObservations}.`;
  }

  const parts = [
    `совпадений: ${summary.matchedObservations}`,
    `добавлено: ${summary.addedObservations}`,
  ];
  if (summary.resolvedConflicts) {
    parts.push(`конфликтов разрешено: ${summary.resolvedConflicts}`);
  }
  return `Документ объединён с существующим анализом: ${parts.join(", ")}.`;
}

function Detail({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono-value" : undefined}>{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function documentHint(status: string, hasDraft: boolean, confirmed: boolean) {
  if (confirmed) return "Проверенные результаты сохранены отдельно от черновика.";
  if (hasDraft) return "Сверьте поля с оригиналом и подтвердите весь документ.";
  if (status === "extracting") return "Извлекаем текст и ищем показатели.";
  if (status === "failed") return "Исправьте источник проблемы и повторите попытку.";
  return "Документ готов к распознаванию.";
}

function referenceText(observation: {
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
}) {
  if (observation.referenceLow !== null && observation.referenceHigh !== null) {
    return `Референс ${observation.referenceLow}–${observation.referenceHigh}`;
  }
  if (observation.referenceLow !== null) return `От ${observation.referenceLow}`;
  if (observation.referenceHigh !== null) return `До ${observation.referenceHigh}`;
  return observation.referenceText || "Без референса";
}
