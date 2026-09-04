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
  {
    version: 4,
    name: "recognition_drafts_and_metric_catalog",
    sql: `
      CREATE TABLE metric_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        default_unit TEXT
      );

      CREATE TABLE metric_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_definition_id INTEGER NOT NULL REFERENCES metric_definitions(id),
        language TEXT NOT NULL,
        alias TEXT NOT NULL,
        UNIQUE (language, alias)
      );

      CREATE TABLE import_extractions (
        import_session_id INTEGER PRIMARY KEY REFERENCES import_sessions(id) ON DELETE CASCADE,
        recognition_version TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        detected_language TEXT NOT NULL,
        laboratory_name TEXT,
        collected_at TEXT,
        specimen TEXT,
        warnings_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE observation_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_session_id INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
        metric_definition_id INTEGER REFERENCES metric_definitions(id),
        original_name TEXT NOT NULL,
        value_text TEXT NOT NULL,
        unit TEXT,
        reference_low TEXT,
        reference_high TEXT,
        reference_text TEXT,
        confidence REAL NOT NULL,
        source_text TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX observation_drafts_import
      ON observation_drafts (import_session_id, sort_order);

      INSERT INTO metric_definitions (key, display_name, category, default_unit) VALUES
        ('ldl', 'Холестерин ЛПНП', 'Липиды', 'ммоль/л'),
        ('hdl', 'Холестерин ЛПВП', 'Липиды', 'ммоль/л'),
        ('total_cholesterol', 'Общий холестерин', 'Липиды', 'ммоль/л'),
        ('triglycerides', 'Триглицериды', 'Липиды', 'ммоль/л'),
        ('creatinine', 'Креатинин', 'Почки', 'мкмоль/л'),
        ('cystatin_c', 'Цистатин C', 'Почки', 'мг/л'),
        ('egfr', 'Расчётная СКФ', 'Почки', 'мл/мин/1,73 м²'),
        ('urine_protein', 'Белок в моче', 'Почки', 'г/л'),
        ('urine_albumin', 'Альбумин в моче', 'Почки', 'мг/л'),
        ('acr', 'Альбумин/креатинин', 'Почки', 'мг/г'),
        ('platelets', 'Тромбоциты', 'Кровь', '10^9/л'),
        ('hemoglobin', 'Гемоглобин', 'Кровь', 'г/л'),
        ('glucose', 'Глюкоза', 'Обмен веществ', 'ммоль/л'),
        ('crp', 'C-реактивный белок', 'Воспаление', 'мг/л'),
        ('alt', 'АЛТ', 'Печень', 'Ед/л'),
        ('ast', 'АСТ', 'Печень', 'Ед/л');

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'холестерин лпнп' FROM metric_definitions WHERE key = 'ldl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'ldl cholesterol' FROM metric_definitions WHERE key = 'ldl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'cholestérol ldl' FROM metric_definitions WHERE key = 'ldl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'ldl-cholesterin' FROM metric_definitions WHERE key = 'ldl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'colesterolo ldl' FROM metric_definitions WHERE key = 'ldl';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'холестерин лпвп' FROM metric_definitions WHERE key = 'hdl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'hdl cholesterol' FROM metric_definitions WHERE key = 'hdl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'cholestérol hdl' FROM metric_definitions WHERE key = 'hdl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'hdl-cholesterin' FROM metric_definitions WHERE key = 'hdl';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'colesterolo hdl' FROM metric_definitions WHERE key = 'hdl';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'общий холестерин' FROM metric_definitions WHERE key = 'total_cholesterol';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'total cholesterol' FROM metric_definitions WHERE key = 'total_cholesterol';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'cholestérol total' FROM metric_definitions WHERE key = 'total_cholesterol';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'gesamtcholesterin' FROM metric_definitions WHERE key = 'total_cholesterol';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'colesterolo totale' FROM metric_definitions WHERE key = 'total_cholesterol';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'триглицериды' FROM metric_definitions WHERE key = 'triglycerides';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'triglycerides' FROM metric_definitions WHERE key = 'triglycerides';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'triglycérides' FROM metric_definitions WHERE key = 'triglycerides';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'triglyceride' FROM metric_definitions WHERE key = 'triglycerides';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'trigliceridi' FROM metric_definitions WHERE key = 'triglycerides';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'креатинин' FROM metric_definitions WHERE key = 'creatinine';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'creatinine' FROM metric_definitions WHERE key = 'creatinine';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'créatinine' FROM metric_definitions WHERE key = 'creatinine';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'kreatinin' FROM metric_definitions WHERE key = 'creatinine';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'creatinina' FROM metric_definitions WHERE key = 'creatinine';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'цистатин c' FROM metric_definitions WHERE key = 'cystatin_c';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'cystatin c' FROM metric_definitions WHERE key = 'cystatin_c';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'cystatine c' FROM metric_definitions WHERE key = 'cystatin_c';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'cystatin c' FROM metric_definitions WHERE key = 'cystatin_c';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'cistatina c' FROM metric_definitions WHERE key = 'cystatin_c';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'расчётная скф' FROM metric_definitions WHERE key = 'egfr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'egfr' FROM metric_definitions WHERE key = 'egfr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'dfg estimé' FROM metric_definitions WHERE key = 'egfr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'egfr' FROM metric_definitions WHERE key = 'egfr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'egfr' FROM metric_definitions WHERE key = 'egfr';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'белок в моче' FROM metric_definitions WHERE key = 'urine_protein';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'urine protein' FROM metric_definitions WHERE key = 'urine_protein';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'protéines urinaires' FROM metric_definitions WHERE key = 'urine_protein';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'protein im urin' FROM metric_definitions WHERE key = 'urine_protein';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'proteine urinarie' FROM metric_definitions WHERE key = 'urine_protein';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'альбумин в моче' FROM metric_definitions WHERE key = 'urine_albumin';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'urine albumin' FROM metric_definitions WHERE key = 'urine_albumin';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'альбумин/креатинин' FROM metric_definitions WHERE key = 'acr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'albumin creatinine ratio' FROM metric_definitions WHERE key = 'acr';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'acr' FROM metric_definitions WHERE key = 'acr';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'тромбоциты' FROM metric_definitions WHERE key = 'platelets';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'platelets' FROM metric_definitions WHERE key = 'platelets';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'plaquettes' FROM metric_definitions WHERE key = 'platelets';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'thrombozyten' FROM metric_definitions WHERE key = 'platelets';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'piastrine' FROM metric_definitions WHERE key = 'platelets';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'гемоглобин' FROM metric_definitions WHERE key = 'hemoglobin';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'hemoglobin' FROM metric_definitions WHERE key = 'hemoglobin';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'hémoglobine' FROM metric_definitions WHERE key = 'hemoglobin';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'hämoglobin' FROM metric_definitions WHERE key = 'hemoglobin';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'emoglobina' FROM metric_definitions WHERE key = 'hemoglobin';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'глюкоза' FROM metric_definitions WHERE key = 'glucose';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'glucose' FROM metric_definitions WHERE key = 'glucose';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'glycémie' FROM metric_definitions WHERE key = 'glucose';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'glukose' FROM metric_definitions WHERE key = 'glucose';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'glucosio' FROM metric_definitions WHERE key = 'glucose';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'с-реактивный белок' FROM metric_definitions WHERE key = 'crp';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'c-reactive protein' FROM metric_definitions WHERE key = 'crp';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'fr', 'protéine c-réactive' FROM metric_definitions WHERE key = 'crp';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'de', 'c-reaktives protein' FROM metric_definitions WHERE key = 'crp';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'it', 'proteina c reattiva' FROM metric_definitions WHERE key = 'crp';

      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'алт' FROM metric_definitions WHERE key = 'alt';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'alt' FROM metric_definitions WHERE key = 'alt';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'ru', 'аст' FROM metric_definitions WHERE key = 'ast';
      INSERT INTO metric_aliases (metric_definition_id, language, alias)
      SELECT id, 'en', 'ast' FROM metric_definitions WHERE key = 'ast';
    `,
  },
];
