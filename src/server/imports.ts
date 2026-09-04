export const MAX_UPLOAD_FILES = 10;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_BATCH_SIZE_BYTES = 90 * 1024 * 1024;

export type ImportStatus =
  | "uploaded"
  | "extracting"
  | "needs_review"
  | "confirmed"
  | "failed";

export type ImportSession = {
  id: number;
  profileId: number;
  profileName: string;
  sourceDocumentId: number | null;
  duplicateOfImportSessionId: number | null;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string | null;
  status: ImportStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceDocument = {
  id: number;
  storagePath: string;
  mediaType: string;
  sizeBytes: number;
};

export type CreateUploadedImport = {
  profileId: number;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
};

export type CreateFailedImport = {
  profileId: number;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  errorMessage: string;
};

export interface ImportRepository {
  list(profileId?: number): ImportSession[];
  get(importSessionId: number): ImportSession | null;
  getDocument(sourceDocumentId: number): SourceDocument | null;
  createUploaded(input: CreateUploadedImport): number;
  createFailed(input: CreateFailedImport): number;
}

export interface DocumentStorage {
  save(sha256: string, contents: Uint8Array): Promise<string>;
  read(storagePath: string): Promise<Uint8Array>;
}

export type UploadFile = {
  name: string;
  declaredMediaType: string;
  size: number;
  contents: Uint8Array;
};

export type UploadBatchResult = {
  uploaded: number;
  failed: number;
};
