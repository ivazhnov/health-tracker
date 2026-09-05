import { createApplicationStatusQuery } from "@/server/application-status";
import { createConfirmationService } from "@/server/confirmation-service";
import {
  createSqliteApplicationStatusRepository,
  getDataDirectory,
  getDatabase,
} from "@/server/database/sqlite";
import { createSqliteConfirmationRepository } from "@/server/database/sqlite-confirmation";
import { createSqliteImportRepository } from "@/server/database/sqlite-imports";
import {
  createSqliteFavoriteMetricCommandRepository,
  createSqliteMetricHistoryQueryRepository,
} from "@/server/database/sqlite-metric-history";
import { createSqliteProfileRepository } from "@/server/database/sqlite-profiles";
import { createSqliteRecognitionRepository } from "@/server/database/sqlite-recognition";
import { createLocalDocumentStorage } from "@/server/document-storage";
import { createImportService } from "@/server/import-service";
import { createLocalDraftExtractor } from "@/server/local-draft-extractor";
import { createOpenAiDraftExtractor } from "@/server/openai-draft-extractor";
import { createLocalTextExtractor } from "@/server/local-text-extractor";
import { createRecognitionService } from "@/server/recognition-service";
import type { ImportRepository, UploadFile } from "@/server/imports";
import type {
  FavoriteMetricCommandRepository,
  MetricHistoryQueryRepository,
} from "@/server/metric-history";
import type {
  ConfirmationRepository,
  ConfirmImportInput,
} from "@/server/confirmation";
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
let confirmationRepository: ConfirmationRepository | null = null;
let confirmationService: ReturnType<typeof createConfirmationService> | null =
  null;
let metricHistoryRepository: MetricHistoryQueryRepository | null = null;
let favoriteMetricRepository: FavoriteMetricCommandRepository | null = null;

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

export function getProfileBySlug(slug: string) {
  return profiles().getBySlug(slug);
}

export function createProfile(input: SaveProfileInput) {
  return profiles().create(input);
}

export function updateProfile(profileId: number, input: SaveProfileInput) {
  return profiles().update(profileId, input);
}

export function addBodyMeasurement(profileId: number, measurement: SaveProfileInput["measurement"]) {
  return profiles().addMeasurement(profileId, measurement);
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
  file: Pick<UploadFile, "name" | "laboratoryName" | "declaredMediaType" | "size">,
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

export function listMetricDefinitions() {
  return confirmations().listMetricDefinitions();
}

export function confirmImport(input: ConfirmImportInput) {
  return confirmer().confirm(input);
}

export function getConfirmedLabSession(importSessionId: number) {
  return confirmations().getConfirmed(importSessionId);
}

export function getProfileArchiveStats(profileId: number) {
  return metricHistory().getArchiveStats(profileId);
}

export function listProfileMetrics(profileId: number) {
  return metricHistory().listProfileMetrics(profileId);
}

export function getMetricHistory(profileId: number, metricId: number) {
  return metricHistory().getMetricHistory(profileId, metricId);
}

export function addFavoriteMetric(profileId: number, metricId: number) {
  return favoriteMetrics().add(profileId, metricId);
}

export function removeFavoriteMetric(profileId: number, metricId: number) {
  return favoriteMetrics().remove(profileId, metricId);
}

export function moveFavoriteMetric(
  profileId: number,
  metricId: number,
  direction: "up" | "down",
) {
  return favoriteMetrics().move(profileId, metricId, direction);
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
      process.env.OPENAI_API_KEY
        ? createOpenAiDraftExtractor(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || "gpt-4.1")
        : createLocalDraftExtractor(),
    );
  }

  return recognitionService;
}

function confirmations() {
  if (!confirmationRepository) {
    confirmationRepository = createSqliteConfirmationRepository(getDatabase());
  }

  return confirmationRepository;
}

function confirmer() {
  if (!confirmationService) {
    confirmationService = createConfirmationService(confirmations());
  }

  return confirmationService;
}

function metricHistory() {
  if (!metricHistoryRepository) {
    metricHistoryRepository = createSqliteMetricHistoryQueryRepository(
      getDatabase(),
    );
  }
  return metricHistoryRepository;
}

function favoriteMetrics() {
  if (!favoriteMetricRepository) {
    favoriteMetricRepository = createSqliteFavoriteMetricCommandRepository(
      getDatabase(),
    );
  }
  return favoriteMetricRepository;
}
