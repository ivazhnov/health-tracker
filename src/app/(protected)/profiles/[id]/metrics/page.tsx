import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/server/services";

export default async function LegacyMetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const profileId = Number((await params).id);
  const profile = Number.isInteger(profileId) ? getProfile(profileId) : null;
  if (!profile) notFound();
  redirect(`/people/${profile.slug}/indicators`);
}
