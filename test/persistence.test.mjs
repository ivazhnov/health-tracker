import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations, migrations } from "../src/server/database/migrations.ts";
import { createSqliteProfileRepository } from "../src/server/database/sqlite-profiles.ts";
import { createSqliteConfirmationRepository } from "../src/server/database/sqlite-confirmation.ts";
import { createSqliteFavoriteMetricCommandRepository, createSqliteMetricHistoryQueryRepository } from "../src/server/database/sqlite-metric-history.ts";
import { createLocalDocumentStorage } from "../src/server/document-storage.ts";

test("schema 6 upgrades and reopens without losing results, sources or favourites", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "health-persistence-"));
  let database;
  try {
    const filename = path.join(directory, "archive.sqlite3");
    database = new DatabaseSync(filename);
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL");
    database.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
    for (const migration of migrations.filter(({ version }) => version <= 6)) {
      database.exec(migration.sql);
      database.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?)")
        .run(migration.version, migration.name, "2026-09-05");
    }
    database.exec(`
      INSERT INTO profiles (id, first_name, last_name, date_of_birth, sex_at_birth,
        notes, created_at, updated_at)
      VALUES (1, 'Синтетический', 'Профиль', '1990-01-01', 'male', '', '2026-09-05', '2026-09-05')
    `);
    const profileId = 1;
    const contents = Buffer.from("Synthetic LDL 3.1 mmol/l");
    const hash = createHash("sha256").update(contents).digest("hex");
    const storage = createLocalDocumentStorage(directory);
    const storagePath = await storage.save(hash, contents);
    database.prepare(`
      INSERT INTO source_documents (id, sha256, storage_path, media_type, size_bytes, created_at)
      VALUES (1, ?, ?, 'text/plain', ?, '2026-09-05')
    `).run(hash, storagePath, contents.length);
    database.prepare(`
      INSERT INTO import_sessions (id, profile_id, source_document_id, original_file_name,
        media_type, size_bytes, sha256, status, created_at, updated_at)
      VALUES (1, ?, 1, 'synthetic.txt', 'text/plain', ?, ?, 'needs_review', '2026-09-05', '2026-09-05')
    `).run(profileId, contents.length, hash);
    // Seed the previous schema directly: the current repository uses schema 8.
    database.exec(`
      INSERT INTO lab_sessions (id, profile_id, import_session_id, source_document_id,
        collected_at, laboratory_name, specimen, note, created_at, updated_at)
      VALUES (1, 1, 1, 1, '2025-01-01', 'Synthetic Lab', 'Кровь', 'Синтетическая заметка', '2026-09-05', '2026-09-05');
      INSERT INTO observations (id, lab_session_id, metric_definition_id, original_name,
        value_text, value_numeric, source_text, created_at, specimen)
      VALUES (1, 1, 1, 'LDL', '3.1', 3.1, '', '2026-09-05', 'Кровь');
      INSERT INTO observation_sources (observation_id, source_document_id, original_name,
        value_text, value_numeric, created_at) VALUES (1, 1, 'LDL', '3.1', 3.1, '2026-09-05');
      INSERT INTO lab_session_documents (lab_session_id, source_document_id, original_file_name,
        note, created_at) VALUES (1, 1, 'synthetic.txt', 'Синтетическая заметка', '2026-09-05');
      UPDATE import_sessions SET status = 'confirmed', confirmed_at = '2026-09-05' WHERE id = 1;
      INSERT INTO import_confirmation_results VALUES (1, 1, 'created', 1, 0, 0, '2026-09-05');
    `);
    const installation = database.prepare("SELECT value FROM application_metadata WHERE key = 'installation_id'").get().value;
    applyMigrations(database);
    createSqliteFavoriteMetricCommandRepository(database).add(profileId, 1);
    database.close();
    database = new DatabaseSync(filename);
    database.exec("PRAGMA foreign_keys = ON");
    applyMigrations(database);
    applyMigrations(database);
    assert.equal(database.prepare("SELECT COUNT(*) count FROM schema_migrations").get().count, migrations.length);
    assert.equal(database.prepare("SELECT value FROM application_metadata WHERE key = 'installation_id'").get().value, installation);
    const queries = createSqliteMetricHistoryQueryRepository(database);
    const history = queries.getMetricHistory(profileId, 1);
    assert.equal(history.observations.length, 1);
    assert.equal(history.observations[0].valueNumeric, 3.1);
    assert.equal(createSqliteConfirmationRepository(database).getConfirmed(1).observations[0].id, 1);
    assert.equal(database.prepare("SELECT value_numeric FROM observations WHERE id = 1").get().value_numeric, 3.1);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(history.observations[0].sources[0].note, "Синтетическая заметка");
    assert.equal(queries.listProfileMetrics(profileId)[0].favoriteOrder, 0);
    const migratedProfile = createSqliteProfileRepository(database).get(profileId);
    assert.equal(migratedProfile.slug, "person-1");
    assert.equal(createSqliteProfileRepository(database).getBySlug(migratedProfile.slug).id, profileId);
    assert.deepEqual(await storage.read(storagePath), contents);
    assert.equal(database.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally {
    database?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
