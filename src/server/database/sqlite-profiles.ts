import type { DatabaseSync } from "node:sqlite";
import type {
  BodyMeasurement,
  CreateProfileResult,
  Profile,
  ProfileRepository,
  SaveProfileInput,
  SexAtBirth,
} from "@/server/profiles";

type ProfileRow = {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex_at_birth: SexAtBirth;
  notes: string;
  measurement_id: number | null;
  measured_at: string | null;
  height_cm: number | null;
  weight_kg: number | null;
};

type MeasurementRow = {
  id: number;
  measured_at: string;
  height_cm: number | null;
  weight_kg: number | null;
};

const PROFILE_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.sex_at_birth,
    p.notes,
    m.id AS measurement_id,
    m.measured_at,
    m.height_cm,
    m.weight_kg
  FROM profiles p
  LEFT JOIN body_measurements m ON m.id = (
    SELECT id
    FROM body_measurements
    WHERE profile_id = p.id
    ORDER BY measured_at DESC, id DESC
    LIMIT 1
  )
`;

export function createSqliteProfileRepository(
  database: DatabaseSync,
): ProfileRepository {
  const listProfiles = database.prepare(`${PROFILE_SELECT} ORDER BY p.id`);
  const getProfile = database.prepare(`${PROFILE_SELECT} WHERE p.id = ?`);
  const getProfileBySlug = database.prepare(`${PROFILE_SELECT} WHERE p.slug = ?`);
  const getMeasurements = database.prepare(`
    SELECT id, measured_at, height_cm, weight_kg
    FROM body_measurements
    WHERE profile_id = ?
    ORDER BY measured_at DESC, id DESC
  `);
  const countProfiles = database.prepare(
    "SELECT COUNT(*) AS count FROM profiles",
  );
  const insertProfile = database.prepare(`
    INSERT INTO profiles (
      first_name, last_name, date_of_birth, sex_at_birth, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const saveSlug = database.prepare("UPDATE profiles SET slug = ? WHERE id = ?");
  const updateProfile = database.prepare(`
    UPDATE profiles
    SET first_name = ?, last_name = ?, date_of_birth = ?,
        sex_at_birth = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `);
  const saveMeasurement = database.prepare(`
    INSERT INTO body_measurements (
      profile_id, measured_at, height_cm, weight_kg, created_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (profile_id, measured_at) DO UPDATE SET
      height_cm = COALESCE(excluded.height_cm, body_measurements.height_cm),
      weight_kg = COALESCE(excluded.weight_kg, body_measurements.weight_kg)
  `);

  return {
    list() {
      return (listProfiles.all() as ProfileRow[]).map(mapProfile);
    },

    get(profileId) {
      const row = getProfile.get(profileId) as ProfileRow | undefined;
      if (!row) {
        return null;
      }

      const measurements = getMeasurements.all(profileId) as MeasurementRow[];
      return {
        ...mapProfile(row),
        measurements: measurements.map(mapMeasurement),
      };
    },

    getBySlug(slug) {
      const row = getProfileBySlug.get(slug) as ProfileRow | undefined;
      if (!row) return null;
      return {
        ...mapProfile(row),
        measurements: (getMeasurements.all(row.id) as MeasurementRow[]).map(mapMeasurement),
      };
    },

    create(input): CreateProfileResult {
      database.exec("BEGIN IMMEDIATE");
      try {
        const { count } = countProfiles.get() as { count: number };
        if (count >= 2) {
          database.exec("ROLLBACK");
          return { ok: false, reason: "limit_reached" };
        }

        const now = new Date().toISOString();
        const result = insertProfile.run(
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.sexAtBirth,
          input.notes,
          now,
          now,
        );
        const profileId = Number(result.lastInsertRowid);
        saveSlug.run(profileSlug(input.firstName, profileId), profileId);
        writeMeasurement(saveMeasurement, profileId, input.measurement, now);
        database.exec("COMMIT");
        return { ok: true, profileId };
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    update(profileId, input) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const now = new Date().toISOString();
        const result = updateProfile.run(
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.sexAtBirth,
          input.notes,
          now,
          profileId,
        );

        if (result.changes === 0) {
          database.exec("ROLLBACK");
          return false;
        }

        writeMeasurement(saveMeasurement, profileId, input.measurement, now);
        database.exec("COMMIT");
        return true;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    addMeasurement(profileId, measurement) {
      if (!measurement || !getProfile.get(profileId)) return false;
      writeMeasurement(
        saveMeasurement,
        profileId,
        measurement,
        new Date().toISOString(),
      );
      return true;
    },
  };
}

function writeMeasurement(
  statement: ReturnType<DatabaseSync["prepare"]>,
  profileId: number,
  measurement: SaveProfileInput["measurement"],
  createdAt: string,
) {
  if (!measurement) {
    return;
  }

  statement.run(
    profileId,
    measurement.measuredAt,
    measurement.heightCm,
    measurement.weightKg,
    createdAt,
  );
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    slug: row.slug,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    sexAtBirth: row.sex_at_birth,
    notes: row.notes,
    latestMeasurement:
      row.measurement_id === null
        ? null
        : mapMeasurement({
            id: row.measurement_id,
            measured_at: row.measured_at!,
            height_cm: row.height_cm,
            weight_kg: row.weight_kg,
          }),
  };
}

function mapMeasurement(row: MeasurementRow): BodyMeasurement {
  return {
    id: row.id,
    measuredAt: row.measured_at,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
  };
}

function profileSlug(firstName: string, profileId: number) {
  const name = transliterate(firstName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${name || "person"}-${profileId}`;
}

function transliterate(value: string) {
  const letters: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
    ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return [...value.toLocaleLowerCase("ru-RU")]
    .map((letter) => letters[letter] ?? letter)
    .join("");
}
