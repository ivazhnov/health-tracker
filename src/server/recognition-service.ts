import type { DocumentStorage } from "@/server/imports";
import type {
  DraftExtractor,
  RecognitionRepository,
  TextExtractor,
} from "@/server/recognition";

export function createRecognitionService(
  repository: RecognitionRepository,
  storage: DocumentStorage,
  textExtractor: TextExtractor,
  draftExtractor: DraftExtractor,
) {
  return async function recognise(importSessionId: number) {
    const job = repository.claim(importSessionId);
    if (!job) {
      return false;
    }

    try {
      const contents = await storage.read(job.storagePath);
      const text = await textExtractor.extract(job.mediaType, contents);
      const draft = draftExtractor.extract(text, repository.listMetricAliases());
      repository.complete(importSessionId, draft);
      return true;
    } catch (error) {
      repository.fail(importSessionId, userFacingError(error));
      return false;
    }
  };
}

function userFacingError(error: unknown) {
  if (error instanceof RecognitionError) {
    return error.message;
  }
  return "Не удалось распознать документ. Попробуйте ещё раз.";
}

export class RecognitionError extends Error {}
