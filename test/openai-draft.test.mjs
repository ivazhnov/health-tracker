import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAiDraftExtractor,
  parseAiDraft,
} from "../src/server/openai-draft-extractor.ts";

const text = "LDL 3.1 mmol/l";
const aliases = [
  { metricDefinitionId: 1, displayName: "Холестерин ЛПНП", category: "Липиды" },
];
function draft() {
  return {
    detectedLanguage: "en",
    laboratoryName: null,
    collectedAt: null,
    specimen: null,
    warnings: [],
    observations: [
      {
        metricDefinitionId: 1,
        originalName: "LDL",
        displayName: "LDL",
        category: "Липиды",
        valueText: "3.1",
        unit: "mmol/l",
        referenceLow: null,
        referenceHigh: null,
        referenceText: null,
        sourceText: text,
        confidence: 0.95,
      },
    ],
  };
}

test("AI mapping uses catalogue labels and rejects invented IDs or evidence", () => {
  assert.equal(
    parseAiDraft(draft(), text, aliases, "test").observations[0].displayName,
    "Холестерин ЛПНП",
  );
  const wrongId = draft();
  wrongId.observations[0].metricDefinitionId = 999;
  assert.throws(
    () => parseAiDraft(wrongId, text, aliases, "test"),
    /Unknown catalogue/,
  );
  const wrongSource = draft();
  wrongSource.observations[0].sourceText = "invented row";
  assert.throws(
    () => parseAiDraft(wrongSource, text, aliases, "test"),
    /source evidence/,
  );
});

test("AI adapter sends a strict schema and refuses incomplete responses", async () => {
  const request = async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.equal(sent.store, false);
    assert.equal(sent.text.format.strict, true);
    assert.ok(
      sent.text.format.schema.properties.observations.items.required.includes(
        "specimenCode",
      ),
    );
    assert.ok(
      sent.text.format.schema.properties.observations.items.required.includes(
        "sourceSpecimenText",
      ),
    );
    return Response.json({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(draft()) }] },
      ],
    });
  };
  const result = await createOpenAiDraftExtractor(
    "test",
    "test",
    request,
  ).extract(text, aliases);
  assert.equal(result.observations[0].valueText, "3.1");
  await assert.rejects(
    createOpenAiDraftExtractor("test", "test", async () =>
      Response.json({ status: "incomplete" }),
    ).extract(text, aliases),
    /incomplete/,
  );
});
