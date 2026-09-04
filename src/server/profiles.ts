export type SexAtBirth = "female" | "male";

export type BodyMeasurement = {
  id: number;
  measuredAt: string;
  heightCm: number | null;
  weightKg: number | null;
};

export type Profile = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sexAtBirth: SexAtBirth;
  notes: string;
  latestMeasurement: BodyMeasurement | null;
};

export type ProfileDetails = Profile & {
  measurements: BodyMeasurement[];
};

export type SaveProfileInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sexAtBirth: SexAtBirth;
  notes: string;
  measurement: {
    measuredAt: string;
    heightCm: number | null;
    weightKg: number | null;
  } | null;
};

export type CreateProfileResult =
  | { ok: true; profileId: number }
  | { ok: false; reason: "limit_reached" };

export interface ProfileRepository {
  list(): Profile[];
  get(profileId: number): ProfileDetails | null;
  create(input: SaveProfileInput): CreateProfileResult;
  update(profileId: number, input: SaveProfileInput): boolean;
}

export type ParsedProfileForm =
  | { ok: true; value: SaveProfileInput }
  | { ok: false };

export function parseProfileForm(formData: FormData): ParsedProfileForm {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const dateOfBirth = text(formData, "dateOfBirth");
  const sexAtBirth = text(formData, "sexAtBirth");
  const notes = text(formData, "notes");
  const measuredAt = text(formData, "measuredAt");
  const heightCm = optionalPositiveNumber(formData, "heightCm");
  const weightKg = optionalPositiveNumber(formData, "weightKg");

  if (
    !firstName ||
    firstName.length > 100 ||
    lastName.length > 100 ||
    notes.length > 2000 ||
    !isPastOrToday(dateOfBirth) ||
    (sexAtBirth !== "female" && sexAtBirth !== "male") ||
    heightCm === "invalid" ||
    weightKg === "invalid"
  ) {
    return { ok: false };
  }

  const hasMeasurement = heightCm !== null || weightKg !== null;
  if (hasMeasurement && !isPastOrToday(measuredAt)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      dateOfBirth,
      sexAtBirth,
      notes,
      measurement: hasMeasurement
        ? { measuredAt, heightCm, weightKg }
        : null,
    },
  };
}

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalPositiveNumber(formData: FormData, field: string) {
  const value = text(formData, field).replace(",", ".");
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : "invalid";
}

function isPastOrToday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= todayUtc
  );
}
