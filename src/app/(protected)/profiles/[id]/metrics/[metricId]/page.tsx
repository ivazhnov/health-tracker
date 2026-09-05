import { notFound, redirect } from "next/navigation";
import { getMetricHistory, getProfile } from "@/server/services";

export default async function LegacyMetricPage({ params }: { params: Promise<{ id: string; metricId: string }> }) {
  const values = await params;
  const profileId = Number(values.id);
  const metricId = Number(values.metricId);
  const profile = Number.isInteger(profileId) ? getProfile(profileId) : null;
  const history = profile && Number.isInteger(metricId) ? getMetricHistory(profileId, metricId) : null;
  if (!profile || !history) notFound();
  redirect(`/people/${profile.slug}/indicators/${history.metric.key}`);
}
