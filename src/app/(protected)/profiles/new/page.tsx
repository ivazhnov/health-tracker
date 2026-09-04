import { createProfileAction } from "@/app/profiles/actions";
import { ProfileForm } from "@/app/profiles/profile-form";
import { listProfiles } from "@/server/services";
import { redirect } from "next/navigation";

type NewProfileProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewProfile({ searchParams }: NewProfileProps) {
  if (listProfiles().length >= 2) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="form-page">
      <p className="eyebrow">Новый профиль</p>
      <h1>Добавить человека</h1>
      <p className="lead small">
        Эти данные помогут правильно связать анализы и референсы.
      </p>
      {error ? (
        <p className="notice error">Проверьте заполненные поля.</p>
      ) : null}
      <ProfileForm action={createProfileAction} />
    </main>
  );
}
