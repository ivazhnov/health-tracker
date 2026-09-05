import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listProfiles } from "@/server/services";

export default async function LegacyImportsPage() {
  const profiles = listProfiles();
  const activeId = Number((await cookies()).get("active_profile_id")?.value);
  const profile = profiles.find(({ id }) => id === activeId) ?? profiles[0];
  redirect(profile ? `/people/${profile.slug}/analyses` : "/");
}
