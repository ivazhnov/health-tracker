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
  assert.equal(count(database, "confirmed_observations"), 2);
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
  input.observations[1].metricDefinitionId =
    input.observations[0].metricDefinitionId;

  const result = service.confirm(input);

  assert.equal(result.ok, false);
  assert.match(result.error, /уже есть/);
  assert.equal(count(database, "lab_sessions"), 0);
  assert.equal(count(database, "confirmed_observations"), 0);
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
  assert.equal(count(database, "confirmed_observations"), 0);
  assert.equal(
    database.prepare("SELECT status FROM import_sessions WHERE id = 1").get()
      .status,
    "needs_review",
  );
});

test("matching results merge into one session with multiple sources", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  service.confirm(confirmationInput());
  addImport(database, 2);
  const duplicate = confirmationInput(2);
  duplicate.laboratoryName = "  тестовая—лаборатория  ";

  const result = service.confirm(duplicate);

  assert.equal(result.ok, true);
  assert.equal(result.summary.outcome, "merged");
  assert.equal(result.summary.matchedObservations, 2);
  assert.equal(count(database, "lab_sessions"), 1);
  assert.equal(count(database, "confirmed_observations"), 2);
  assert.equal(count(database, "lab_session_documents"), 2);
  assert.equal(count(database, "confirmed_observation_sources"), 4);
});

test("a partial report adds only new observations", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  const first = confirmationInput();
  first.observations = [first.observations[0]];
  service.confirm(first);
  addImport(database, 2);
  const update = confirmationInput(2);
  update.observations = [
    update.observations[0],
    observation("13", "Глюкоза", "5,2", "ммоль/л", "3,9", "5,6"),
  ];

  const result = service.confirm(update);

  assert.equal(result.ok, true);
  assert.equal(result.summary.addedObservations, 1);
  assert.equal(result.summary.matchedObservations, 1);
  assert.equal(count(database, "lab_sessions"), 1);
  assert.equal(count(database, "confirmed_observations"), 2);
  assert.equal(count(database, "confirmed_observation_sources"), 3);
});

test("conflicts require a choice and preserve both source values", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const first = confirmationInput();
  first.observations = [first.observations[0]];
  service.confirm(first);
  addImport(database, 2);
  const conflicting = confirmationInput(2);
  conflicting.observations = [
    observation("1", "Холестерин ЛПНП", "3,4", "ммоль/л", "0", "3"),
  ];

  const unresolved = service.confirm(conflicting);

  assert.equal(unresolved.ok, false);
  assert.equal(unresolved.conflicts.length, 1);
  assert.equal(count(database, "lab_session_documents"), 1);
  assert.equal(count(database, "confirmed_observation_sources"), 1);
  assert.equal(importStatus(database, 2), "needs_review");

  conflicting.conflictResolutions = [
    { metricDefinitionId: "1", choice: "existing" },
  ];
  const resolved = service.confirm(conflicting);

  assert.equal(resolved.ok, true);
  assert.equal(resolved.summary.resolvedConflicts, 1);
  assert.equal(repository.getConfirmed(2).observations[0].valueNumeric, 3.1);
  assert.deepEqual(
    database
      .prepare(
        `
        SELECT value_numeric FROM confirmed_observation_sources ORDER BY value_numeric
      `,
      )
      .all()
      .map(({ value_numeric }) => value_numeric),
    [3.1, 3.4],
  );
});

test("choosing the incoming conflict changes only the main value", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const first = confirmationInput();
  first.observations = [first.observations[0]];
  service.confirm(first);
  addImport(database, 2);
  const conflicting = confirmationInput(2);
  conflicting.observations = [
    observation("1", "Холестерин ЛПНП", "3,4", "ммоль/л", "0", "3"),
  ];
  conflicting.conflictResolutions = [
    { metricDefinitionId: "1", choice: "incoming" },
  ];

  service.confirm(conflicting);

  assert.equal(repository.getConfirmed(2).observations[0].valueNumeric, 3.4);
  assert.equal(count(database, "confirmed_observation_sources"), 2);
});

test("reconfirming the same source does not duplicate source links", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  service.confirm(confirmationInput());
  addImport(database, 2, 1);

  const result = service.confirm(confirmationInput(2));

  assert.equal(result.ok, true);
  assert.equal(count(database, "lab_sessions"), 1);
  assert.equal(count(database, "lab_session_documents"), 1);
  assert.equal(count(database, "confirmed_observation_sources"), 2);
  assert.equal(count(database, "import_confirmation_results"), 2);
});

test("the same metric in a different material stays in a separate session", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  const first = confirmationInput();
  first.observations = [first.observations[0]];
  service.confirm(first);
  addImport(database, 2);
  const second = confirmationInput(2);
  second.specimen = "Моча";
  second.observations = [second.observations[0]];

  const result = service.confirm(second);

  assert.equal(result.ok, true);
  assert.equal(result.summary.outcome, "created");
  assert.equal(count(database, "lab_sessions"), 2);
});

test("repeated reports select the session with the matching material", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  const first = confirmationInput();
  assert.equal(service.confirm(first).ok, true);
  addImport(database, 2);
  const second = confirmationInput(2);
  second.specimen = "Моча";
  assert.equal(service.confirm(second).ok, true);
  addImport(database, 3);
  const repeat = confirmationInput(3);
  repeat.specimen = "Моча";
  const result = service.confirm(repeat);
  assert.equal(result.ok, true);
  assert.equal(result.summary.outcome, "merged");
  assert.equal(result.labSessionId, 2);
  assert.equal(count(database, "lab_sessions"), 2);
  assert.equal(count(database, "confirmed_observations"), 4);
  assert.equal(count(database, "confirmed_observation_sources"), 6);
});

test("migration 6 backfills sources for stage 5 confirmations", () => {
  const database = createDatabase(5);
  const now = new Date().toISOString();
  database
    .prepare(
      `
      INSERT INTO lab_sessions (
        profile_id, import_session_id, source_document_id, collected_at,
        laboratory_name, specimen, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(1, 1, 1, "2026-09-04", "Тестовая лаборатория", "Кровь", "", now, now);
  database
    .prepare(
      `
      INSERT INTO observations (
        lab_session_id, metric_definition_id, original_name, value_text,
        value_numeric, comparator, unit, reference_low, reference_high,
        reference_text, source_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      1,
      1,
      "Холестерин ЛПНП",
      "3.1",
      3.1,
      null,
      "ммоль/л",
      0,
      3,
      null,
      "",
      now,
    );
  database
    .prepare(
      `
      UPDATE import_sessions
      SET status = 'confirmed', confirmed_at = ?, updated_at = ?
      WHERE id = 1
    `,
    )
    .run(now, now);

  for (const migration of migrations.filter(({ version }) => version >= 6)) {
    database.exec(migration.sql);
  }

  assert.equal(count(database, "lab_session_documents"), 1);
  assert.equal(count(database, "confirmed_observation_sources"), 1);
  assert.equal(count(database, "import_confirmation_results"), 1);
  assert.equal(
    database.prepare("SELECT specimen FROM observations WHERE id = 1").get()
      .specimen,
    "Кровь",
  );
  assert.equal(
    createSqliteConfirmationRepository(database).getConfirmed(1).summary
      .outcome,
    "created",
  );
});

test("document duplicates require an explicit valid choice and retain all variants", () => {
  for (const selected of [0, 2]) {
    const database = createDatabase();
    const repository = createSqliteConfirmationRepository(database);
    const service = createConfirmationService(repository);
    const input = confirmationInput();
    input.observations.push(
      observation("1", "LDL repeat", "3.2", "ммоль/л", "1", "4"),
    );
    for (const rowIndex of ["", "1", "-1", "999", "0.5"]) {
      input.duplicateResolutions = [{ metricDefinitionId: "1", rowIndex }];
      assert.equal(service.confirm(input).ok, false);
      assert.equal(count(database, "confirmed_observations"), 0);
    }
    input.duplicateResolutions = [
      { metricDefinitionId: "1", rowIndex: String(selected) },
    ];
    assert.equal(service.confirm(input).ok, true);
    assert.equal(service.confirm(input).alreadyConfirmed, true);
    assert.equal(count(database, "confirmed_observations"), 2);
    assert.equal(count(database, "confirmed_observation_sources"), 3);
    const saved = repository.getConfirmed(1).observations[0];
    assert.equal(saved.valueNumeric, selected === 0 ? 3.1 : 3.2);
    assert.equal(saved.sourceCount, 1);
    assert.deepEqual(
      database
        .prepare(
          `SELECT value_numeric, reference_low, reference_high
      FROM confirmed_observation_sources WHERE observation_id = ? ORDER BY value_numeric`,
        )
        .all(saved.id)
        .map((row) => ({ ...row })),
      [
        { value_numeric: 3.1, reference_low: 0, reference_high: 3 },
        { value_numeric: 3.2, reference_low: 1, reference_high: 4 },
      ],
    );
    database.close();
  }
});

test("text results remain text and differing text requires conflict resolution", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const input = confirmationInput();
  input.observations = [
    { ...input.observations[0], valueKind: "text", valueText: "Отрицательно" },
  ];
  assert.equal(service.confirm(input).ok, true);
  const saved = repository.getConfirmed(1).observations[0];
  assert.equal(saved.valueNumeric, null);
  assert.equal(saved.valueText, "Отрицательно");
  assert.equal(saved.comparator, null);
  addImport(database, 2);
  assert.equal(
    service.confirm({ ...input, importSessionId: 2 }).summary
      .matchedObservations,
    1,
  );
  addImport(database, 3);
  const changed = {
    ...input,
    importSessionId: 3,
    observations: [{ ...input.observations[0], valueText: "Положительно" }],
  };
  assert.equal(service.confirm(changed).conflicts.length, 1);
  assert.equal(importStatus(database, 3), "needs_review");
  changed.conflictResolutions = [
    { metricDefinitionId: "1", choice: "incoming" },
  ];
  assert.equal(service.confirm(changed).ok, true);
  assert.equal(
    repository.getConfirmed(3).observations[0].valueText,
    "Положительно",
  );
  assert.equal(count(database, "confirmed_observation_sources"), 3);
  database.close();
});

test("invalid numbers are not silently accepted as text", () => {
  const database = createDatabase();
  const service = createConfirmationService(
    createSqliteConfirmationRepository(database),
  );
  const input = confirmationInput();
  for (const valueText of ["", "3..1", "abc", "Infinity", "9".repeat(400)]) {
    input.observations[0].valueText = valueText;
    assert.equal(service.confirm(input).ok, false);
  }
  input.observations[0].valueKind = "text";
  for (const valueText of [" ", "a".repeat(201)]) {
    input.observations[0].valueText = valueText;
    assert.equal(service.confirm(input).ok, false);
  }
  assert.equal(count(database, "confirmed_observations"), 0);
  database.close();
});

test("each result keeps canonical and source specimen independently", () => {
  const database = createDatabase();
  const repository = createSqliteConfirmationRepository(database);
  const service = createConfirmationService(repository);
  const input = confirmationInput();
  input.specimen = "";
  input.observations[0].specimenCode = "serum";
  input.observations[0].sourceSpecimenText = "Serum (SST)";
  input.observations[1].specimenCode = "urine";
  input.observations[1].sourceSpecimenText = "Random urine";

  assert.equal(service.confirm(input).ok, true);
  assert.deepEqual(
    repository
      .getConfirmed(1)
      .observations.map(({ specimen, specimenCode, sourceSpecimenText }) => ({
        specimen,
        specimenCode,
        sourceSpecimenText,
      })),
    [
      {
        specimen: "Сыворотка",
        specimenCode: "serum",
        sourceSpecimenText: "Serum (SST)",
      },
      {
        specimen: "Моча",
        specimenCode: "urine",
        sourceSpecimenText: "Random urine",
      },
    ],
  );
  assert.deepEqual(
    database
      .prepare(
        "SELECT specimen_code, source_specimen_text FROM confirmed_observation_sources ORDER BY observation_id",
      )
      .all()
      .map((row) => ({ ...row })),
    [
      { specimen_code: "serum", source_specimen_text: "Serum (SST)" },
      { specimen_code: "urine", source_specimen_text: "Random urine" },
    ],
  );
  database.close();
});

function createDatabase(maxMigrationVersion = Number.POSITIVE_INFINITY) {
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
    if (migration.version <= maxMigrationVersion) database.exec(migration.sql);
  }

  const now = new Date().toISOString();
  database
    .prepare(
      `
      INSERT INTO profiles (
        first_name, last_name, date_of_birth, sex_at_birth, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run("Тест", "Профиль", "1990-01-01", "male", "", now, now);
  database
    .prepare(
      `
      INSERT INTO source_documents (
        sha256, storage_path, media_type, size_bytes, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(
      "a".repeat(64),
      `documents/aa/${"a".repeat(64)}`,
      "text/plain",
      100,
      now,
    );
  database
    .prepare(
      `
      INSERT INTO import_sessions (
        profile_id, source_document_id, original_file_name, media_type,
        size_bytes, sha256, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      1,
      1,
      "analysis.txt",
      "text/plain",
      100,
      "a".repeat(64),
      "needs_review",
      now,
      now,
    );
  return database;
}

function confirmationInput(importSessionId = 1) {
  return {
    importSessionId,
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

function addImport(database, importSessionId, sourceDocumentId) {
  const now = new Date().toISOString();
  let documentId = sourceDocumentId;
  if (!documentId) {
    const hash = String(importSessionId).padStart(64, "0");
    documentId = Number(
      database
        .prepare(
          `
          INSERT INTO source_documents (
            sha256, storage_path, media_type, size_bytes, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(hash, `documents/${hash}`, "text/plain", 100, now).lastInsertRowid,
    );
  }
  const hash = database
    .prepare("SELECT sha256 FROM source_documents WHERE id = ?")
    .get(documentId).sha256;
  database
    .prepare(
      `
      INSERT INTO import_sessions (
        id, profile_id, source_document_id, original_file_name, media_type,
        size_bytes, sha256, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      importSessionId,
      1,
      documentId,
      `analysis-${importSessionId}.txt`,
      "text/plain",
      100,
      hash,
      "needs_review",
      now,
      now,
    );
}

function observation(
  metricDefinitionId,
  originalName,
  valueText,
  unit,
  low,
  high,
) {
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

function importStatus(database, importSessionId) {
  return database
    .prepare("SELECT status FROM import_sessions WHERE id = ?")
    .get(importSessionId).status;
}
