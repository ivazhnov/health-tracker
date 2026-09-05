import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "../src/server/database/migrations.ts";
import { createSqliteProfileRepository } from "../src/server/database/sqlite-profiles.ts";

test("two profiles receive stable URL-safe slugs and remain independently addressable", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) database.exec(migration.sql);
  const profiles = createSqliteProfileRepository(database);
  const first = profiles.create(input("Яна"));
  const second = profiles.create(input("Иван"));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(profiles.list().map(({ slug }) => slug), ["yana-1", "ivan-2"]);
  assert.equal(profiles.getBySlug("yana-1").id, 1);
  assert.equal(profiles.getBySlug("ivan-2").id, 2);
  assert.deepEqual(profiles.create(input("Третий")), { ok: false, reason: "limit_reached" });
  database.close();
});

function input(firstName) {
  return {
    firstName,
    lastName: "",
    dateOfBirth: "1990-01-01",
    sexAtBirth: "female",
    notes: "",
    measurement: null,
  };
}
