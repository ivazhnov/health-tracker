import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildChartGeometry } from "../src/app/metrics/chart-geometry.ts";
import {
  createSqliteFavoriteMetricCommandRepository,
  createSqliteMetricHistoryQueryRepository,
} from "../src/server/database/sqlite-metric-history.ts";
import { migrations } from "../src/server/database/migrations.ts";

test("metric history stays inside a profile and keeps every source", () => {
  const database = createDatabase();
  seedHistory(database);
  const queries = createSqliteMetricHistoryQueryRepository(database);

  assert.deepEqual(queries.getArchiveStats(1), {
    labSessionCount: 2,
    observationCount: 3,
    documentCount: 3,
  });
  assert.equal(queries.listProfileMetrics(1).find(({ key }) => key === "ldl").observationCount, 2);
  assert.equal(queries.getMetricHistory(1, 1).observations.length, 2);
  assert.equal(queries.getMetricHistory(1, 1).observations[1].sources.length, 2);
  assert.equal(queries.getMetricHistory(2, 1).observations.length, 1);
  assert.equal(queries.getMetricHistory(1, 3), null);
});

test("favorites can be added, removed and reordered", () => {
  const database = createDatabase();
  seedHistory(database);
  const commands = createSqliteFavoriteMetricCommandRepository(database);
  const queries = createSqliteMetricHistoryQueryRepository(database);

  assert.equal(commands.add(1, 1), true);
  assert.equal(commands.add(1, 5), true);
  assert.equal(commands.add(1, 16), false);
  commands.move(1, 5, "up");

  assert.deepEqual(
    queries.listProfileMetrics(1)
      .filter(({ favoriteOrder }) => favoriteOrder !== null)
      .sort((a, b) => a.favoriteOrder - b.favoriteOrder)
      .map(({ key }) => key),
    ["creatinine", "ldl"],
  );

  commands.remove(1, 5);
  assert.deepEqual(
    queries.listProfileMetrics(1)
      .filter(({ favoriteOrder }) => favoriteOrder !== null)
      .map(({ key }) => key),
    ["ldl"],
  );
});

test("chart geometry handles one point and equal values", () => {
  const one = buildChartGeometry([point(1, 3.1)], 320, 110, 12);
  assert.equal(one.points[0].x, 160);
  assert.ok(Number.isFinite(one.points[0].y));

  const oneWithReference = point(1, 3.1);
  oneWithReference.referenceLow = 2;
  oneWithReference.referenceHigh = 4;
  assert.ok(buildChartGeometry([oneWithReference], 320, 110, 12).referenceArea);

  const equal = buildChartGeometry([point(1, 3.1), point(2, 3.1)], 760, 280, 28);
  assert.equal(equal.points[0].y, equal.points[1].y);
  assert.ok(equal.max > equal.min);
});

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  for (const migration of migrations) {
    database.exec(migration.sql);
    database.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)
    `).run(migration.version, migration.name, "2026-09-04T00:00:00.000Z");
  }
  return database;
}

function seedHistory(database) {
  database.exec(`
    INSERT INTO profiles (
      id, first_name, last_name, date_of_birth, sex_at_birth, notes, created_at, updated_at
    ) VALUES
      (1, 'Иван', '', '1985-01-01', 'male', '', '2026-09-04', '2026-09-04'),
      (2, 'Анна', '', '1987-01-01', 'female', '', '2026-09-04', '2026-09-04');

    INSERT INTO source_documents (id, sha256, storage_path, media_type, size_bytes, created_at) VALUES
      (1, 'sha1', 'documents/1.txt', 'text/plain', 1, '2026-09-04'),
      (2, 'sha2', 'documents/2.txt', 'text/plain', 1, '2026-09-04'),
      (3, 'sha3', 'documents/3.txt', 'text/plain', 1, '2026-09-04'),
      (4, 'sha4', 'documents/4.txt', 'text/plain', 1, '2026-09-04');

    INSERT INTO import_sessions (
      id, profile_id, source_document_id, original_file_name, media_type,
      size_bytes, sha256, status, created_at, updated_at, confirmed_at
    ) VALUES
      (1, 1, 1, 'ldl-2024.txt', 'text/plain', 1, 'sha1', 'confirmed', '2026-09-04', '2026-09-04', '2026-09-04'),
      (2, 1, 2, 'ldl-2025.txt', 'text/plain', 1, 'sha2', 'confirmed', '2026-09-04', '2026-09-04', '2026-09-04'),
      (3, 2, 3, 'wife-ldl.txt', 'text/plain', 1, 'sha3', 'confirmed', '2026-09-04', '2026-09-04', '2026-09-04');

    INSERT INTO lab_sessions (
      id, profile_id, import_session_id, source_document_id, collected_at,
      laboratory_name, specimen, note, created_at, updated_at
    ) VALUES
      (1, 1, 1, 1, '2024-01-10', 'Lab', 'Кровь', '', '2026-09-04', '2026-09-04'),
      (2, 1, 2, 2, '2025-01-10', 'Lab', 'Кровь', 'После простуды', '2026-09-04', '2026-09-04'),
      (3, 2, 3, 3, '2025-02-10', 'Lab', 'Кровь', '', '2026-09-04', '2026-09-04');

    INSERT INTO observations (
      id, lab_session_id, metric_definition_id, original_name, value_text,
      value_numeric, unit, reference_low, reference_high, source_text, created_at, specimen
    ) VALUES
      (1, 1, 1, 'LDL', '3.4', 3.4, 'ммоль/л', 0, 3, '', '2026-09-04', 'Кровь'),
      (2, 2, 1, 'LDL', '2.8', 2.8, 'ммоль/л', 0, 3, '', '2026-09-04', 'Кровь'),
      (3, 2, 5, 'Креатинин', '90', 90, 'мкмоль/л', 60, 110, '', '2026-09-04', 'Кровь'),
      (4, 3, 1, 'LDL', '2.1', 2.1, 'ммоль/л', 0, 3, '', '2026-09-04', 'Кровь');

    INSERT INTO lab_session_documents (
      lab_session_id, source_document_id, original_file_name, laboratory_name, specimen, note, created_at
    ) VALUES
      (1, 1, 'ldl-2024.txt', 'Lab', 'Кровь', '', '2026-09-04'),
      (2, 2, 'ldl-2025.txt', 'Lab', 'Кровь', 'После простуды', '2026-09-04'),
      (2, 4, 'ornament-2025.txt', 'Lab', 'Кровь', '', '2026-09-04'),
      (3, 3, 'wife-ldl.txt', 'Lab', 'Кровь', '', '2026-09-04');

    INSERT INTO observation_sources (
      observation_id, source_document_id, original_name, value_text, value_numeric,
      unit, specimen, reference_low, reference_high, source_text, created_at
    ) VALUES
      (1, 1, 'LDL', '3.4', 3.4, 'ммоль/л', 'Кровь', 0, 3, '', '2026-09-04'),
      (2, 2, 'LDL', '2.8', 2.8, 'ммоль/л', 'Кровь', 0, 3, '', '2026-09-04'),
      (2, 4, 'LDL', '2.8', 2.8, 'ммоль/л', 'Кровь', 0, 3, '', '2026-09-04'),
      (3, 2, 'Креатинин', '90', 90, 'мкмоль/л', 'Кровь', 60, 110, '', '2026-09-04'),
      (4, 3, 'LDL', '2.1', 2.1, 'ммоль/л', 'Кровь', 0, 3, '', '2026-09-04');
  `);
}

function point(id, value) {
  return {
    observationId: id,
    collectedAt: "2026-01-01",
    valueNumeric: value,
    valueText: String(value),
    comparator: null,
    unit: "ммоль/л",
    referenceLow: null,
    referenceHigh: null,
    referenceText: null,
  };
}
