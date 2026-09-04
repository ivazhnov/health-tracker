import { createApplicationStatusQuery } from "@/server/application-status";
import {
  createSqliteApplicationStatusRepository,
  getDataDirectory,
  getDatabase,
} from "@/server/database/sqlite";
import { createSqliteImportRepository } from "@/server/database/sqlite-imports";
import { createSqliteProfileRepository } from "@/server/database/sqlite-profiles";
import { createSqliteRecognitionRepository } from "@/server/database/sqlite-recognition";
import { createLocalDocumentStorage } from "@/server/document-storage";
import { createImportService } from "@/server/import-service";
import { createLocalDraftExtractor } from "@/server/local-draft-extractor";
import { createLocalTextExtractor } from "@/server/local-text-extractor";
import { createRecognitionService } from "@/server/recognition-service";
import type { ImportRepository, UploadFile } from "@/server/imports";
import type { ProfileRepository, SaveProfileInput } from "@/server/profiles";
import type { RecognitionRepository } from "@/server/recognition";

let applicationStatusQuery: ReturnType<
  typeof createApplicationStatusQuery
> | null = null;
let profileRepository: ProfileRepository | null = null;
let importRepository: ImportRepository | null = null;
let importService: ReturnType<typeof createImportService> | null = null;
let recognitionRepository: RecognitionRepository | null = null;
let recognitionService: ReturnType<typeof createRecognitionService> | null =
  null;

export function getApplicationStatus() {
  if (!applicationStatusQuery) {
    const repository = createSqliteApplicationStatusRepository(getDatabase());
    applicationStatusQuery = createApplicationStatusQuery(repository);
  }

  return applicationStatusQuery();
}

export function listProfiles() {
  return profiles().list();
}

export function getProfile(profileId: number) {
  return profiles().get(profileId);
}

export function createProfile(input: SaveProfileInput) {
  return profiles().create(input);
}

export function updateProfile(profileId: number, input: SaveProfileInput) {
  return profiles().update(profileId, input);
}

export function listImports(profileId?: number) {
  return imports().list(profileId);
}

export function getImport(importSessionId: number) {
  return imports().get(importSessionId);
}

export function getSourceDocument(sourceDocumentId: number) {
  return imports().getDocument(sourceDocumentId);
}

export function uploadImport(profileId: number, file: UploadFile) {
  return importer().upload(profileId, file);
}

export function failImport(
  profileId: number,
  file: Pick<UploadFile, "name" | "declaredMediaType" | "size">,
  error: string,
) {
  return importer().fail(profileId, file, error);
}

export function readSourceDocument(storagePath: string) {
  return storage().read(storagePath);
}

export function recogniseImport(importSessionId: number) {
  return recogniser()(importSessionId);
}

export function getRecognitionDraft(importSessionId: number) {
  return recognition().getDraft(importSessionId);
}

function profiles() {
  if (!profileRepository) {
    profileRepository = createSqliteProfileRepository(getDatabase());
  }

  return profileRepository;
}

function imports() {
  if (!importRepository) {
    importRepository = createSqliteImportRepository(getDatabase());
  }

  return importRepository;
}

function storage() {
  return createLocalDocumentStorage(getDataDirectory());
}

function importer() {
  if (!importService) {
    importService = createImportService(imports(), storage());
  }

  return importService;
}

function recognition() {
  if (!recognitionRepository) {
    recognitionRepository = createSqliteRecognitionRepository(getDatabase());
  }

  return recognitionRepository;
}

function recogniser() {
  if (!recognitionService) {
    recognitionService = createRecognitionService(
      recognition(),
      storage(),
      createLocalTextExtractor(getDataDirectory()),
      createLocalDraftExtractor(),
    );
  }

  return recognitionService;
}
