"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { parseProfileForm } from "@/server/profiles";
import {
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
