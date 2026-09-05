import { createProfileAction } from "@/app/profiles/actions";
import { ProfileForm } from "@/app/profiles/profile-form";
import { listProfiles } from "@/server/services";
import Link from "next/link";
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
    <main className="standalone-page compact-form-page">
      <header className="global-header">
        <Link className="product-name" href="/">Семейный архив здоровья</Link>
      </header>
      <div className="page-heading">
        <div>
          <h1>Добавить человека</h1>
          <p>Данные нужны для привязки анализов и возрастных референсов.</p>
        </div>
      </div>
      {error ? (
        <p className="notice error">Проверьте заполненные поля.</p>
      ) : null}
      <ProfileForm action={createProfileAction} cancelHref="/people" />
    </main>
  );
}
