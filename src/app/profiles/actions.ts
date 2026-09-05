"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { parseMeasurementForm, parseProfileForm } from "@/server/profiles";
import {
  addBodyMeasurement,
  createProfile,
  getProfile,
  updateProfile,
} from "@/server/services";

export async function createProfileAction(formData: FormData) {
  await requireSession();
  const parsed = parseProfileForm(formData);

  if (!parsed.ok) {
    redirect("/profiles/new?error=invalid");
  }

  const result = createProfile(parsed.value);
  if (!result.ok) {
    redirect("/?error=profile_limit");
  }

  revalidatePath("/");
  redirect("/?saved=profile");
}

export async function updateProfileAction(
  profileId: number,
  formData: FormData,
) {
  await requireSession();

  if (!Number.isInteger(profileId) || !getProfile(profileId)) {
    redirect("/");
  }

  const parsed = parseProfileForm(formData);
  if (!parsed.ok) {
    redirect(`/profiles/${profileId}/edit?error=invalid`);
  }

  updateProfile(profileId, parsed.value);
  revalidatePath("/");
  redirect("/?saved=profile");
}

export async function updatePersonProfileAction(
  profileId: number,
  slug: string,
  formData: FormData,
) {
  await requireSession();
  const profile = getProfile(profileId);
  if (!profile || profile.slug !== slug) redirect("/");

  const parsed = parseProfileForm(formData);
  if (!parsed.ok) redirect(`/people/${slug}/settings?error=invalid`);

  updateProfile(profileId, parsed.value);
  revalidatePath(`/people/${slug}`);
  redirect(`/people/${slug}/settings?saved=profile`);
}

export async function addBodyMeasurementAction(
  profileId: number,
  slug: string,
  formData: FormData,
) {
  await requireSession();
  const profile = getProfile(profileId);
  if (!profile || profile.slug !== slug) redirect("/");

  const measurement = parseMeasurementForm(formData);
  if (!measurement) redirect(`/people/${slug}/measurements/new?error=invalid`);

  addBodyMeasurement(profileId, measurement);
  revalidatePath(`/people/${slug}`);
  redirect(`/people/${slug}/measurements/new?saved=measurement`);
}
