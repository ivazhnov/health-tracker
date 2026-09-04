import { createApplicationStatusQuery } from "@/server/application-status";
import {
  createSqliteApplicationStatusRepository,
  getDatabase,
} from "@/server/database/sqlite";

let applicationStatusQuery: ReturnType<
  typeof createApplicationStatusQuery
> | null = null;

export function getApplicationStatus() {
  if (!applicationStatusQuery) {
    const repository = createSqliteApplicationStatusRepository(getDatabase());
    applicationStatusQuery = createApplicationStatusQuery(repository);
  }

  return applicationStatusQuery();
}
