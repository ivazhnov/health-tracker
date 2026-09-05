"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction, switchPersonAction } from "@/app/actions";
import { fullName } from "@/app/format";
import type { Profile } from "@/server/profiles";

export function PersonShell({ active, people, children }: {
  active: Profile;
  people: Profile[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const suffix = pathname.match(/^\/people\/[^/]+(\/[^/]+)?/)?.[1] ?? "";
  const switchAction = switchPersonAction.bind(null, suffix);
  const root = `/people/${active.slug}`;

  return <div className="person-app">
    <header className="global-header">
      <Link className="product-name" href={root}>Семейный архив здоровья</Link>
      <div className="global-actions">
        <form action={switchAction}>
          <label className="person-switcher">
            <span className="sr-only">Выбрать человека</span>
            <select name="personSlug" value={active.slug} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
              {people.map((person) => <option key={person.id} value={person.slug}>{fullName(person.firstName, person.lastName)}</option>)}
            </select>
          </label>
        </form>
        <Link className="icon-button" aria-label="Управление профилями" href="/people">⚙</Link>
        <form action={logoutAction}><button className="text-button compact" type="submit">Выйти</button></form>
      </div>
    </header>
    <nav className="person-nav" aria-label="Разделы человека">
      <div className="person-tabs">
        <NavLink href={root} active={pathname === root}>Обзор</NavLink>
        <NavLink href={`${root}/analyses`} active={pathname.startsWith(`${root}/analyses`)}>Анализы</NavLink>
        <NavLink href={`${root}/indicators`} active={pathname.startsWith(`${root}/indicators`)}>Показатели</NavLink>
      </div>
      <div className="person-nav-actions">
        <Link className="primary-button compact-button" href={`${root}/upload`}>+ Загрузить анализы</Link>
        <details className="overflow-menu"><summary aria-label="Действия с профилем">⋯</summary>
          <div><Link href={`${root}/settings`}>Изменить профиль</Link><Link href={`${root}/measurements/new`}>Добавить измерение</Link></div>
        </details>
      </div>
    </nav>
    {children}
  </div>;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={href}>{children}</Link>;
}
