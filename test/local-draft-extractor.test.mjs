import assert from "node:assert/strict";
import test from "node:test";
import { extractDraft } from "../src/server/local-draft-extractor.ts";

const aliases = [
  alias("ru", "холестерин лпнп"),
  alias("en", "ldl cholesterol"),
  alias("fr", "cholestérol ldl"),
  alias("de", "ldl-cholesterin"),
  alias("it", "colesterolo ldl"),
];

const examples = [
  ["ru", "Холестерин ЛПНП 3,1 ммоль/л 0 - 3,0", "3.1"],
  ["en", "LDL cholesterol 120 mg/dL < 100", "120"],
  ["fr", "Cholestérol LDL 2,8 mmol/L < 3,0", "2.8"],
  ["de", "LDL-Cholesterin 110 mg/dL < 116", "110"],
  ["it", "Colesterolo LDL 95 mg/dL < 115", "95"],
];

for (const [language, line, expectedValue] of examples) {
  test(`extracts a structured ${language} laboratory row`, () => {
    const result = extractDraft(line, aliases);

    assert.equal(result.detectedLanguage, language);
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0].displayName, "Холестерин ЛПНП");
    assert.equal(result.observations[0].valueText, expectedValue);
    assert.ok(result.observations[0].unit);
  });
}

test("extracts basic document metadata without confirming it", () => {
  const result = extractDraft(
    "Лаборатория Тест\nМатериал: моча\nДата забора: 04.09.2026\nХолестерин ЛПНП 3,1 ммоль/л",
    aliases,
  );

  assert.equal(result.laboratoryName, "Лаборатория Тест");
  assert.equal(result.specimen, null);
  assert.equal("specimenCode" in result.observations[0], false);
  assert.equal(result.collectedAt, "2026-09-04");
});

function alias(language, value) {
  return {
    metricDefinitionId: 1,
    metricKey: "ldl",
    displayName: "Холестерин ЛПНП",
    category: "Липиды",
    defaultUnit: "ммоль/л",
    language,
    alias: value,
  };
}
