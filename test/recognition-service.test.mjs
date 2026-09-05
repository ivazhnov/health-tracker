import assert from "node:assert/strict";
import test from "node:test";
import { createRecognitionService } from "../src/server/recognition-service.ts";

test("a laboratory entered before upload overrides recognition", async () => {
  let savedDraft;
  const repository = {
    claim() {
      return {
        importSessionId: 1,
        sourceDocumentId: 1,
        storagePath: "documents/test.txt",
        mediaType: "text/plain",
        laboratoryNameOverride: "Лаборатория вручную",
      };
    },
    listMetricAliases() {
      return [];
    },
    complete(_importSessionId, draft) {
      savedDraft = draft;
    },
    fail() {},
    getDraft() {
      return null;
    },
  };
  const recognise = createRecognitionService(
    repository,
    { async read() { return new Uint8Array(); } },
    { async extract() { return "test"; } },
    { async extract() {
      return {
        recognitionVersion: "test",
        extractedText: "test",
        detectedLanguage: "ru",
        laboratoryName: "Ошибочная лаборатория",
        collectedAt: null,
        specimen: null,
        warnings: [],
        observations: [],
      };
    } },
  );

  assert.equal(await recognise(1), true);
  assert.equal(savedDraft.laboratoryName, "Лаборатория вручную");
});
