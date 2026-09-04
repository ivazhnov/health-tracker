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
];
