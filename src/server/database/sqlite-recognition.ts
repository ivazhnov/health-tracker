import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type {
  MetricAlias,
  ObservationDraft,
  RecognitionJob,
  RecognitionRepository,
} from "@/server/recognition";

type AliasRow = {
  metric_definition_id: number;
  metric_key: string;
  display_name: string;
  category: string;
  default_unit: string | null;
  language: string;
  alias: string;
};

type JobRow = {
  import_session_id: number;
  source_document_id: number;
  storage_path: string;
  media_type: string;
  laboratory_name_override: string | null;
};

type ExtractionRow = {
  recognition_version: string;
  extracted_text: string;
  detected_language: string;
  laboratory_name: string | null;
  collected_at: string | null;
  specimen: string | null;
  warnings_json: string;
};

type DraftRow = {
  metric_definition_id: number | null;
  original_name: string;
  display_name: string | null;
  category: string | null;
  value_text: string;
  unit: string | null;
  reference_low: string | null;
  reference_high: string | null;
  reference_text: string | null;
  confidence: number;
  source_text: string;
};

export function createSqliteRecognitionRepository(
  database: DatabaseSync,
): RecognitionRepository {
  const claimImport = database.prepare(`
    UPDATE import_sessions
    SET status = 'extracting', error_message = NULL, updated_at = ?
    WHERE id = ?
      AND source_document_id IS NOT NULL
      AND status IN ('uploaded', 'failed', 'needs_review')
  `);
  const readJob = database.prepare(`
    SELECT
      i.id AS import_session_id,
      d.id AS source_document_id,
      d.storage_path,
      d.media_type,
      i.laboratory_name_override
    FROM import_sessions i
    JOIN source_documents d ON d.id = i.source_document_id
    WHERE i.id = ?
  `);
  const readAliases = database.prepare(`
    SELECT
      a.metric_definition_id,
      m.key AS metric_key,
      m.display_name,
      m.category,
      m.default_unit,
      a.language,
      a.alias
    FROM metric_aliases a
    JOIN metric_definitions m ON m.id = a.metric_definition_id
    ORDER BY length(a.alias) DESC
  `);
  const saveExtraction = database.prepare(`
    INSERT INTO import_extractions (
      import_session_id, recognition_version, extracted_text,
      detected_language, laboratory_name, collected_at, specimen,
      warnings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (import_session_id) DO UPDATE SET
      recognition_version = excluded.recognition_version,
      extracted_text = excluded.extracted_text,
      detected_language = excluded.detected_language,
      laboratory_name = excluded.laboratory_name,
      collected_at = excluded.collected_at,
      specimen = excluded.specimen,
      warnings_json = excluded.warnings_json,
      updated_at = excluded.updated_at
  `);
  const deleteDrafts = database.prepare(
    "DELETE FROM observation_drafts WHERE import_session_id = ?",
  );
  const insertDraft = database.prepare(`
    INSERT INTO observation_drafts (
      import_session_id, metric_definition_id, original_name, value_text,
      unit, reference_low, reference_high, reference_text, confidence,
      source_text, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const completeImport = database.prepare(`
    UPDATE import_sessions
    SET status = 'needs_review', error_message = NULL, updated_at = ?
    WHERE id = ?
  `);
  const failImport = database.prepare(`
    UPDATE import_sessions
    SET status = 'failed', error_message = ?, updated_at = ?
    WHERE id = ?
  `);
  const readExtraction = database.prepare(`
    SELECT
      recognition_version, extracted_text, detected_language,
      laboratory_name, collected_at, specimen, warnings_json
    FROM import_extractions
    WHERE import_session_id = ?
  `);
  const readDrafts = database.prepare(`
    SELECT
      d.metric_definition_id,
      d.original_name,
      m.display_name,
      m.category,
      d.value_text,
      d.unit,
      d.reference_low,
      d.reference_high,
      d.reference_text,
      d.confidence,
      d.source_text
    FROM observation_drafts d
    LEFT JOIN metric_definitions m ON m.id = d.metric_definition_id
    WHERE d.import_session_id = ?
    ORDER BY d.sort_order, d.id
  `);

  return {
    claim(importSessionId) {
      const now = new Date().toISOString();
      const result = claimImport.run(now, importSessionId);
      if (result.changes === 0) return null;

      const row = readJob.get(importSessionId) as JobRow;
      return mapJob(row);
    },

    listMetricAliases() {
      return (readAliases.all() as AliasRow[]).map(mapAlias);
    },

    complete(importSessionId, draft) {
      const now = new Date().toISOString();
      database.exec("BEGIN IMMEDIATE");
      try {
        saveExtraction.run(
          importSessionId,
          draft.recognitionVersion,
          draft.extractedText,
          draft.detectedLanguage,
          draft.laboratoryName,
          draft.collectedAt,
          draft.specimen,
          JSON.stringify(draft.warnings),
          now,
          now,
        );
        deleteDrafts.run(importSessionId);
        draft.observations.forEach((item, index) => {
          let metricId = item.metricDefinitionId;
          // Catalogue proposals are labels only; no medical result is confirmed here.
          if (metricId === null && draft.recognitionVersion.startsWith("openai-") && item.displayName && item.category) {
            const key = "ai_" + createHash("sha256").update(
              item.displayName.normalize("NFKC").trim().toLocaleLowerCase(),
            ).digest("hex");
            database.prepare(`INSERT OR IGNORE INTO metric_definitions
              (key, display_name, category, default_unit) VALUES (?, ?, ?, ?)`)
              .run(key, item.displayName, item.category, item.unit);
            metricId = (database.prepare("SELECT id FROM metric_definitions WHERE key = ?").get(key) as { id: number }).id;
            database.prepare(`INSERT OR IGNORE INTO metric_aliases
              (metric_definition_id, language, alias) VALUES (?, 'ru', ?)`)
              .run(metricId, item.displayName);
          }
          insertDraft.run(
            importSessionId,
            metricId,
            item.originalName,
            item.valueText,
            item.unit,
            item.referenceLow,
            item.referenceHigh,
            item.referenceText,
            item.metricDefinitionId === null ? Math.min(item.confidence, 0.8) : item.confidence,
            item.sourceText,
            index,
            now,
          );
        });
        completeImport.run(now, importSessionId);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    fail(importSessionId, message) {
      failImport.run(message, new Date().toISOString(), importSessionId);
    },

    getDraft(importSessionId) {
      const extraction = readExtraction.get(importSessionId) as
        | ExtractionRow
        | undefined;
      if (!extraction) return null;

      const observations = (readDrafts.all(importSessionId) as DraftRow[]).map(
        mapDraft,
      );
      return {
        importSessionId,
        recognitionVersion: extraction.recognition_version,
        extractedText: extraction.extracted_text,
        detectedLanguage: extraction.detected_language,
        laboratoryName: extraction.laboratory_name,
        collectedAt: extraction.collected_at,
        specimen: extraction.specimen,
        warnings: parseWarnings(extraction.warnings_json),
        observations,
      };
    },
  };
}

function mapJob(row: JobRow): RecognitionJob {
  return {
    importSessionId: row.import_session_id,
    sourceDocumentId: row.source_document_id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    laboratoryNameOverride: row.laboratory_name_override,
  };
}

function mapAlias(row: AliasRow): MetricAlias {
  return {
    metricDefinitionId: row.metric_definition_id,
    metricKey: row.metric_key,
    displayName: row.display_name,
    category: row.category,
    defaultUnit: row.default_unit,
    language: row.language,
    alias: row.alias,
  };
}

function mapDraft(row: DraftRow): ObservationDraft {
  return {
    metricDefinitionId: row.metric_definition_id,
    originalName: row.original_name,
    displayName: row.display_name,
    category: row.category,
    valueText: row.value_text,
    unit: row.unit,
    referenceLow: row.reference_low,
    referenceHigh: row.reference_high,
    referenceText: row.reference_text,
    confidence: row.confidence,
    sourceText: row.source_text,
  };
}

function parseWarnings(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
