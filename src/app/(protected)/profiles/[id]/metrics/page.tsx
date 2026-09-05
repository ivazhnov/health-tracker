import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addFavoriteMetricAction,
  removeFavoriteMetricAction,
} from "@/app/metrics/actions";
import { getProfile, listProfileMetrics } from "@/server/services";

export const dynamic = "force-dynamic";

type MetricsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function MetricsPage({ params, searchParams }: MetricsPageProps) {
  const profileId = Number((await params).id);
  const profile = Number.isInteger(profileId) ? getProfile(profileId) : null;
  if (!profile) notFound();

  const query = (await searchParams).q?.trim() ?? "";
  const metrics = listProfileMetrics(profile.id).filter((metric) =>
    `${metric.displayName} ${metric.category}`.toLocaleLowerCase("ru-RU")
      .includes(query.toLocaleLowerCase("ru-RU")),
  );

  return (
    <main className="form-page wide-page metrics-page">
      <Link className="back-link" href="/">← Профили семьи</Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{fullName(profile.firstName, profile.lastName)}</p>
          <h1>Все показатели</h1>
        </div>
      </div>

      <form className="metric-search" method="get">
        <label className="field">
          <span>Поиск</span>
          <input
            defaultValue={query}
            name="q"
            placeholder="Например, холестерин или почки"
            type="search"
          />
        </label>
        <button className="secondary-button" type="submit">Найти</button>
      </form>

      <section className="content-card metric-catalog">
        {metrics.length ? (
          metrics.map((metric) => {
            const isFavorite = metric.favoriteOrder !== null;
            const action = isFavorite
              ? removeFavoriteMetricAction.bind(null, profile.id, metric.id)
              : addFavoriteMetricAction.bind(null, profile.id, metric.id);
            return (
              <article className="metric-catalog-row" key={metric.id}>
                <Link href={`/profiles/${profile.id}/metrics/${metric.id}`}>
                  <strong>{metric.displayName}</strong>
                  <span>{metric.category} · {countText(metric.observationCount)}</span>
                </Link>
                <div className="metric-latest">
                  <strong>{valueText(metric.latest)}</strong>
                  <span>{formatDate(metric.latest.collectedAt)}</span>
                </div>
                <form action={action}>
                  <button
                    aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
                    className={`favorite-button${isFavorite ? " active" : ""}`}
                    type="submit"
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>
                </form>
              </article>
            );
          })
        ) : (
          <div className="empty-inline">
            <h2>{query ? "Ничего не найдено" : "Показателей пока нет"}</h2>
            <p>{query ? "Попробуйте другой запрос." : "Они появятся после подтверждения первого анализа."}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function valueText(point: { comparator: string | null; valueText: string; unit: string | null }) {
  return `${point.valueText}${point.unit ? ` ${point.unit}` : ""}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function countText(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} измерение`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} измерения`;
  }
  return `${count} измерений`;
}
