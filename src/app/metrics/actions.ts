"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import {
  addFavoriteMetric,
  getProfile,
  moveFavoriteMetric,
  removeFavoriteMetric,
} from "@/server/services";

export async function addFavoriteMetricAction(
  profileId: number,
  metricId: number,
) {
  await requireSession();
  if (!validIds(profileId, metricId) || !getProfile(profileId)) return;
  addFavoriteMetric(profileId, metricId);
  refresh(profileId, metricId);
}

export async function removeFavoriteMetricAction(
  profileId: number,
  metricId: number,
) {
  await requireSession();
  if (!validIds(profileId, metricId) || !getProfile(profileId)) return;
  removeFavoriteMetric(profileId, metricId);
  refresh(profileId, metricId);
}

export async function moveFavoriteMetricAction(
  profileId: number,
  metricId: number,
  direction: "up" | "down",
) {
  await requireSession();
  if (
    !validIds(profileId, metricId) ||
    !getProfile(profileId) ||
    (direction !== "up" && direction !== "down")
  ) return;
  moveFavoriteMetric(profileId, metricId, direction);
  refresh(profileId, metricId);
}

function validIds(profileId: number, metricId: number) {
  return Number.isInteger(profileId) && Number.isInteger(metricId);
}

function refresh(profileId: number, metricId: number) {
  const profile = getProfile(profileId);
  revalidatePath("/");
  revalidatePath(`/profiles/${profileId}/metrics`);
  revalidatePath(`/profiles/${profileId}/metrics/${metricId}`);
  if (profile) {
    revalidatePath(`/people/${profile.slug}`);
    revalidatePath(`/people/${profile.slug}/indicators`);
    revalidatePath(`/people/${profile.slug}/indicators`, "layout");
  }
}
