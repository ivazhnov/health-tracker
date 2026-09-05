import { notFound } from "next/navigation";
import { IndicatorsBrowser } from "@/app/metrics/indicators-browser";
import { getProfileBySlug, listProfileMetrics } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  const metrics = listProfileMetrics(profile.id);
  return <main className="person-page"><div className="page-heading"><div><h1>Показатели</h1><p>Все подтверждённые результаты {profile.firstName}</p></div></div>
    {metrics.length ? <IndicatorsBrowser profileId={profile.id} personSlug={profile.slug} metrics={metrics} /> : <div className="compact-empty inline"><h2>Показателей пока нет</h2><p>Показатели появятся после распознавания анализов.</p></div>}
  </main>;
}
