"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import type { DeduplicationConflict } from "@/server/confirmation";
import { confirmImport } from "@/server/services";

export type ConfirmationActionState = {
  error: string | null;
  conflicts: DeduplicationConflict[];
};

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
      conflictResolutions: conflictResolutions(formData),
      duplicateResolutions: texts(formData, "duplicateMetricDefinitionId").map(
        (metricDefinitionId) => ({
          metricDefinitionId,
          rowIndex: text(formData, `duplicateChoice-${metricDefinitionId}`),
        }),
      ),
    });
  } catch {
    return {
      error: "Не удалось подтвердить документ. Попробуйте ещё раз.",
      conflicts: [],
    };
  }

  if (!result.ok) {
    return { error: result.error, conflicts: result.conflicts ?? [] };
  }

  revalidatePath(`/imports/${importSessionId}`);
  revalidatePath("/imports");
  revalidatePath("/");
  const returnTo = text(formData, "returnTo");
  redirect(
    returnTo.startsWith("/people/")
      ? `${returnTo}?confirmed=1`
      : `/imports/${importSessionId}?confirmed=1`,
  );
}

function conflictResolutions(formData: FormData) {
  return texts(formData, "conflictMetricDefinitionId").map(
    (metricDefinitionId) => ({
      metricDefinitionId,
      choice: text(formData, `conflictChoice-${metricDefinitionId}`),
    }),
  );
}

function rows(formData: FormData) {
  const metricIds = texts(formData, "metricDefinitionId");
  const originalNames = texts(formData, "originalName");
  const values = texts(formData, "valueText");
  const valueKinds = texts(formData, "valueKind");
  const units = texts(formData, "unit");
  const referenceLows = texts(formData, "referenceLow");
  const referenceHighs = texts(formData, "referenceHigh");
  const referenceTexts = texts(formData, "referenceText");
  const sourceTexts = texts(formData, "sourceText");
  const specimenCodes = texts(formData, "specimenCode");
  const sourceSpecimenTexts = texts(formData, "sourceSpecimenText");

  return metricIds.map((metricDefinitionId, index) => ({
    metricDefinitionId,
    valueKind: valueKinds[index] ?? "number",
    originalName: originalNames[index] ?? "",
    valueText: values[index] ?? "",
    unit: units[index] ?? "",
    referenceLow: referenceLows[index] ?? "",
    referenceHigh: referenceHighs[index] ?? "",
    referenceText: referenceTexts[index] ?? "",
    sourceText: sourceTexts[index] ?? "",
    specimenCode: specimenCodes[index] ?? "unknown",
    sourceSpecimenText: sourceSpecimenTexts[index] ?? "",
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
