import type { DatabaseSync } from "node:sqlite";
import type {
  FavoriteMetricCommandRepository,
  MetricHistory,
  MetricHistoryQueryRepository,
  MetricPoint,
  ObservationSource,
  ProfileMetric,
} from "@/server/metric-history";

type MetricRow = {
  id: number;
  key: string;
  display_name: string;
  category: string;
  default_unit: string | null;
  observation_count: number;
  favorite_order: number | null;
};

type ObservationRow = {
  observation_id: number;
  lab_session_id: number;
  collected_at: string;
  value_numeric: number;
  value_text: string;
  comparator: MetricPoint["comparator"];
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
  reference_text: string | null;
  laboratory_name: string | null;
  specimen: string | null;
  note: string;
};

type SourceRow = {
  observation_id: number;
  source_document_id: number;
  original_file_name: string;
  note: string;
};

export function createSqliteMetricHistoryQueryRepository(
  database: DatabaseSync,
): MetricHistoryQueryRepository {
  const readStats = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lab_sessions WHERE profile_id = ?) AS lab_sessions,
      (SELECT COUNT(*) FROM observations o
        JOIN lab_sessions l ON l.id = o.lab_session_id
        WHERE l.profile_id = ?) AS observations,
      (SELECT COUNT(DISTINCT d.source_document_id)
        FROM lab_session_documents d
        JOIN lab_sessions l ON l.id = d.lab_session_id
        WHERE l.profile_id = ?) AS documents
  `);
  const readMetrics = database.prepare(`
    SELECT
      m.id, m.key, m.display_name, m.category, m.default_unit,
      COUNT(o.id) AS observation_count,
      f.sort_order AS favorite_order
    FROM metric_definitions m
    JOIN observations o ON o.metric_definition_id = m.id
    JOIN lab_sessions l ON l.id = o.lab_session_id AND l.profile_id = ?
    LEFT JOIN favorite_metrics f
      ON f.profile_id = l.profile_id AND f.metric_definition_id = m.id
    GROUP BY m.id
    ORDER BY m.category, m.display_name
  `);
  const readMetric = database.prepare(`
    SELECT id, key, display_name, category, default_unit,
      0 AS observation_count, NULL AS favorite_order
    FROM metric_definitions
    WHERE id = ? AND EXISTS (
      SELECT 1
      FROM observations o
      JOIN lab_sessions l ON l.id = o.lab_session_id
      WHERE o.metric_definition_id = metric_definitions.id AND l.profile_id = ?
    )
  `);
  const readObservations = database.prepare(`
    SELECT
      o.id AS observation_id, l.id AS lab_session_id, l.collected_at,
      o.value_numeric, o.value_text, o.comparator, o.unit,
      o.reference_low, o.reference_high, o.reference_text,
      l.laboratory_name, o.specimen, l.note
    FROM observations o
    JOIN lab_sessions l ON l.id = o.lab_session_id
    WHERE l.profile_id = ? AND o.metric_definition_id = ?
    ORDER BY l.collected_at, o.id
  `);
  const readSources = database.prepare(`
    SELECT
      s.observation_id, s.source_document_id, d.original_file_name, d.note
    FROM observation_sources s
    JOIN observations o ON o.id = s.observation_id
    JOIN lab_sessions l ON l.id = o.lab_session_id
    JOIN lab_session_documents d
      ON d.lab_session_id = l.id
      AND d.source_document_id = s.source_document_id
    WHERE l.profile_id = ? AND o.metric_definition_id = ?
    ORDER BY s.observation_id, s.id
  `);

  return {
    getArchiveStats(profileId) {
      const row = readStats.get(profileId, profileId, profileId) as {
        lab_sessions: number;
        observations: number;
        documents: number;
      };
      return {
        labSessionCount: row.lab_sessions,
        observationCount: row.observations,
        documentCount: row.documents,
      };
    },

    listProfileMetrics(profileId) {
      const metrics = readMetrics.all(profileId) as MetricRow[];
      const observations = readAllMetricObservations(database, profileId);
      return metrics.map((metric) =>
        mapProfileMetric(metric, observations.get(metric.id) ?? []),
      );
    },

    getMetricHistory(profileId, metricId) {
      const metric = readMetric.get(metricId, profileId) as
        | MetricRow
        | undefined;
      if (!metric) return null;

      const rows = readObservations.all(profileId, metricId) as ObservationRow[];
      const sources = groupSources(
        readSources.all(profileId, metricId) as SourceRow[],
      );
      return {
        metric: {
          id: metric.id,
          key: metric.key,
          displayName: metric.display_name,
          category: metric.category,
          defaultUnit: metric.default_unit,
        },
        observations: rows.map((row) => ({
          ...mapPoint(row),
          labSessionId: row.lab_session_id,
          laboratoryName: row.laboratory_name,
          specimen: row.specimen,
          note: row.note,
          sources: sources.get(row.observation_id) ?? [],
        })),
      } satisfies MetricHistory;
    },
  };
}

export function createSqliteFavoriteMetricCommandRepository(
  database: DatabaseSync,
): FavoriteMetricCommandRepository {
  const metricBelongsToProfile = database.prepare(`
    SELECT 1
    FROM observations o
    JOIN lab_sessions l ON l.id = o.lab_session_id
    WHERE l.profile_id = ? AND o.metric_definition_id = ?
    LIMIT 1
  `);
  const nextOrder = database.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
    FROM favorite_metrics
    WHERE profile_id = ?
  `);
  const insert = database.prepare(`
    INSERT OR IGNORE INTO favorite_metrics (
      profile_id, metric_definition_id, sort_order, created_at
    ) VALUES (?, ?, ?, ?)
  `);
  const remove = database.prepare(`
    DELETE FROM favorite_metrics
    WHERE profile_id = ? AND metric_definition_id = ?
  `);
  const readOrdered = database.prepare(`
    SELECT metric_definition_id
    FROM favorite_metrics
    WHERE profile_id = ?
    ORDER BY sort_order, metric_definition_id
  `);
  const updateOrder = database.prepare(`
    UPDATE favorite_metrics SET sort_order = ?
    WHERE profile_id = ? AND metric_definition_id = ?
  `);

  return {
    add(profileId, metricId) {
      if (!metricBelongsToProfile.get(profileId, metricId)) return false;
      const order = nextOrder.get(profileId) as { next_order: number };
      insert.run(
        profileId,
        metricId,
        order.next_order,
        new Date().toISOString(),
      );
      return true;
    },

    remove(profileId, metricId) {
      remove.run(profileId, metricId);
    },

    move(profileId, metricId, direction) {
      const ids = (readOrdered.all(profileId) as Array<{
        metric_definition_id: number;
      }>).map((row) => row.metric_definition_id);
      const index = ids.indexOf(metricId);
      const destination = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || destination < 0 || destination >= ids.length) return;

      [ids[index], ids[destination]] = [ids[destination], ids[index]];
      database.exec("BEGIN IMMEDIATE");
      try {
        ids.forEach((id, order) => updateOrder.run(order, profileId, id));
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function readAllMetricObservations(database: DatabaseSync, profileId: number) {
  const rows = database.prepare(`
    SELECT
      o.metric_definition_id, o.id AS observation_id,
      l.id AS lab_session_id, l.collected_at,
      o.value_numeric, o.value_text, o.comparator, o.unit,
      o.reference_low, o.reference_high, o.reference_text,
      l.laboratory_name, o.specimen, l.note
    FROM observations o
    JOIN lab_sessions l ON l.id = o.lab_session_id
    WHERE l.profile_id = ?
    ORDER BY l.collected_at, o.id
  `).all(profileId) as Array<ObservationRow & { metric_definition_id: number }>;
  const grouped = new Map<number, ObservationRow[]>();
  for (const row of rows) {
    const metricRows = grouped.get(row.metric_definition_id) ?? [];
    metricRows.push(row);
    grouped.set(row.metric_definition_id, metricRows);
  }
  return grouped;
}

function mapProfileMetric(
  metric: MetricRow,
  rows: ObservationRow[],
): ProfileMetric {
  const points = rows.map(mapPoint);
  return {
    id: metric.id,
    key: metric.key,
    displayName: metric.display_name,
    category: metric.category,
    defaultUnit: metric.default_unit,
    observationCount: metric.observation_count,
    latest: points.at(-1)!,
    favoriteOrder: metric.favorite_order,
    points,
  };
}

function mapPoint(row: ObservationRow): MetricPoint {
  return {
    specimen: row.specimen,
    observationId: row.observation_id,
    collectedAt: row.collected_at,
    valueNumeric: row.value_numeric,
    valueText: row.value_text,
    comparator: row.comparator,
    unit: row.unit,
    referenceLow: row.reference_low,
    referenceHigh: row.reference_high,
    referenceText: row.reference_text,
  };
}

function groupSources(rows: SourceRow[]) {
  const grouped = new Map<number, ObservationSource[]>();
  for (const row of rows) {
    const sources = grouped.get(row.observation_id) ?? [];
    sources.push({
      documentId: row.source_document_id,
      fileName: row.original_file_name,
      note: row.note,
    });
    grouped.set(row.observation_id, sources);
  }
  return grouped;
}
