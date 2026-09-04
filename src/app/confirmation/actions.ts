"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { confirmImport } from "@/server/services";

export type ConfirmationActionState = { error: string | null };

export async function confirmImportAction(
  importSessionId: number,
  _state: ConfirmationActionState,
  formData: FormData,
): Promise<ConfirmationActionState> {
  await requireSession();

  let result: ReturnType<typeof confirmImport>;
  try {
    result = confirmImport({
      importSessionId,
      collectedAt: text(formData, "collectedAt"),
      laboratoryName: text(formData, "laboratoryName"),
      specimen: text(formData, "specimen"),
      note: text(formData, "note"),
      observations: rows(formData),
    });
  } catch {
    return {
      error: "Не удалось подтвердить документ. Попробуйте ещё раз.",
    };
  }

  if (!result.ok) return { error: result.error };

  revalidatePath(`/imports/${importSessionId}`);
  revalidatePath("/imports");
  revalidatePath("/");
  redirect(`/imports/${importSessionId}?confirmed=1`);
}

function rows(formData: FormData) {
  const metricIds = texts(formData, "metricDefinitionId");
  const originalNames = texts(formData, "originalName");
  const values = texts(formData, "valueText");
  const units = texts(formData, "unit");
  const referenceLows = texts(formData, "referenceLow");
  const referenceHighs = texts(formData, "referenceHigh");
  const referenceTexts = texts(formData, "referenceText");
  const sourceTexts = texts(formData, "sourceText");

  return metricIds.map((metricDefinitionId, index) => ({
    metricDefinitionId,
    originalName: originalNames[index] ?? "",
    valueText: values[index] ?? "",
    unit: units[index] ?? "",
    referenceLow: referenceLows[index] ?? "",
    referenceHigh: referenceHighs[index] ?? "",
    referenceText: referenceTexts[index] ?? "",
    sourceText: sourceTexts[index] ?? "",
  }));
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function texts(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => (typeof value === "string" ? value : ""));
}
