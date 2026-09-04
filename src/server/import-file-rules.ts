import { createHash } from "node:crypto";
import {
  MAX_BATCH_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILES,
  type UploadFile,
} from "@/server/imports";

type AcceptedFile = {
  mediaType: string;
  sha256: string;
};

export type FileValidation =
  | { ok: true; value: AcceptedFile }
  | { ok: false; error: string };

export function validateUploadFile(file: UploadFile): FileValidation {
  if (file.size === 0) {
    return { ok: false, error: "Файл пустой." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "Файл больше 20 МБ." };
  }

  const mediaType = detectMediaType(file);
  if (!mediaType) {
    return {
      ok: false,
      error: "Поддерживаются PDF, PNG, JPEG и TXT.",
    };
  }

  return {
    ok: true,
    value: {
      mediaType,
      sha256: createHash("sha256").update(file.contents).digest("hex"),
    },
  };
}

export function validateBatch(files: Array<{ size: number }>) {
  if (files.length > MAX_UPLOAD_FILES) {
    return `За один раз можно загрузить не больше ${MAX_UPLOAD_FILES} файлов.`;
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > MAX_BATCH_SIZE_BYTES) {
    return "Общий размер файлов больше 90 МБ.";
  }

  return null;
}

function detectMediaType(file: UploadFile) {
  const bytes = file.contents;

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  const lowerName = file.name.toLowerCase();
  const looksLikeText =
    file.declaredMediaType === "text/plain" || lowerName.endsWith(".txt");
  if (looksLikeText && !bytes.subarray(0, 1024).includes(0)) {
    return "text/plain";
  }

  return null;
}

function startsWith(contents: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => contents[index] === byte);
}
