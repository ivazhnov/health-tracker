export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_application_metadata",
    sql: `
      CREATE TABLE application_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT INTO application_metadata (key, value)
      VALUES ('installation_id', lower(hex(randomblob(16))));

      INSERT INTO application_metadata (key, value)
      VALUES ('created_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `,
  },
  {
    version: 2,
    name: "profiles_and_body_measurements",
    sql: `
      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        date_of_birth TEXT NOT NULL,
        sex_at_birth TEXT NOT NULL CHECK (sex_at_birth IN ('male', 'female')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE body_measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        measured_at TEXT NOT NULL,
        height_cm REAL,
        weight_kg REAL,
        created_at TEXT NOT NULL,
        CHECK (height_cm IS NOT NULL OR weight_kg IS NOT NULL),
        UNIQUE (profile_id, measured_at)
      );

      CREATE INDEX body_measurements_profile_date
      ON body_measurements (profile_id, measured_at DESC);
    `,
  },
  {
    version: 3,
    name: "source_documents_and_import_sessions",
    sql: `
      CREATE TABLE source_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sha256 TEXT NOT NULL UNIQUE,
        storage_path TEXT NOT NULL UNIQUE,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE import_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        source_document_id INTEGER REFERENCES source_documents(id),
        duplicate_of_import_session_id INTEGER REFERENCES import_sessions(id),
        original_file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('uploaded', 'extracting', 'needs_review', 'confirmed', 'failed')
        ),
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX import_sessions_profile_created
      ON import_sessions (profile_id, created_at DESC, id DESC);

      CREATE INDEX import_sessions_document
      ON import_sessions (source_document_id);
    `,
  },
];
