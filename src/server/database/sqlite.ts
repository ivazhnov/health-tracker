import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  ApplicationStatus,
  ApplicationStatusRepository,
} from "@/server/application-status";
import { migrations } from "./migrations";

const globalDatabase = globalThis as typeof globalThis & {
  healthArchiveDatabase?: DatabaseSync;
};

export function getDatabase() {
  if (!globalDatabase.healthArchiveDatabase) {
    const dataDirectory = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
    mkdirSync(dataDirectory, { recursive: true });

    const database = new DatabaseSync(
      path.join(dataDirectory, "archive.sqlite3"),
    );

    database.exec("PRAGMA foreign_keys = ON");
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA synchronous = NORMAL");
    database.exec("PRAGMA busy_timeout = 5000");
    applyMigrations(database);

    globalDatabase.healthArchiveDatabase = database;
  }

  return globalDatabase.healthArchiveDatabase;
}

export function createSqliteApplicationStatusRepository(
  database: DatabaseSync,
): ApplicationStatusRepository {
  const readMetadata = database.prepare(
    "SELECT value FROM application_metadata WHERE key = ?",
  );
  const readSchemaVersion = database.prepare(
    "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
  );

  return {
    get(): ApplicationStatus {
      const installationId = readMetadata.get("installation_id") as
        | { value: string }
        | undefined;
      const createdAt = readMetadata.get("created_at") as
        | { value: string }
        | undefined;
      const schema = readSchemaVersion.get() as { version: number };

      if (!installationId || !createdAt) {
        throw new Error("Application metadata is incomplete");
      }

      return {
        installationId: installationId.value,
        createdAt: createdAt.value,
        schemaVersion: schema.version,
      };
    },
  };
}

function applyMigrations(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = database
    .prepare("SELECT version FROM schema_migrations")
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map(({ version }) => version));
  const recordMigration = database.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `);

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      recordMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
