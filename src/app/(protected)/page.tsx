import Link from "next/link";
import { cookies } from "next/headers";
import { logoutAction, selectProfileAction } from "@/app/actions";
import { ImportList } from "@/app/imports/import-list";
import { moveFavoriteMetricAction } from "@/app/metrics/actions";
import { MetricChart } from "@/app/metrics/metric-chart";
import {
  getApplicationStatus,
  getProfileArchiveStats,
  listImports,
  listProfileMetrics,
  listProfiles,
} from "@/server/services";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const profiles = listProfiles();
  const cookieStore = await cookies();
  const activeId = Number(cookieStore.get("active_profile_id")?.value);
  const activeProfile =
    profiles.find(({ id }) => id === activeId) ?? profiles[0] ?? null;
  const recentImports = activeProfile
    ? listImports(activeProfile.id).slice(0, 5)
    : [];
  const activeMetrics = activeProfile
    ? listProfileMetrics(activeProfile.id)
    : [];
  const favoriteMetrics = activeMetrics
    .filter((metric) => metric.favoriteOrder !== null)
    .sort((first, second) => first.favoriteOrder! - second.favoriteOrder!);
  const archiveStats = activeProfile
    ? getProfileArchiveStats(activeProfile.id)
    : null;
  const status = getApplicationStatus();
  const { error, saved } = await searchParams;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Семейный архив здоровья</p>
          <h1>Профили семьи</h1>
        </div>
        <form action={logoutAction}>
          <button className="text-button" type="submit">
            Выйти
          </button>
        </form>
      </header>

      {saved ? <p className="notice success">Изменения сохранены</p> : null}
      {error === "profile_limit" ? (
        <p className="notice error">В первой версии можно создать два профиля.</p>
      ) : null}

      {profiles.length === 0 ? (
        <section className="empty-card">
          <h2>Добавьте первый профиль</h2>
          <p>
            Укажите основные данные человека. Документы и показатели добавим
            на следующих этапах.
          </p>
          <Link className="primary-button" href="/profiles/new">
            Добавить человека
          </Link>
        </section>
      ) : (
        <>
          <section className="profile-grid" aria-label="Профили">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfile?.id;

              return (
                <article
                  className={`profile-card${isActive ? " active" : ""}`}
                  key={profile.id}
                >
                  <div className="profile-card-header">
                    <div className="avatar" aria-hidden="true">
                      {profile.firstName.slice(0, 1).toUpperCase()}
                    </div>
                    {isActive ? <span className="badge">Выбран</span> : null}
                  </div>
                  <h2>{fullName(profile.firstName, profile.lastName)}</h2>
                  <p className="profile-meta">
                    {formatDate(profile.dateOfBirth)} · {age(profile.dateOfBirth)}
                  </p>
                  <p className="profile-measurement">
                    {measurementText(profile.latestMeasurement)}
                  </p>
                  <div className="profile-actions">
                    {!isActive ? (
                      <form action={selectProfileAction}>
                        <input name="profileId" type="hidden" value={profile.id} />
                        <button className="secondary-button" type="submit">
                          Выбрать
                        </button>
                      </form>
                    ) : null}
                    <Link
                      className="secondary-button"
                      href={`/profiles/${profile.id}/edit`}
                    >
                      Изменить
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          {profiles.length < 2 ? (
            <Link className="add-link" href="/profiles/new">
              + Добавить второй профиль
            </Link>
          ) : null}

          {activeProfile ? (
            <section className="selected-summary">
              <div className="section-heading compact">
                <div>
                  <p className="status-label">Активный профиль</p>
                  <h2>
                    {fullName(activeProfile.firstName, activeProfile.lastName)}
                  </h2>
                </div>
                <Link className="primary-button" href="/imports/new">
                  Загрузить анализы
                </Link>
              </div>
              {archiveStats ? (
                <div className="archive-stats" aria-label="Статистика архива">
                  <ArchiveStat
                    label="Анализов"
                    value={archiveStats.labSessionCount}
                  />
                  <ArchiveStat
                    label="Измерений"
                    value={archiveStats.observationCount}
                  />
                  <ArchiveStat
                    label="Документов"
                    value={archiveStats.documentCount}
                  />
                </div>
              ) : null}
              <div className="recent-imports-heading favorites-heading">
                <h3>Избранные показатели</h3>
                <Link href={`/profiles/${activeProfile.id}/metrics`}>
                  Все показатели
                </Link>
              </div>
              {favoriteMetrics.length ? (
                <div className="favorite-grid">
                  {favoriteMetrics.map((metric, index) => (
                    <article className="favorite-card" key={metric.id}>
                      <div className="favorite-card-heading">
                        <div>
                          <span>{metric.category}</span>
                          <Link
                            href={`/profiles/${activeProfile.id}/metrics/${metric.id}`}
                          >
                            {metric.displayName}
                          </Link>
                        </div>
                        <div
                          className="favorite-order"
                          aria-label="Порядок избранного"
                        >
                          <form
                            action={moveFavoriteMetricAction.bind(
                              null,
                              activeProfile.id,
                              metric.id,
                              "up",
                            )}
                          >
                            <button
                              disabled={index === 0}
                              title="Выше"
                              type="submit"
                            >
                              ↑
                            </button>
                          </form>
                          <form
                            action={moveFavoriteMetricAction.bind(
                              null,
                              activeProfile.id,
                              metric.id,
                              "down",
                            )}
                          >
                            <button
                              disabled={index === favoriteMetrics.length - 1}
                              title="Ниже"
                              type="submit"
                            >
                              ↓
                            </button>
                          </form>
                        </div>
                      </div>
                      <div className="favorite-value">
                        <strong>{metricValue(metric.latest)}</strong>
                        <span>
                          {formatShortDate(metric.latest.collectedAt)} ·{" "}
                          {metricReference(metric.latest)}
                        </span>
                      </div>
                      <MetricChart compact points={metric.points} />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-favorites">
                  <p>
                    Добавьте важные показатели — их последние значения и
                    динамика появятся здесь.
                  </p>
                  <Link
                    className="secondary-button"
                    href={`/profiles/${activeProfile.id}/metrics`}
                  >
                    Выбрать показатели
                  </Link>
                </div>
              )}
              <div className="recent-imports-heading">
                <h3>Последние загрузки</h3>
                <Link href="/imports">Вся история</Link>
              </div>
              <ImportList imports={recentImports} />
            </section>
          ) : null}
        </>
      )}

      <footer className="app-footer">
        SQLite · схема {status.schemaVersion} · хранилище{" "}
        {status.installationId.slice(0, 8)}
      </footer>
    </main>
  );
}

function ArchiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function metricValue(value: {
  comparator: string | null;
  valueText: string;
  unit: string | null;
}) {
  return `${value.valueText}${value.unit ? ` ${value.unit}` : ""}`;
}

function metricReference(value: {
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
}) {
  if (value.referenceText) return `референс ${value.referenceText}`;
  if (value.referenceLow !== null && value.referenceHigh !== null) {
    return `референс ${value.referenceLow}–${value.referenceHigh}`;
  }
  if (value.referenceHigh !== null) return `референс до ${value.referenceHigh}`;
  if (value.referenceLow !== null) return `референс от ${value.referenceLow}`;
  return "без референса";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function age(dateOfBirth: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassed =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() &&
      now.getUTCDate() >= birth.getUTCDate());

  if (!birthdayPassed) years -= 1;
  return `${years} ${yearWord(years)}`;
}

function yearWord(years: number) {
  if (years % 10 === 1 && years % 100 !== 11) return "год";
  if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100)) {
    return "года";
  }
  return "лет";
}

function measurementText(
  measurement: { heightCm: number | null; weightKg: number | null } | null,
) {
  if (!measurement) return "Рост и вес пока не указаны";

  return [
    measurement.heightCm ? `${measurement.heightCm} см` : null,
    measurement.weightKg ? `${measurement.weightKg} кг` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
