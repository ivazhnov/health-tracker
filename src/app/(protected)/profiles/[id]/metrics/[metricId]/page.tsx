import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricChart } from "@/app/metrics/metric-chart";
import { getMetricHistory, getProfile } from "@/server/services";

export const dynamic = "force-dynamic";

type MetricPageProps = {
  params: Promise<{ id: string; metricId: string }>;
};

export default async function MetricPage({ params }: MetricPageProps) {
  const values = await params;
  const profileId = Number(values.id);
  const metricId = Number(values.metricId);
  const profile = Number.isInteger(profileId) ? getProfile(profileId) : null;
  const history =
    profile && Number.isInteger(metricId)
      ? getMetricHistory(profileId, metricId)
      : null;
  if (!profile || !history) notFound();

  return (
    <main className="form-page wide-page metric-history-page">
      <Link className="back-link" href={`/profiles/${profile.id}/metrics`}>
        ← Все показатели
      </Link>
      <p className="eyebrow">{fullName(profile.firstName, profile.lastName)} · {history.metric.category}</p>
      <h1>{history.metric.displayName}</h1>

      <section className="content-card history-chart-card">
        <div className="section-heading compact">
          <div>
            <p className="status-label">Динамика</p>
            <h2>{countText(history.observations.length)}</h2>
          </div>
          <p className="chart-legend"><span /> Лабораторный референс</p>
        </div>
        <MetricChart points={history.observations} />
      </section>

      <section className="content-card history-list-card">
        <h2>История</h2>
        <div className="history-list">
          {[...history.observations].reverse().map((observation) => (
            <article className="history-row" key={observation.observationId}>
              <div className="history-date">
                <strong>{formatDate(observation.collectedAt)}</strong>
                <span>{observation.laboratoryName || "Лаборатория не указана"}</span>
              </div>
              <div className="history-value">
                <strong>{valueText(observation)}</strong>
                <span>{referenceText(observation)}</span>
                {observation.specimen ? <span>{observation.specimen}</span> : null}
              </div>
              <div className="history-context">
                <div className="source-links">
                  {observation.sources.map((source) => (
                    <div key={source.documentId}>
                    <a
                      href={`/api/documents/${source.documentId}`}
                      key={source.documentId}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.fileName}
                    </a>
                    {source.note ? <p>{source.note}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function valueText(value: { comparator: string | null; valueText: string; unit: string | null }) {
  return `${value.valueText}${value.unit ? ` ${value.unit}` : ""}`;
}

function referenceText(value: {
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
}) {
  if (value.referenceText) return `Референс: ${value.referenceText}`;
  if (value.referenceLow !== null && value.referenceHigh !== null) {
    return `Референс: ${value.referenceLow}–${value.referenceHigh}`;
  }
  if (value.referenceLow !== null) return `Референс: от ${value.referenceLow}`;
  if (value.referenceHigh !== null) return `Референс: до ${value.referenceHigh}`;
  return "Референс не указан";
}

function countText(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} измерение`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} измерения`;
  }
  return `${count} измерений`;
}
