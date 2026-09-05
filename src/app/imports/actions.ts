"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { validateBatch } from "@/server/import-file-rules";
import {
  getProfile,
  failImport,
  recogniseImport,
  uploadImport,
} from "@/server/services";

export async function uploadFilesAction(formData: FormData) {
  await requireSession();
  const profileId = Number(formData.get("profileId"));
  const redirectSlug = String(formData.get("redirectSlug") ?? "");

  if (!Number.isInteger(profileId) || !getProfile(profileId)) {
    redirect("/");
  }

  const files = formData
    .getAll("files")
    .filter(
      (entry): entry is File => entry instanceof File && entry.name.length > 0,
    );
  const laboratoryNames = formData
    .getAll("laboratoryNames")
    .map(cleanLaboratoryName);

  if (files.length === 0) {
    redirect(
      redirectSlug
        ? `/people/${redirectSlug}/upload?error=no_files`
        : "/imports/new?error=no_files",
    );
  }

  const batchError = validateBatch(files);
  let uploaded = 0;
  let failed = 0;

  for (const [index, file] of files.entries()) {
    const info = fileInfo(file, laboratoryNames[index] ?? null);
    if (batchError) {
      failImport(profileId, info, batchError);
      failed += 1;
      continue;
    }

    try {
      const importSessionId = await uploadImport(profileId, {
        ...info,
        contents: new Uint8Array(await file.arrayBuffer()),
      });
      if (importSessionId) {
        uploaded += 1;
        await recogniseImport(importSessionId);
      } else {
        failed += 1;
      }
    } catch {
      failImport(
        profileId,
        info,
        "Не удалось прочитать загруженный файл.",
      );
      failed += 1;
    }
  }

  redirect(
    redirectSlug
      ? `/people/${redirectSlug}/analyses?uploaded=${uploaded}&failed=${failed}`
      : `/imports?uploaded=${uploaded}&failed=${failed}`,
  );
}

function fileInfo(file: File, laboratoryName: string | null) {
  return {
    name: file.name,
    laboratoryName,
    declaredMediaType: file.type,
    size: file.size,
  };
}

function cleanLaboratoryName(entry: FormDataEntryValue) {
  if (typeof entry !== "string") return null;
  const value = entry.normalize("NFKC").trim();
  return value ? value.slice(0, 200) : null;
}
