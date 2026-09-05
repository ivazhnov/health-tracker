import { notFound, redirect } from "next/navigation";
import { getImport, getProfile } from "@/server/services";

export default async function LegacyImportPage({ params }: { params: Promise<{ id: string }> }) {
  const importId = Number((await params).id);
  const item = Number.isInteger(importId) ? getImport(importId) : null;
  if (!item) notFound();
  const profile = getProfile(item.profileId);
  if (!profile) notFound();
  redirect(`/people/${profile.slug}/analyses/${item.id}`);
}
