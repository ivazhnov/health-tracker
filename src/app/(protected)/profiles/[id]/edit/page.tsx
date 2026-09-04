import { notFound } from "next/navigation";
import { updateProfileAction } from "@/app/profiles/actions";
import { ProfileForm } from "@/app/profiles/profile-form";
import { getProfile } from "@/server/services";

type EditProfileProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditProfile({
  params,
  searchParams,
}: EditProfileProps) {
  const profileId = Number((await params).id);
  const profile = Number.isInteger(profileId) ? getProfile(profileId) : null;

  if (!profile) {
    notFound();
  }

  const { error } = await searchParams;

  return (
    <main className="form-page">
      <p className="eyebrow">Профиль</p>
      <h1>Изменить данные</h1>
      <p className="lead small">
        Основные сведения и новое измерение роста или веса.
      </p>
      {error ? (
        <p className="notice error">Проверьте заполненные поля.</p>
      ) : null}
      <ProfileForm
        action={updateProfileAction.bind(null, profile.id)}
        profile={profile}
      />

      {profile.measurements.length > 0 ? (
        <section className="measurement-history">
          <h2>История измерений</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Рост</th>
                  <th>Вес</th>
                </tr>
              </thead>
              <tbody>
                {profile.measurements.map((measurement) => (
                  <tr key={measurement.id}>
                    <td>{measurement.measuredAt}</td>
                    <td>
                      {measurement.heightCm
                        ? `${measurement.heightCm} см`
                        : "—"}
                    </td>
                    <td>
                      {measurement.weightKg
                        ? `${measurement.weightKg} кг`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
