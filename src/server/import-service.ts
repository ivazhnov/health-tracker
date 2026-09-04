import type {
  DocumentStorage,
  ImportRepository,
  UploadFile,
} from "@/server/imports";
import { validateUploadFile } from "@/server/import-file-rules";

export function createImportService(
  repository: ImportRepository,
  storage: DocumentStorage,
) {
  return {
    async upload(profileId: number, file: UploadFile) {
      const validation = validateUploadFile(file);
      if (!validation.ok) {
        repository.createFailed({
          profileId,
          originalFileName: cleanFileName(file.name),
          mediaType: file.declaredMediaType || "application/octet-stream",
          sizeBytes: file.size,
          errorMessage: validation.error,
        });
        return false;
      }

      try {
        const storagePath = await storage.save(
          validation.value.sha256,
          file.contents,
        );
        repository.createUploaded({
          profileId,
          originalFileName: cleanFileName(file.name),
          mediaType: validation.value.mediaType,
          sizeBytes: file.size,
          sha256: validation.value.sha256,
          storagePath,
        });
        return true;
      } catch {
        repository.createFailed({
          profileId,
          originalFileName: cleanFileName(file.name),
          mediaType: validation.value.mediaType,
          sizeBytes: file.size,
          errorMessage: "Не удалось сохранить файл.",
        });
        return false;
      }
    },

    fail(profileId: number, file: Pick<UploadFile, "name" | "declaredMediaType" | "size">, error: string) {
      repository.createFailed({
        profileId,
        originalFileName: cleanFileName(file.name),
        mediaType: file.declaredMediaType || "application/octet-stream",
        sizeBytes: file.size,
        errorMessage: error,
      });
    },
  };
}

function cleanFileName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "Без названия").slice(0, 255);
}
