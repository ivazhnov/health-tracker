"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession, requireSession } from "@/server/auth/session";
import { getProfile, getProfileBySlug } from "@/server/services";

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function switchPersonAction(currentSection: string, formData: FormData) {
  await requireSession();
  const slug = String(formData.get("personSlug") ?? "");
  const profile = getProfileBySlug(slug);
  if (!profile) redirect("/people");
  (await cookies()).set("active_profile_id", String(profile.id), {
    httpOnly: true, path: "/", sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });
  const allowed = new Set(["", "/analyses", "/indicators", "/upload", "/settings"]);
  redirect(`/people/${profile.slug}${allowed.has(currentSection) ? currentSection : ""}`);
}

export async function selectProfileAction(formData: FormData) {
  await requireSession();
  const profileId = Number(formData.get("profileId"));

  if (!Number.isInteger(profileId) || !getProfile(profileId)) {
    redirect("/");
  }

  (await cookies()).set("active_profile_id", String(profileId), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });
  redirect("/");
}
