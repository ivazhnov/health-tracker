import { createApplicationStatusQuery } from "@/server/application-status";
import {
  createSqliteApplicationStatusRepository,
  getDatabase,
} from "@/server/database/sqlite";
import { createSqliteProfileRepository } from "@/server/database/sqlite-profiles";
import type { ProfileRepository, SaveProfileInput } from "@/server/profiles";

let applicationStatusQuery: ReturnType<
  typeof createApplicationStatusQuery
> | null = null;
let profileRepository: ProfileRepository | null = null;

export function getApplicationStatus() {
  if (!applicationStatusQuery) {
    const repository = createSqliteApplicationStatusRepository(getDatabase());
    applicationStatusQuery = createApplicationStatusQuery(repository);
  }

  return applicationStatusQuery();
}

export function listProfiles() {
  return profiles().list();
}

export function getProfile(profileId: number) {
  return profiles().get(profileId);
}

export function createProfile(input: SaveProfileInput) {
  return profiles().create(input);
}

export function updateProfile(profileId: number, input: SaveProfileInput) {
  return profiles().update(profileId, input);
}

function profiles() {
  if (!profileRepository) {
    profileRepository = createSqliteProfileRepository(getDatabase());
  }

  return profileRepository;
}
