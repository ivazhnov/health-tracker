import Link from "next/link";
import { notFound } from "next/navigation";
import { ageText, countText, formatDate, fullName, measurementText, metricValue, referenceStatus, referenceText, trendText } from "@/app/format";
import { statusLabel } from "@/app/imports/import-list";
import { getProfileArchiveStats, getProfileBySlug, listImports, listProfileMetrics } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function PersonOverview({ params }: { params: Promise<{ slug: string }> }) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  const metrics = listProfileMetrics(profile.id);
  const favourites = metrics.filter((item) => item.favoriteOrder !== null).sort((a, b) => a.favoriteOrder! - b.favoriteOrder!);
  const analyses = listImports(profile.id).slice(0, 5);
  const stats = getProfileArchiveStats(profile.id);
  const root = `/people/${profile.slug}`;
  return <main className="person-page">
    <header className="person-summary"><div><h1>{fullName(profile.firstName, profile.lastName)}</h1>
      <p>{[ageText(profile.dateOfBirth), measurementText(profile.latestMeasurement)].filter(Boolean).join(" · ")}</p>
      <small>{countText(stats.labSessionCount, ["анализ", "анализа", "анализов"])} · {countText(stats.observationCount, ["показатель", "показателя", "показателей"])} · {countText(stats.documentCount, ["документ", "документа", "документов"])}</small></div></header>

    <section className="data-section"><div className="section-header"><h2>Избранные показатели</h2><Link href={`${root}/indicators`}>Все показатели →</Link></div>
      {favourites.length ? <div className="table-surface"><table className="data-table responsive-table numeric-table"><thead><tr>
        <th>Показатель</th><th>Последний результат</th><th>Референс</th><th>Статус</th><th>Изменение</th><th>Дата</th>
      </tr></thead><tbody>{favourites.map((metric) => <tr key={metric.id}>
        <td data-label="Показатель"><Link className="primary-cell" href={`${root}/indicators/${metric.key}`}>{metric.displayName}</Link><small>{metric.category}</small></td>
        <td data-label="Результат">{metricValue(metric.latest)}</td><td data-label="Референс">{referenceText(metric.latest)}</td>
        <td data-label="Статус"><Status text={referenceStatus(metric.latest)} /></td><td data-label="Изменение">{trendText(metric.points)}</td><td data-label="Дата">{formatDate(metric.latest.collectedAt)}</td>
      </tr>)}</tbody></table></div> : <div className="compact-empty inline"><h3>Избранных показателей пока нет</h3><p>Добавьте ★ у нужных показателей, чтобы видеть их здесь.</p><Link className="secondary-button" href={`${root}/indicators`}>Выбрать показатели</Link></div>}
    </section>

    <section className="data-section"><div className="section-header"><h2>Последние анализы</h2><Link href={`${root}/analyses`}>Все анализы →</Link></div>
      {analyses.length ? <div className="table-surface"><table className="data-table responsive-table"><thead><tr>
        <th>Дата</th><th>Лаборатория</th><th>Документ</th><th>Показателей</th><th>Статус</th>
      </tr></thead><tbody>{analyses.map((item) => <tr key={item.id}>
        <td data-label="Дата">{item.collectedAt ? formatDate(item.collectedAt) : "—"}</td><td data-label="Лаборатория">{item.laboratoryName || "—"}</td>
        <td data-label="Документ"><Link className="primary-cell" href={`${root}/analyses/${item.id}`}>{item.originalFileName}</Link></td><td data-label="Показателей">{item.observationCount || "—"}</td><td data-label="Статус"><span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span></td>
      </tr>)}</tbody></table></div> : <div className="compact-empty inline"><h3>Анализов пока нет</h3><p>Загрузите первый лабораторный отчёт.</p><Link className="primary-button" href={`${root}/upload`}>Загрузить анализы</Link></div>}
    </section>
  </main>;
}

function Status({ text }: { text: string }) {
  const kind = text === "В референсе" ? "success" : text === "Нет референса" ? "neutral" : "warning";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}
