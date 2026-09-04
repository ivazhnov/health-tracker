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

  if (!Number.isInteger(profileId) || !getProfile(profileId)) {
    redirect("/");
  }

  const files = formData
    .getAll("files")
    .filter(
      (entry): entry is File => entry instanceof File && entry.name.length > 0,
    );

  if (files.length === 0) {
    redirect("/imports/new?error=no_files");
  }

  const batchError = validateBatch(files);
  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    if (batchError) {
      failImport(profileId, fileInfo(file), batchError);
      failed += 1;
      continue;
    }

    try {
      const importSessionId = await uploadImport(profileId, {
        ...fileInfo(file),
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
        fileInfo(file),
        "Не удалось прочитать загруженный файл.",
      );
      failed += 1;
    }
  }

  redirect(`/imports?uploaded=${uploaded}&failed=${failed}`);
}

function fileInfo(file: File) {
  return {
    name: file.name,
    declaredMediaType: file.type,
    size: file.size,
  };
}
