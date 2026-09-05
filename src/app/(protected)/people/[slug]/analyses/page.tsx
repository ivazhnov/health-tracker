import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/app/format";
import { formatSize, statusLabel } from "@/app/imports/import-list";
import { getProfileBySlug, listImports } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function AnalysesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ failed?: string; uploaded?: string }> }) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  const imports = listImports(profile.id);
  const { failed, uploaded } = await searchParams;
  return <main className="person-page">
    <div className="page-heading"><div><h1>Анализы</h1><p>Документы и результаты {profile.firstName}</p></div></div>
    {uploaded !== undefined || failed !== undefined ? <p className={`notice ${Number(failed) ? "error" : "success"}`}>Загружено: {Number(uploaded) || 0}. С ошибкой: {Number(failed) || 0}.</p> : null}
    {imports.length ? <div className="table-surface"><table className="data-table responsive-table"><thead><tr>
      <th>Дата</th><th>Лаборатория</th><th>Документ</th><th>Показателей</th><th>Статус</th><th>Загружено</th>
    </tr></thead><tbody>{imports.map((item) => <tr key={item.id}>
      <td data-label="Дата">{item.collectedAt ? formatDate(item.collectedAt) : "—"}</td>
      <td data-label="Лаборатория">{item.laboratoryName || "—"}</td>
      <td data-label="Документ"><Link className="primary-cell" href={`/people/${profile.slug}/analyses/${item.id}`}>{item.originalFileName}</Link><small>{formatSize(item.sizeBytes)}</small></td>
      <td data-label="Показателей">{item.observationCount || "—"}</td>
      <td data-label="Статус"><span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span></td>
      <td data-label="Загружено">{formatDateTime(item.createdAt)}</td>
    </tr>)}</tbody></table></div> : <div className="compact-empty inline"><h2>Анализов пока нет</h2><p>Загрузите первый лабораторный отчёт.</p><Link className="primary-button" href={`/people/${profile.slug}/upload`}>Загрузить анализы</Link></div>}
  </main>;
}
