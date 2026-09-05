import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/app/confirmation/review-form";
import { formatDate, formatDateTime, metricValue, referenceStatus, referenceText } from "@/app/format";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { retryRecognitionAction } from "@/app/recognition/actions";
import type { ConfirmedLabSession } from "@/server/confirmation";
import { getConfirmedLabSession, getImport, getRecognitionDraft, listMetricDefinitions } from "@/server/services";

export async function AnalysisDetail({ importId, personSlug, justConfirmed }: { importId: number; personSlug: string; justConfirmed: boolean }) {
  const item = getImport(importId);
  if (!item) notFound();
  const draft = getRecognitionDraft(item.id);
  const confirmed = getConfirmedLabSession(item.id);
  const metrics = draft && item.status === "needs_review" ? listMetricDefinitions() : [];
  const retryAction = retryRecognitionAction.bind(null, item.id);
  return <main className="person-page analysis-page">
    <Link className="back-link compact" href={`/people/${personSlug}/analyses`}>← Анализы</Link>
    <div className="page-heading analysis-heading"><div><h1>{item.collectedAt ? `Анализ от ${formatDate(item.collectedAt)}` : item.originalFileName}</h1>
      <p>{[item.laboratoryName, item.originalFileName].filter(Boolean).join(" · ")}</p></div>
      <div className="row-actions">{item.sourceDocumentId ? <a className="secondary-button compact-button" href={`/api/documents/${item.sourceDocumentId}`} target="_blank" rel="noreferrer">Открыть оригинал ↗</a> : null}
        {item.sourceDocumentId && item.status !== "confirmed" ? <form action={retryAction}><button className="secondary-button compact-button" type="submit">Распознать заново</button></form> : null}</div></div>
    <div className="analysis-meta"><span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span><span>{formatSize(item.sizeBytes)}</span><span>Загружено {formatDateTime(item.createdAt)}</span></div>
    {justConfirmed ? <p className="notice success">Документ подтверждён и добавлен в историю.</p> : null}
    {item.errorMessage ? <p className="notice error">{item.errorMessage}</p> : null}
    {draft?.warnings.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}

    {confirmed ? <ConfirmedResults session={confirmed} /> : null}
    {draft && item.status === "needs_review" && item.sourceDocumentId ? <>
      <div className="review-status"><div><strong>Нужна проверка</strong><span>Сверьте распознанные данные с оригиналом.</span></div><span>{draft.observations.length} показателей</span></div>
      <section className="review-workspace compact-review">
        <DocumentPreview extractedText={draft.extractedText} mediaType={item.mediaType} sourceDocumentId={item.sourceDocumentId} />
        <ReviewForm key={`${draft.recognitionVersion}-${item.updatedAt}`} draft={draft} importSessionId={item.id} metrics={metrics} returnTo={`/people/${personSlug}/analyses/${item.id}`} />
      </section>
      <details className="table-surface extracted-text"><summary>Извлечённый текст</summary><pre>{draft.extractedText}</pre></details>
    </> : null}
  </main>;
}

function ConfirmedResults({ session }: { session: ConfirmedLabSession }) {
  return <section className="data-section"><div className="section-header"><h2>Результаты</h2><span>{session.observations.length} показателей</span></div>
    <div className="table-surface"><table className="data-table responsive-table numeric-table"><thead><tr><th>Показатель</th><th>Результат</th><th>Референс</th><th>Статус</th><th>Материал</th></tr></thead>
      <tbody>{session.observations.map((item) => {
        const status = referenceStatus(item);
        const kind = status === "В референсе" ? "success" : status === "Нет референса" ? "neutral" : "warning";
        return <tr key={item.id}><td data-label="Показатель"><strong>{item.displayName}</strong><small>{item.originalName}</small></td><td data-label="Результат">{metricValue(item)}</td><td data-label="Референс">{referenceText(item)}</td><td data-label="Статус"><span className={`status-badge ${kind}`}>{status}</span></td><td data-label="Материал">{item.specimen || "—"}</td></tr>;
      })}</tbody></table></div>
    {session.note ? <p className="analysis-note">{session.note}</p> : null}
    <div className="source-row"><strong>Источники</strong>{session.sources.map((source) => <a key={source.sourceDocumentId} href={`/api/documents/${source.sourceDocumentId}`} target="_blank" rel="noreferrer">{source.originalFileName} ↗</a>)}</div>
  </section>;
}

function DocumentPreview({ extractedText, mediaType, sourceDocumentId }: { extractedText: string; mediaType: string; sourceDocumentId: number }) {
  return <section className="document-preview-panel"><div className="section-header"><h2>Оригинал</h2><a href={`/api/documents/${sourceDocumentId}`} target="_blank" rel="noreferrer">Открыть ↗</a></div>
    {mediaType === "text/plain" ? <pre className="text-document-preview">{extractedText}</pre> : <object className="document-preview" data={`/api/documents/${sourceDocumentId}`} type={mediaType}><p>Предпросмотр недоступен.</p></object>}
  </section>;
}
