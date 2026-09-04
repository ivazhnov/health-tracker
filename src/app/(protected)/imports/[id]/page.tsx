import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { retryRecognitionAction } from "@/app/recognition/actions";
import { getImport, getRecognitionDraft } from "@/server/services";

type ImportPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ImportPage({ params }: ImportPageProps) {
  const importId = Number((await params).id);
  const item = Number.isInteger(importId) ? getImport(importId) : null;

  if (!item) {
    notFound();
  }
  const draft = getRecognitionDraft(item.id);
  const retryAction = retryRecognitionAction.bind(null, item.id);

  return (
    <main className="form-page wide-page">
      <Link className="back-link" href="/imports">
        ← История загрузок
      </Link>
      <p className="eyebrow">Сессия #{item.id}</p>
      <h1 className="file-title">{item.originalFileName}</h1>

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
            (item.status === "uploaded" || item.status === "failed") ? (
              <form action={retryAction}>
                <button className="primary-button" type="submit">
                  {item.status === "failed" ? "Попробовать снова" : "Распознать"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="content-card next-stage-card">
          <p className="status-label">Распознавание</p>
          <h2>{draft ? "Черновик готов" : statusLabel(item.status)}</h2>
          <p>{recognitionHint(item.status, Boolean(draft))}</p>
        </div>
      </section>

      {draft ? (
        <>
          <section className="content-card extraction-summary">
            <div>
              <span>Язык</span>
              <strong>{languageLabel(draft.detectedLanguage)}</strong>
            </div>
            <div>
              <span>Лаборатория</span>
              <strong>{draft.laboratoryName || "Не определена"}</strong>
            </div>
            <div>
              <span>Дата забора</span>
              <strong>{draft.collectedAt || "Не определена"}</strong>
            </div>
            <div>
              <span>Материал</span>
              <strong>{draft.specimen || "Не определён"}</strong>
            </div>
          </section>

          {draft.warnings.length ? (
            <section className="warning-list">
              {draft.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </section>
          ) : null}

          <section className="content-card draft-card">
            <div className="recent-imports-heading">
              <h2>Найденные показатели</h2>
              <span>{draft.observations.length}</span>
            </div>
            {draft.observations.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Показатель</th>
                      <th>Значение</th>
                      <th>Референс</th>
                      <th>Уверенность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.observations.map((observation, index) => (
                      <tr key={`${observation.sourceText}-${index}`}>
                        <td>
                          <strong>
                            {observation.displayName || observation.originalName}
                          </strong>
                          <small>
                            {observation.category || "Не сопоставлен с каталогом"}
                          </small>
                        </td>
                        <td>
                          {observation.valueText} {observation.unit}
                        </td>
                        <td>{referenceText(observation)}</td>
                        <td>{Math.round(observation.confidence * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted-copy">Автоматически найти показатели не удалось.</p>
            )}
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

function recognitionHint(status: string, hasDraft: boolean) {
  if (hasDraft) {
    return "Проверьте найденные данные. На следующем этапе их можно будет исправить и подтвердить.";
  }
  if (status === "extracting") return "Извлекаем текст и ищем показатели.";
  if (status === "failed") return "Исправьте источник проблемы и повторите попытку.";
  return "Документ готов к распознаванию.";
}

function languageLabel(language: string) {
  const labels: Record<string, string> = {
    ru: "Русский",
    en: "Английский",
    fr: "Французский",
    de: "Немецкий",
    it: "Итальянский",
    unknown: "Не определён",
  };
  return labels[language] ?? language;
}

function referenceText(observation: {
  referenceLow: string | null;
  referenceHigh: string | null;
  referenceText: string | null;
}) {
  if (observation.referenceLow && observation.referenceHigh) {
    return `${observation.referenceLow}–${observation.referenceHigh}`;
  }
  return observation.referenceText || "—";
}
