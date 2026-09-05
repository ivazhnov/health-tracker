import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { listProfiles } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function Home() {
  const people = listProfiles();
  if (people.length) {
    const activeId = Number((await cookies()).get("active_profile_id")?.value);
    const person = people.find(({ id }) => id === activeId) ?? people[0];
    redirect(`/people/${person.slug}`);
  }
  return <main className="empty-root">
    <header className="global-header">
      <strong className="product-name">Семейный архив здоровья</strong>
      <form action={logoutAction}><button className="text-button compact" type="submit">Выйти</button></form>
    </header>
    <section className="compact-empty">
      <h1>Пока нет профилей</h1>
      <p>Добавьте человека, чтобы начать сохранять анализы и показатели.</p>
      <Link className="primary-button" href="/profiles/new">Добавить человека</Link>
    </section>
  </main>;
}
