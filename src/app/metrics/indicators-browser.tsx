"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addFavoriteMetricAction, removeFavoriteMetricAction } from "@/app/metrics/actions";
import { countText, formatDate, metricValue, referenceStatus, referenceText, trendText } from "@/app/format";
import type { ProfileMetric } from "@/server/metric-history";

export function IndicatorsBrowser({ profileId, personSlug, metrics }: { profileId: number; personSlug: string; metrics: ProfileMetric[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const categories = [...new Set(metrics.map((metric) => metric.category))].sort((a, b) => a.localeCompare(b, "ru"));
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = metrics.filter((metric) =>
    (!needle || `${metric.displayName} ${metric.category} ${metric.searchTerms}`.toLocaleLowerCase("ru-RU").includes(needle)) &&
    (category === "all" || metric.category === category) &&
    (!favouritesOnly || metric.favoriteOrder !== null));
  const grouped = new Map<string, ProfileMetric[]>();
  for (const metric of filtered) {
    grouped.set(metric.category, [...(grouped.get(metric.category) ?? []), metric]);
  }
  const groups = [...grouped].sort(([a], [b]) => a.localeCompare(b, "ru"));

  return <>
    <div className="indicator-toolbar">
      <label className="search-field"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск показателей…" aria-label="Поиск показателей" /></label>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Группа показателей"><option value="all">Все группы</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <label className="filter-toggle"><input type="checkbox" checked={favouritesOnly} onChange={(event) => setFavouritesOnly(event.target.checked)} /> ★ Только избранные</label>
    </div>
    {groups.length ? groups.map(([group, rows]) => <section className="indicator-group" key={group}>
      <div className="group-heading"><h2>{group}</h2><span>{countText(rows.length, ["показатель", "показателя", "показателей"])}</span></div>
      <div className="table-surface"><table className="data-table responsive-table numeric-table"><thead><tr>
        <th>Показатель</th><th>Последний результат</th><th>Референс</th><th>Статус</th><th>Изменение</th><th>Дата</th><th><span className="sr-only">Избранное</span></th>
      </tr></thead><tbody>{rows.map((metric) => {
        const favourite = metric.favoriteOrder !== null;
        const action = favourite ? removeFavoriteMetricAction.bind(null, profileId, metric.id) : addFavoriteMetricAction.bind(null, profileId, metric.id);
        const href = `/people/${personSlug}/indicators/${metric.key}`;
        return <tr className="clickable-row" key={metric.id} tabIndex={0} onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button, input, form")) return;
          router.push(href);
        }} onKeyDown={(event) => {
          if (event.key === "Enter") router.push(href);
        }}><td data-label="Показатель"><Link className="primary-cell" href={href}>{metric.displayName}</Link><small>{countText(metric.observationCount, ["измерение", "измерения", "измерений"])}</small></td>
          <td data-label="Результат">{metricValue(metric.latest)}</td><td data-label="Референс">{referenceText(metric.latest)}</td>
          <td data-label="Статус"><Status text={referenceStatus(metric.latest)} /></td><td data-label="Изменение">{trendText(metric.points)}</td><td data-label="Дата">{formatDate(metric.latest.collectedAt)}</td>
          <td data-label="Избранное"><form action={action}><button className={`star-button${favourite ? " active" : ""}`} aria-label={favourite ? `Убрать ${metric.displayName} из избранного` : `Добавить ${metric.displayName} в избранное`} type="submit">{favourite ? "★" : "☆"}</button></form></td></tr>;
      })}</tbody></table></div>
    </section>) : <div className="compact-empty inline"><h2>Ничего не найдено</h2><p>Попробуйте другое название или группу.</p></div>}
  </>;
}

function Status({ text }: { text: string }) {
  const kind = text === "В референсе" ? "success" : text === "Нет референса" ? "neutral" : "warning";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}
