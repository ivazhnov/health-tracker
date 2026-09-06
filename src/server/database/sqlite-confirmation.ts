import type { DatabaseSync } from "node:sqlite";
import type {
  ConfirmationRepository,
  ConfirmationSummary,
  ConfirmedLabSession,
  ConfirmedObservation,
  ConfirmedSourceDocument,
  DeduplicationConflict,
  MetricDefinitionOption,
  ValidatedConfirmation,
  ValidatedObservation,
} from "@/server/confirmation";
import { parseNumericResult } from "../numeric-result.ts";

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
  original_file_name: string;
  status: string;
};

type CandidateRow = {
  id: number;
  laboratory_name: string | null;
};

type LabSessionRow = {
  id: number;
  import_session_id: number;
  collected_at: string;
  laboratory_name: string | null;
  specimen: string | null;
  note: string;
  confirmed_at: string;
  outcome: "created" | "merged";
  added_observations: number;
  matched_observations: number;
  resolved_conflicts: number;
};

type ObservationRow = {
  id: number;
  metric_definition_id: number;
  display_name: string;
  category: string;
  original_name: string;
  value_text: string;
  value_numeric: number | null;
  comparator: "<" | "<=" | ">" | ">=" | null;
  unit: string | null;
  specimen: string | null;
  reference_low: number | null;
  reference_high: number | null;
  reference_text: string | null;
  source_text: string;
  source_count: number;
  specimen_code: string;
  source_specimen_text: string | null;
};

type ConfirmationResultRow = {
  lab_session_id: number;
  outcome: "created" | "merged";
  added_observations: number;
  matched_observations: number;
  resolved_conflicts: number;
};

type SourceRow = {
  source_document_id: number;
  original_file_name: string;
  laboratory_name: string | null;
  specimen: string | null;
  note: string;
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
    SELECT profile_id, source_document_id, original_file_name, status
    FROM import_sessions
    WHERE id = ?
  `);
  const readConfirmationResult = database.prepare(`
    SELECT
      lab_session_id, outcome, added_observations,
      matched_observations, resolved_conflicts
    FROM import_confirmation_results
    WHERE import_session_id = ?
  `);
  const readCandidates = database.prepare(`
    SELECT id, laboratory_name
    FROM lab_sessions
    WHERE profile_id = ? AND collected_at = ?
    ORDER BY id
  `);
  const readExistingObservations = database.prepare(`
    SELECT
      o.id, o.metric_definition_id, m.display_name, m.category,
      o.original_name, o.value_text, o.value_numeric, o.comparator,
      o.unit, o.specimen, o.reference_low, o.reference_high,
      o.reference_text, o.source_text, o.specimen_code, o.source_specimen_text,
      (SELECT COUNT(DISTINCT source_document_id) FROM confirmed_observation_sources s WHERE s.observation_id = o.id)
        AS source_count
    FROM confirmed_observations o
    JOIN metric_definitions m ON m.id = o.metric_definition_id
    WHERE o.lab_session_id = ?
    ORDER BY o.id
  `);
  const insertLabSession = database.prepare(`
    INSERT INTO lab_sessions (
      profile_id, import_session_id, source_document_id, collected_at,
      laboratory_name, specimen, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertObservation = database.prepare(`
    INSERT INTO confirmed_observations (
      lab_session_id, metric_definition_id, original_name, value_text,
      value_numeric, comparator, unit, reference_low, reference_high,
      reference_text, source_text, created_at, specimen,
      specimen_code, source_specimen_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateObservation = database.prepare(`
    UPDATE confirmed_observations
    SET original_name = ?, value_text = ?, value_numeric = ?, comparator = ?,
        unit = ?, reference_low = ?, reference_high = ?, reference_text = ?,
        source_text = ?, specimen = ?, specimen_code = ?, source_specimen_text = ?
    WHERE id = ?
  `);
  const insertLabSessionDocument = database.prepare(`
    INSERT OR IGNORE INTO lab_session_documents (
      lab_session_id, source_document_id, original_file_name,
      laboratory_name, specimen, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertObservationSource = database.prepare(`
    INSERT OR IGNORE INTO confirmed_observation_sources (
      observation_id, source_document_id, original_name, value_text,
      value_numeric, comparator, unit, specimen, reference_low,
      reference_high, reference_text, source_text, created_at, variant_index,
      specimen_code, source_specimen_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const completeImport = database.prepare(`
    UPDATE import_sessions
    SET status = 'confirmed', error_message = NULL,
        confirmed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'needs_review'
  `);
  const insertConfirmationResult = database.prepare(`
    INSERT INTO import_confirmation_results (
      import_session_id, lab_session_id, outcome, added_observations,
      matched_observations, resolved_conflicts, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const touchLabSession = database.prepare(`
    UPDATE lab_sessions SET updated_at = ? WHERE id = ?
  `);
  const readLabSession = database.prepare(`
    SELECT
      l.id, r.import_session_id, l.collected_at, l.laboratory_name,
      l.specimen, l.note, i.confirmed_at, r.outcome,
      r.added_observations, r.matched_observations, r.resolved_conflicts
    FROM import_confirmation_results r
    JOIN lab_sessions l ON l.id = r.lab_session_id
    JOIN import_sessions i ON i.id = r.import_session_id
    WHERE r.import_session_id = ?
  `);
  const readSources = database.prepare(`
    SELECT
      source_document_id, original_file_name, laboratory_name, specimen, note
    FROM lab_session_documents
    WHERE lab_session_id = ?
    ORDER BY created_at, source_document_id
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
        const previous = readConfirmationResult.get(input.importSessionId) as
          | ConfirmationResultRow
          | undefined;
        if (importRow?.status === "confirmed" && previous) {
          database.exec("COMMIT");
          transactionOpen = false;
          return {
            status: "already_confirmed",
            labSessionId: previous.lab_session_id,
            summary: mapSummary(previous),
          };
        }
        if (
          importRow?.status !== "needs_review" ||
          !importRow.source_document_id
        ) {
          database.exec("ROLLBACK");
          transactionOpen = false;
          return { status: "not_reviewable" };
        }
        const reviewableImport = {
          ...importRow,
          source_document_id: importRow.source_document_id,
        };

        const candidates = findCandidates(
          readCandidates.all(
            importRow.profile_id,
            input.collectedAt,
          ) as CandidateRow[],
          input.laboratoryName,
        );
        const candidate = candidates[0] ?? null;
        const existing = candidate
          ? (readExistingObservations.all(candidate.id) as ObservationRow[])
          : [];
        const existingByMetric = new Map(
          existing.map((observation) => [
            observation.metric_definition_id,
            observation,
          ]),
        );
        const target = candidate;

        if (!target) {
          const labSessionId = createLabSession(
            reviewableImport,
            input,
            now,
            insertLabSession,
            insertObservation,
            insertLabSessionDocument,
            insertObservationSource,
          );
          const summary: ConfirmationSummary = {
            outcome: "created",
            addedObservations: input.observations.length,
            matchedObservations: 0,
            resolvedConflicts: 0,
          };
          finishConfirmation(
            input.importSessionId,
            labSessionId,
            summary,
            now,
            completeImport,
            insertConfirmationResult,
          );
          database.exec("COMMIT");
          transactionOpen = false;
          return { status: "confirmed", labSessionId, summary };
        }

        const conflicts = findConflicts(input.observations, existingByMetric);
        const unresolved = conflicts.filter(
          ({ metricDefinitionId }) =>
            !input.conflictResolutions.has(metricDefinitionId),
        );
        if (unresolved.length) {
          database.exec("ROLLBACK");
          transactionOpen = false;
          return { status: "conflicts", conflicts };
        }

        insertDocument(
          target.id,
          reviewableImport,
          input,
          now,
          insertLabSessionDocument,
        );
        let addedObservations = 0;
        let matchedObservations = 0;
        for (const observation of input.observations) {
          const current = existingByMetric.get(observation.metricDefinitionId);
          if (!current) {
            const observationId = addObservation(
              target.id,
              observation,
              now,
              insertObservation,
            );
            addObservationSource(
              observationId,
              reviewableImport.source_document_id,
              observation,
              now,
              insertObservationSource,
            );
            addedObservations += 1;
            continue;
          }

          addObservationSource(
            current.id,
            reviewableImport.source_document_id,
            observation,
            now,
            insertObservationSource,
          );
          if (sameObservation(current, observation)) {
            matchedObservations += 1;
            continue;
          }
          if (
            input.conflictResolutions.get(observation.metricDefinitionId) ===
            "incoming"
          ) {
            updateObservation.run(
              observation.originalName,
              observation.valueText,
              observation.valueNumeric,
              observation.comparator,
              observation.unit,
              observation.referenceLow,
              observation.referenceHigh,
              observation.referenceText,
              observation.sourceText,
              null,
              "unknown",
              null,
              current.id,
            );
          }
        }

        const summary: ConfirmationSummary = {
          outcome: "merged",
          addedObservations,
          matchedObservations,
          resolvedConflicts: conflicts.length,
        };
        touchLabSession.run(now, target.id);
        finishConfirmation(
          input.importSessionId,
          target.id,
          summary,
          now,
          completeImport,
          insertConfirmationResult,
        );
        database.exec("COMMIT");
        transactionOpen = false;
        return { status: "confirmed", labSessionId: target.id, summary };
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
        readExistingObservations.all(session.id) as ObservationRow[]
      ).map(mapObservation);
      const sources = (readSources.all(session.id) as SourceRow[]).map(
        mapSource,
      );
      return mapLabSession(session, observations, sources);
    },
  };
}

function findCandidates(
  candidates: CandidateRow[],
  laboratoryName: string | null,
) {
  const normalized = normalizeDeduplicationText(laboratoryName);
  if (!normalized) return [];
  return candidates.filter(
    (candidate) =>
      normalizeDeduplicationText(candidate.laboratory_name) === normalized,
  );
}

function findConflicts(
  incoming: ValidatedObservation[],
  existing: Map<number, ObservationRow>,
): DeduplicationConflict[] {
  return incoming.flatMap((observation) => {
    const current = existing.get(observation.metricDefinitionId);
    if (!current || sameObservation(current, observation)) return [];
    return [
      {
        metricDefinitionId: observation.metricDefinitionId,
        displayName: current.display_name,
        existing: { valueText: current.value_text, unit: current.unit },
        incoming: { valueText: observation.valueText, unit: observation.unit },
      },
    ];
  });
}

function sameObservation(
  existing: ObservationRow,
  incoming: ValidatedObservation,
) {
  const recovered = existing.value_numeric === null && existing.comparator === null
    ? parseNumericResult(existing.value_text)
    : null;
  const existingNumeric = existing.value_numeric ?? recovered?.valueNumeric ?? null;
  const existingComparator = existing.comparator ?? recovered?.comparator ?? null;
  return (
    existingNumeric === incoming.valueNumeric &&
    (incoming.valueNumeric !== null ||
      existing.value_text === incoming.valueText) &&
    existingComparator === incoming.comparator &&
    normalizeDeduplicationText(existing.unit) ===
      normalizeDeduplicationText(incoming.unit)
  );
}

function createLabSession(
  importRow: ImportRow & { source_document_id: number },
  input: ValidatedConfirmation,
  now: string,
  insertLabSession: ReturnType<DatabaseSync["prepare"]>,
  insertObservation: ReturnType<DatabaseSync["prepare"]>,
  insertDocumentStatement: ReturnType<DatabaseSync["prepare"]>,
  insertSourceStatement: ReturnType<DatabaseSync["prepare"]>,
) {
  const inserted = insertLabSession.run(
    importRow.profile_id,
    input.importSessionId,
    importRow.source_document_id,
    input.collectedAt,
    input.laboratoryName,
    null,
    input.note,
    now,
    now,
  );
  const labSessionId = Number(inserted.lastInsertRowid);
  insertDocument(labSessionId, importRow, input, now, insertDocumentStatement);
  for (const observation of input.observations) {
    const observationId = addObservation(
      labSessionId,
      observation,
      now,
      insertObservation,
    );
    addObservationSource(
      observationId,
      importRow.source_document_id,
      observation,
      now,
      insertSourceStatement,
    );
  }
  return labSessionId;
}

function insertDocument(
  labSessionId: number,
  importRow: ImportRow & { source_document_id: number },
  input: ValidatedConfirmation,
  now: string,
  statement: ReturnType<DatabaseSync["prepare"]>,
) {
  statement.run(
    labSessionId,
    importRow.source_document_id,
    importRow.original_file_name,
    input.laboratoryName,
    null,
    input.note,
    now,
  );
}

function addObservation(
  labSessionId: number,
  observation: ValidatedObservation,
  now: string,
  statement: ReturnType<DatabaseSync["prepare"]>,
) {
  const inserted = statement.run(
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
    null,
    "unknown",
    null,
  );
  return Number(inserted.lastInsertRowid);
}

function addObservationSource(
  observationId: number,
  sourceDocumentId: number,
  observation: ValidatedObservation,
  now: string,
  statement: ReturnType<DatabaseSync["prepare"]>,
) {
  for (const [index, variant] of [
    observation,
    ...(observation.documentAlternatives ?? []),
  ].entries()) {
    statement.run(
      observationId,
      sourceDocumentId,
      variant.originalName,
      variant.valueText,
      variant.valueNumeric,
      variant.comparator,
      variant.unit,
      null,
      variant.referenceLow,
      variant.referenceHigh,
      variant.referenceText,
      variant.sourceText,
      now,
      index,
      "unknown",
      null,
    );
  }
}

function finishConfirmation(
  importSessionId: number,
  labSessionId: number,
  summary: ConfirmationSummary,
  now: string,
  completeImport: ReturnType<DatabaseSync["prepare"]>,
  insertResult: ReturnType<DatabaseSync["prepare"]>,
) {
  const completed = completeImport.run(now, now, importSessionId);
  if (completed.changes !== 1) {
    throw new Error("Import status changed while confirming");
  }
  insertResult.run(
    importSessionId,
    labSessionId,
    summary.outcome,
    summary.addedObservations,
    summary.matchedObservations,
    summary.resolvedConflicts,
    now,
  );
}

export function normalizeDeduplicationText(value: string | null) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
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
    specimen: row.specimen,
    referenceLow: row.reference_low,
    referenceHigh: row.reference_high,
    referenceText: row.reference_text,
    sourceText: row.source_text,
    specimenCode: row.specimen_code,
    sourceSpecimenText: row.source_specimen_text,
    sourceCount: row.source_count,
  };
}

function mapSource(row: SourceRow): ConfirmedSourceDocument {
  return {
    sourceDocumentId: row.source_document_id,
    originalFileName: row.original_file_name,
    laboratoryName: row.laboratory_name,
    specimen: row.specimen,
    note: row.note,
  };
}

function mapSummary(
  row: Omit<ConfirmationResultRow, "lab_session_id">,
): ConfirmationSummary {
  return {
    outcome: row.outcome,
    addedObservations: row.added_observations,
    matchedObservations: row.matched_observations,
    resolvedConflicts: row.resolved_conflicts,
  };
}

function mapLabSession(
  row: LabSessionRow,
  observations: ConfirmedObservation[],
  sources: ConfirmedSourceDocument[],
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
    sources,
    summary: mapSummary(row),
  };
}
