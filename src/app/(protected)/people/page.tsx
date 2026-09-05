import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { formatDate, fullName } from "@/app/format";
import { listProfiles } from "@/server/services";

export default function PeoplePage() {
  const people = listProfiles();
  return <main className="standalone-page">
    <header className="global-header">
      <Link className="product-name" href="/">Семейный архив здоровья</Link>
      <form action={logoutAction}><button className="text-button compact" type="submit">Выйти</button></form>
    </header>
    <div className="page-heading"><div><h1>Профили</h1><p>Люди в семейном архиве</p></div>
      {people.length < 2 ? <Link className="primary-button" href="/profiles/new">+ Добавить человека</Link> : null}
    </div>
    <div className="table-surface"><table className="data-table responsive-table"><thead><tr>
      <th>Имя</th><th>Дата рождения</th><th>Последнее измерение</th><th>Действия</th>
    </tr></thead><tbody>{people.map((person) => <tr key={person.id}>
      <td data-label="Имя"><Link className="primary-cell" href={`/people/${person.slug}`}>{fullName(person.firstName, person.lastName)}</Link></td>
      <td data-label="Дата рождения">{formatDate(person.dateOfBirth)}</td>
      <td data-label="Последнее измерение">{person.latestMeasurement ? formatDate(person.latestMeasurement.measuredAt) : "—"}</td>
      <td data-label="Действия"><div className="row-actions"><Link href={`/people/${person.slug}`}>Открыть</Link><Link href={`/people/${person.slug}/settings`}>Изменить</Link></div></td>
    </tr>)}</tbody></table></div>
  </main>;
}
