import { notFound } from "next/navigation";
import { PersonShell } from "@/app/people/person-shell";
import { getProfileBySlug, listProfiles } from "@/server/services";

export default async function PersonLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const profile = getProfileBySlug((await params).slug);
  if (!profile) notFound();
  return <PersonShell active={profile} people={listProfiles()}>{children}</PersonShell>;
}
