import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatNumber, fullName } from "@/app/format";
import { addBodyMeasurementAction } from "@/app/profiles/actions";
import { getProfileBySlug } from "@/server/services";

type MeasurementPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function MeasurementPage({
  params,
  searchParams,
}: MeasurementPageProps) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  const state = await searchParams;

  return (
    <main className="person-page compact-form-page">
      <div className="page-heading">
        <div>
          <h1>Рост и вес</h1>
          <p>{fullName(profile.firstName, profile.lastName)}</p>
        </div>
      </div>
      {state.error ? (
        <p className="notice error">Укажите дату и хотя бы одно значение.</p>
      ) : null}
      {state.saved ? <p className="notice success">Измерение сохранено.</p> : null}
      <form
        action={addBodyMeasurementAction.bind(null, profile.id, profile.slug)}
        className="profile-form"
      >
        <div className="form-grid three-columns">
          <label className="field">
            <span>Дата измерения</span>
            <input defaultValue={today()} max={today()} name="measuredAt" required type="date" />
          </label>
          <label className="field">
            <span>Рост, см</span>
            <input inputMode="decimal" min="0.1" name="heightCm" step="0.1" type="number" />
          </label>
          <label className="field">
            <span>Вес, кг</span>
            <input inputMode="decimal" min="0.1" name="weightKg" step="0.1" type="number" />
          </label>
        </div>
        <div className="form-actions">
          <Link className="secondary-button" href={`/people/${profile.slug}/settings`}>Назад</Link>
          <button className="primary-button" type="submit">Сохранить измерение</button>
        </div>
      </form>

      <section className="page-section">
        <div className="section-heading compact">
          <h2>История</h2>
          <span className="muted">{profile.measurements.length}</span>
        </div>
        {profile.measurements.length ? (
          <div className="table-surface">
            <table className="data-table responsive-table">
              <thead><tr><th>Дата</th><th>Рост</th><th>Вес</th></tr></thead>
              <tbody>
                {profile.measurements.map((measurement) => (
                  <tr key={measurement.id}>
                    <td data-label="Дата">{formatDate(measurement.measuredAt)}</td>
                    <td data-label="Рост">{measurement.heightCm === null ? "—" : `${formatNumber(measurement.heightCm)} см`}</td>
                    <td data-label="Вес">{measurement.weightKg === null ? "—" : `${formatNumber(measurement.weightKg)} кг`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-row">Измерений пока нет.</p>}
      </section>
    </main>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
