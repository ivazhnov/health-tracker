import type { DatabaseSync } from "node:sqlite";
import type {
  ConfirmationRepository,
  ConfirmedLabSession,
  ConfirmedObservation,
  MetricDefinitionOption,
} from "@/server/confirmation";

type MetricRow = {
  id: number;
  key: string;
  display_name: string;
  category: string;
  default_unit: string | null;
};

type ImportRow = {
  profile_id: number;
  source_document_id: number | null;
  status: string;
};

type LabSessionRow = {
  id: number;
  import_session_id: number;
  collected_at: string;
  laboratory_name: string | null;
  specimen: string | null;
  note: string;
  confirmed_at: string;
};

type ObservationRow = {
  id: number;
  metric_definition_id: number;
  display_name: string;
  category: string;
  original_name: string;
  value_text: string;
  value_numeric: number;
  comparator: "<" | "<=" | ">" | ">=" | null;
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
  reference_text: string | null;
  source_text: string;
};

export function createSqliteConfirmationRepository(
  database: DatabaseSync,
): ConfirmationRepository {
  const readMetrics = database.prepare(`
    SELECT id, key, display_name, category, default_unit
    FROM metric_definitions
    ORDER BY category, display_name
  `);
  const readImport = database.prepare(`
    SELECT profile_id, source_document_id, status
    FROM import_sessions
    WHERE id = ?
  `);
  const readLabSessionId = database.prepare(`
    SELECT id FROM lab_sessions WHERE import_session_id = ?
  `);
  const insertLabSession = database.prepare(`
    INSERT INTO lab_sessions (
      profile_id, import_session_id, source_document_id, collected_at,
      laboratory_name, specimen, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertObservation = database.prepare(`
    INSERT INTO observations (
      lab_session_id, metric_definition_id, original_name, value_text,
      value_numeric, comparator, unit, reference_low, reference_high,
      reference_text, source_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const completeImport = database.prepare(`
    UPDATE import_sessions
    SET status = 'confirmed', error_message = NULL,
        confirmed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'needs_review'
  `);
  const readLabSession = database.prepare(`
    SELECT
      l.id,
      l.import_session_id,
      l.collected_at,
      l.laboratory_name,
      l.specimen,
      l.note,
      i.confirmed_at
    FROM lab_sessions l
    JOIN import_sessions i ON i.id = l.import_session_id
    WHERE l.import_session_id = ?
  `);
  const readObservations = database.prepare(`
    SELECT
      o.id,
      o.metric_definition_id,
      m.display_name,
      m.category,
      o.original_name,
      o.value_text,
      o.value_numeric,
      o.comparator,
      o.unit,
      o.reference_low,
      o.reference_high,
      o.reference_text,
      o.source_text
    FROM observations o
    JOIN metric_definitions m ON m.id = o.metric_definition_id
    JOIN lab_sessions l ON l.id = o.lab_session_id
    WHERE l.import_session_id = ?
    ORDER BY o.id
  `);

  return {
    listMetricDefinitions() {
      return (readMetrics.all() as MetricRow[]).map(mapMetric);
    },

    confirm(input) {
      const now = new Date().toISOString();
      let transactionOpen = true;
      database.exec("BEGIN IMMEDIATE");
      try {
        const importRow = readImport.get(input.importSessionId) as
          | ImportRow
          | undefined;
        if (importRow?.status === "confirmed") {
          const existing = readLabSessionId.get(input.importSessionId) as {
            id: number;
          };
          database.exec("COMMIT");
          transactionOpen = false;
          return { status: "already_confirmed", labSessionId: existing.id };
        }
        if (
          importRow?.status !== "needs_review" ||
          !importRow.source_document_id
        ) {
          database.exec("ROLLBACK");
          transactionOpen = false;
          return { status: "not_reviewable" };
        }

        const labSession = insertLabSession.run(
          importRow.profile_id,
          input.importSessionId,
          importRow.source_document_id,
          input.collectedAt,
          input.laboratoryName,
          input.specimen,
          input.note,
          now,
          now,
        );
        const labSessionId = Number(labSession.lastInsertRowid);

        for (const observation of input.observations) {
          insertObservation.run(
            labSessionId,
            observation.metricDefinitionId,
            observation.originalName,
            observation.valueText,
            observation.valueNumeric,
            observation.comparator,
            observation.unit,
            observation.referenceLow,
            observation.referenceHigh,
            observation.referenceText,
            observation.sourceText,
            now,
          );
        }

        const completed = completeImport.run(
          now,
          now,
          input.importSessionId,
        );
        if (completed.changes !== 1) {
          throw new Error("Import status changed while confirming");
        }

        database.exec("COMMIT");
        transactionOpen = false;
        return { status: "confirmed", labSessionId };
      } catch (error) {
        if (transactionOpen) database.exec("ROLLBACK");
        throw error;
      }
    },

    getConfirmed(importSessionId) {
      const session = readLabSession.get(importSessionId) as
        | LabSessionRow
        | undefined;
      if (!session) return null;

      const observations = (
        readObservations.all(importSessionId) as ObservationRow[]
      ).map(mapObservation);
      return mapLabSession(session, observations);
    },
  };
}

function mapMetric(row: MetricRow): MetricDefinitionOption {
  return {
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    category: row.category,
    defaultUnit: row.default_unit,
  };
}

function mapObservation(row: ObservationRow): ConfirmedObservation {
  return {
    id: row.id,
    metricDefinitionId: row.metric_definition_id,
    displayName: row.display_name,
    category: row.category,
    originalName: row.original_name,
    valueText: row.value_text,
    valueNumeric: row.value_numeric,
    comparator: row.comparator,
    unit: row.unit,
    referenceLow: row.reference_low,
    referenceHigh: row.reference_high,
    referenceText: row.reference_text,
    sourceText: row.source_text,
  };
}

function mapLabSession(
  row: LabSessionRow,
  observations: ConfirmedObservation[],
): ConfirmedLabSession {
  return {
    id: row.id,
    importSessionId: row.import_session_id,
    collectedAt: row.collected_at,
    laboratoryName: row.laboratory_name,
    specimen: row.specimen,
    note: row.note,
    confirmedAt: row.confirmed_at,
    observations,
  };
}
