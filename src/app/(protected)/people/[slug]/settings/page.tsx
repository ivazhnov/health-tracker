import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePersonProfileAction } from "@/app/profiles/actions";
import { ProfileForm } from "@/app/profiles/profile-form";
import { fullName } from "@/app/format";
import { getProfileBySlug } from "@/server/services";

type SettingsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  const state = await searchParams;

  return (
    <main className="person-page compact-form-page">
      <div className="page-heading">
        <div>
          <h1>Настройки профиля</h1>
          <p>{fullName(profile.firstName, profile.lastName)}</p>
        </div>
        <Link
          className="secondary-button"
          href={`/people/${profile.slug}/measurements/new`}
        >
          Рост и вес
        </Link>
      </div>
      {state.error ? (
        <p className="notice error">Проверьте заполненные поля.</p>
      ) : null}
      {state.saved ? <p className="notice success">Данные сохранены.</p> : null}
      <ProfileForm
        action={updatePersonProfileAction.bind(null, profile.id, profile.slug)}
        cancelHref={`/people/${profile.slug}`}
        profile={profile}
      />
    </main>
  );
}
