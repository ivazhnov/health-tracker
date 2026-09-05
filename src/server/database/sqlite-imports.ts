import type { DatabaseSync } from "node:sqlite";
import type {
  ImportRepository,
  ImportSession,
  ImportStatus,
  SourceDocument,
} from "@/server/imports";

type ImportRow = {
  id: number;
  profile_id: number;
  profile_name: string;
  source_document_id: number | null;
  duplicate_of_import_session_id: number | null;
  original_file_name: string;
  media_type: string;
  size_bytes: number;
  sha256: string | null;
  status: ImportStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  collected_at: string | null;
  laboratory_name: string | null;
  observation_count: number;
};

type DocumentRow = {
  id: number;
  storage_path: string;
  media_type: string;
  size_bytes: number;
};

const IMPORT_SELECT = `
  SELECT
    i.id,
    i.profile_id,
    trim(p.first_name || ' ' || p.last_name) AS profile_name,
    i.source_document_id,
    i.duplicate_of_import_session_id,
    i.original_file_name,
    i.media_type,
    i.size_bytes,
    i.sha256,
    i.status,
    i.error_message,
    i.created_at,
    i.updated_at
    , i.confirmed_at
    , COALESCE(l.collected_at, e.collected_at) AS collected_at
    , COALESCE(l.laboratory_name, i.laboratory_name_override, e.laboratory_name) AS laboratory_name
    , CASE WHEN l.id IS NULL THEN
        (SELECT COUNT(*) FROM observation_drafts d WHERE d.import_session_id = i.id)
      ELSE
        (SELECT COUNT(*) FROM confirmed_observations o WHERE o.lab_session_id = l.id)
      END AS observation_count
  FROM import_sessions i
  JOIN profiles p ON p.id = i.profile_id
  LEFT JOIN import_extractions e ON e.import_session_id = i.id
  LEFT JOIN import_confirmation_results r ON r.import_session_id = i.id
  LEFT JOIN lab_sessions l ON l.id = r.lab_session_id
`;

export function createSqliteImportRepository(
  database: DatabaseSync,
): ImportRepository {
  const listAll = database.prepare(`${IMPORT_SELECT} ORDER BY i.id DESC`);
  const listByProfile = database.prepare(
    `${IMPORT_SELECT} WHERE i.profile_id = ? ORDER BY i.id DESC`,
  );
  const getImport = database.prepare(`${IMPORT_SELECT} WHERE i.id = ?`);
  const getDocument = database.prepare(`
    SELECT id, storage_path, media_type, size_bytes
    FROM source_documents
    WHERE id = ?
  `);
  const insertDocument = database.prepare(`
    INSERT OR IGNORE INTO source_documents (
      sha256, storage_path, media_type, size_bytes, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const findDocument = database.prepare(`
    SELECT id, storage_path, media_type, size_bytes
    FROM source_documents
    WHERE sha256 = ?
  `);
  const findFirstImport = database.prepare(`
    SELECT id
    FROM import_sessions
    WHERE source_document_id = ?
    ORDER BY id
    LIMIT 1
  `);
  const insertUploaded = database.prepare(`
    INSERT INTO import_sessions (
      profile_id, source_document_id, duplicate_of_import_session_id,
      original_file_name, media_type, size_bytes, sha256, status,
      error_message, laboratory_name_override, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded', NULL, ?, ?, ?)
  `);
  const insertFailed = database.prepare(`
    INSERT INTO import_sessions (
      profile_id, source_document_id, duplicate_of_import_session_id,
      original_file_name, media_type, size_bytes, sha256, status,
      error_message, laboratory_name_override, created_at, updated_at
    ) VALUES (?, NULL, NULL, ?, ?, ?, NULL, 'failed', ?, ?, ?, ?)
  `);

  return {
    list(profileId) {
      const rows = profileId
        ? (listByProfile.all(profileId) as ImportRow[])
        : (listAll.all() as ImportRow[]);
      return rows.map(mapImport);
    },

    get(importSessionId) {
      const row = getImport.get(importSessionId) as ImportRow | undefined;
      return row ? mapImport(row) : null;
    },

    getDocument(sourceDocumentId) {
      const row = getDocument.get(sourceDocumentId) as DocumentRow | undefined;
      return row ? mapDocument(row) : null;
    },

    createUploaded(input) {
      const now = new Date().toISOString();

      database.exec("BEGIN IMMEDIATE");
      try {
        insertDocument.run(
          input.sha256,
          input.storagePath,
          input.mediaType,
          input.sizeBytes,
          now,
        );
        const document = findDocument.get(input.sha256) as DocumentRow;
        const originalImport = findFirstImport.get(document.id) as
          | { id: number }
          | undefined;
        const result = insertUploaded.run(
          input.profileId,
          document.id,
          originalImport?.id ?? null,
          input.originalFileName,
          input.mediaType,
          input.sizeBytes,
          input.sha256,
          input.laboratoryName,
          now,
          now,
        );
        database.exec("COMMIT");
        return Number(result.lastInsertRowid);
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    createFailed(input) {
      const now = new Date().toISOString();
      const result = insertFailed.run(
        input.profileId,
        input.originalFileName,
        input.mediaType,
        input.sizeBytes,
        input.errorMessage,
        input.laboratoryName,
        now,
        now,
      );
      return Number(result.lastInsertRowid);
    },
  };
}

function mapImport(row: ImportRow): ImportSession {
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    sourceDocumentId: row.source_document_id,
    duplicateOfImportSessionId: row.duplicate_of_import_session_id,
    originalFileName: row.original_file_name,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    collectedAt: row.collected_at,
    laboratoryName: row.laboratory_name,
    observationCount: row.observation_count,
  };
}

function mapDocument(row: DocumentRow): SourceDocument {
  return {
    id: row.id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
  };
}
