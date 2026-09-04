import Link from "next/link";
import { cookies } from "next/headers";
import { logoutAction, selectProfileAction } from "@/app/actions";
import { getApplicationStatus, listProfiles } from "@/server/services";

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
              <p className="status-label">Активный профиль</p>
              <h2>{fullName(activeProfile.firstName, activeProfile.lastName)}</h2>
              <p>
                На следующем этапе сюда добавится загрузка лабораторных
                документов.
              </p>
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
