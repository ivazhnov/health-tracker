import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createSqliteImportRepository } from "../src/server/database/sqlite-imports.ts";
import { migrations } from "../src/server/database/migrations.ts";

test("an identical file reuses its source document", () => {
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
  }

  const now = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO profiles (
        first_name, last_name, date_of_birth, sex_at_birth, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run("Тест", "Профиль", "1990-01-01", "male", "", now, now);

  const repository = createSqliteImportRepository(database);
  const input = {
    profileId: 1,
    originalFileName: "analysis.pdf",
    mediaType: "application/pdf",
    sizeBytes: 128,
    sha256: "a".repeat(64),
    storagePath: `documents/aa/${"a".repeat(64)}`,
  };

  const firstId = repository.createUploaded(input);
  const secondId = repository.createUploaded(input);
  const sourceCount = database
    .prepare("SELECT COUNT(*) AS count FROM source_documents")
    .get().count;

  assert.equal(sourceCount, 1);
  assert.equal(repository.get(firstId)?.duplicateOfImportSessionId, null);
  assert.equal(repository.get(secondId)?.duplicateOfImportSessionId, firstId);
  assert.equal(
    repository.get(firstId)?.sourceDocumentId,
    repository.get(secondId)?.sourceDocumentId,
  );
});
