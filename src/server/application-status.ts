export type ApplicationStatus = {
  installationId: string;
  createdAt: string;
  schemaVersion: number;
};

export interface ApplicationStatusRepository {
  get(): ApplicationStatus;
}

export function createApplicationStatusQuery(
  repository: ApplicationStatusRepository,
) {
  return () => repository.get();
}
