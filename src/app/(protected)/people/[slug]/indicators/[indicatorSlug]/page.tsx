import Link from "next/link";
import { notFound } from "next/navigation";
import { countText, formatDate, metricValue, referenceStatus, referenceText, trendText } from "@/app/format";
import { addFavoriteMetricAction, removeFavoriteMetricAction } from "@/app/metrics/actions";
import { MetricChart } from "@/app/metrics/metric-chart";
import { getMetricHistory, getProfileBySlug, listProfileMetrics } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function IndicatorPage({ params }: { params: Promise<{ slug: string; indicatorSlug: string }> }) {
  const values = await params;
  const profile = getProfileBySlug(values.slug);
  const profileMetric = profile ? listProfileMetrics(profile.id).find((item) => item.key === values.indicatorSlug) : null;
  const history = profileMetric ? getMetricHistory(profile!.id, profileMetric.id) : null;
  if (!profile || !profileMetric || !history) notFound();
  const latest = history.observations.at(-1)!;
  const favourite = profileMetric.favoriteOrder !== null;
  const action = favourite ? removeFavoriteMetricAction.bind(null, profile.id, profileMetric.id) : addFavoriteMetricAction.bind(null, profile.id, profileMetric.id);
  return <main className="person-page indicator-detail-page">
    <Link className="back-link compact" href={`/people/${profile.slug}/indicators`}>← Показатели</Link>
    <div className="page-heading"><div><h1>{history.metric.displayName}</h1><p>{history.metric.category}</p></div>
      <form action={action}><button className={`secondary-button compact-button${favourite ? " selected" : ""}`} type="submit">{favourite ? "★ В избранном" : "☆ В избранное"}</button></form></div>
    <section className="indicator-summary"><span>Последний результат</span><strong>{metricValue(latest)}</strong><p>Референс {referenceText(latest)} · {referenceStatus(latest)} · {formatDate(latest.collectedAt)}</p></section>
    <section className="chart-section"><div className="section-header"><h2>Динамика</h2><span>{countText(history.observations.length, ["измерение", "измерения", "измерений"])}</span></div><MetricChart points={history.observations} /></section>
    <section className="data-section"><div className="section-header"><h2>История</h2></div>
      <div className="table-surface"><table className="data-table responsive-table numeric-table"><thead><tr><th>Дата</th><th>Результат</th><th>Референс</th><th>Статус</th><th>Изменение</th><th>Лаборатория</th><th>Источник</th></tr></thead>
        <tbody>{[...history.observations].reverse().map((item, reverseIndex) => {
          const chronologicalIndex = history.observations.length - 1 - reverseIndex;
          return <tr key={item.observationId}><td data-label="Дата">{formatDate(item.collectedAt)}</td><td data-label="Результат">{metricValue(item)}</td><td data-label="Референс">{referenceText(item)}</td><td data-label="Статус"><Status text={referenceStatus(item)} /></td><td data-label="Изменение">{trendText(history.observations.slice(0, chronologicalIndex + 1))}</td><td data-label="Лаборатория">{item.laboratoryName || "—"}</td><td data-label="Источник"><div className="source-links">{item.sources.map((source) => <a key={source.documentId} href={`/api/documents/${source.documentId}`} target="_blank" rel="noreferrer">{source.fileName} ↗</a>)}</div></td></tr>;
        })}</tbody></table></div>
    </section>
  </main>;
}

function Status({ text }: { text: string }) {
  const kind = text === "В референсе" ? "success" : text === "Нет референса" ? "neutral" : "warning";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}
