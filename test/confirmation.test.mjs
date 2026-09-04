import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createConfirmationService } from "../src/server/confirmation-service.ts";
import { createSqliteConfirmationRepository } from "../src/server/database/sqlite-confirmation.ts";
import { migrations } from "../src/server/database/migrations.ts";

test("confirmation is atomic and idempotent", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const input = confirmationInput();

  const first = service.confirm(input);
  const second = service.confirm(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.alreadyConfirmed, true);
  assert.equal(count(database, "lab_sessions"), 1);
  assert.equal(count(database, "observations"), 2);
  assert.equal(
    database.prepare("SELECT status FROM import_sessions WHERE id = 1").get()
      .status,
    "confirmed",
  );

  const saved = repository.getConfirmed(1);
  assert.equal(saved?.note, "После простуды");
  assert.equal(saved?.observations[0].valueNumeric, 3.1);
  assert.equal(saved?.observations[1].displayName, "Креатинин");
});

test("invalid rows do not create partial confirmed data", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const input = confirmationInput();
  input.observations[1].metricDefinitionId = input.observations[0].metricDefinitionId;

  const result = service.confirm(input);

  assert.equal(result.ok, false);
  assert.match(result.error, /уже есть/);
  assert.equal(count(database, "lab_sessions"), 0);
  assert.equal(count(database, "observations"), 0);
  assert.equal(
    database.prepare("SELECT status FROM import_sessions WHERE id = 1").get()
      .status,
    "needs_review",
  );
});

test("invalid calendar dates return a validation error", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  const input = confirmationInput();
  input.collectedAt = "2026-99-99";

  const result = service.confirm(input);

  assert.equal(result.ok, false);
  assert.match(result.error, /корректную дату/);
  assert.equal(count(database, "lab_sessions"), 0);
});

test("database errors roll back the whole confirmation", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const input = {
    importSessionId: 1,
    collectedAt: "2026-09-04",
    laboratoryName: "Тестовая лаборатория",
    specimen: "Кровь",
    note: "",
    observations: [
      {
        metricDefinitionId: 1,
        originalName: "Холестерин ЛПНП",
        valueText: "3.1",
        valueNumeric: 3.1,
        comparator: null,
        unit: "ммоль/л",
        referenceLow: 0,
        referenceHigh: 3,
        referenceText: null,
        sourceText: "Холестерин ЛПНП 3,1 ммоль/л",
      },
      {
        metricDefinitionId: 999,
        originalName: "Несуществующий показатель",
        valueText: "1",
        valueNumeric: 1,
        comparator: null,
        unit: null,
        referenceLow: null,
        referenceHigh: null,
        referenceText: null,
        sourceText: "Несуществующий показатель 1",
      },
    ],
  };

  assert.throws(() => repository.confirm(input), /FOREIGN KEY/);
  assert.equal(count(database, "lab_sessions"), 0);
  assert.equal(count(database, "observations"), 0);
  assert.equal(
    database.prepare("SELECT status FROM import_sessions WHERE id = 1").get()
      .status,
    "needs_review",
  );
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
  for (const migration of migrations) database.exec(migration.sql);

  const now = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO profiles (
        first_name, last_name, date_of_birth, sex_at_birth, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run("Тест", "Профиль", "1990-01-01", "male", "", now, now);
  database
    .prepare(`
      INSERT INTO source_documents (
        sha256, storage_path, media_type, size_bytes, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `)
    .run("a".repeat(64), `documents/aa/${"a".repeat(64)}`, "text/plain", 100, now);
  database
    .prepare(`
      INSERT INTO import_sessions (
        profile_id, source_document_id, original_file_name, media_type,
        size_bytes, sha256, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(1, 1, "analysis.txt", "text/plain", 100, "a".repeat(64), "needs_review", now, now);
  return database;
}

function confirmationInput() {
  return {
    importSessionId: 1,
    collectedAt: "2026-09-04",
    laboratoryName: "Тестовая лаборатория",
    specimen: "Кровь",
    note: "После простуды",
    observations: [
      observation("1", "Холестерин ЛПНП", "3,1", "ммоль/л", "0", "3"),
      observation("5", "Креатинин", "90", "мкмоль/л", "60", "110"),
    ],
  };
}

function observation(metricDefinitionId, originalName, valueText, unit, low, high) {
  return {
    metricDefinitionId,
    originalName,
    valueText,
    unit,
    referenceLow: low,
    referenceHigh: high,
    referenceText: "",
    sourceText: `${originalName} ${valueText} ${unit}`,
  };
}

function count(database, table) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}
