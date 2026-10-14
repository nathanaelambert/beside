import { test } from "node:test";
import assert from "node:assert/strict";
import { aiRequestSchema, type AiResponse } from "./ai-fill.ts";
import { buildDraftRequest, fillDraft, undoDraft } from "./ai-draft.ts";
import { createSeed } from "./seed.ts";
import { execute } from "./model.ts";
import { parseDatabase } from "./validation.ts";

const url = "https://publisher.example/book";
const field = (
  key: string,
  value: string,
  certainty: "supported" | "uncertain" = "supported",
) => ({ key, value, certainty, note: "", sourceUrls: [url] });
const result: AiResponse = {
  match: "found",
  summary: "Fixture only.",
  fields: [
    field("Title", "Canonical title"),
    field("Author", "Fixture Author"),
    field("Edition", "Uncertain edition", "uncertain"),
    field("Chapters", "12"),
  ],
  sources: [{ url, title: "Fixture publisher" }],
  missing: ["Edition unknown"],
  provider: "OpenRouter",
};

test("the title and existing identity fields provide lookup context, without a separate form or private activity details", () => {
  const request = buildDraftRequest("subject", "book", "  X  ", {
    Title: "X",
    Author: "Test Author",
    Chapters: "10",
  });
  assert.equal(request.query, "X");
  assert.ok(aiRequestSchema.safeParse(request).success);
  assert.match(request.context, /Author: Test Author/);
  assert.match(request.context, /Edition unknown/);
  assert.ok(!request.context.includes("Chapters: 10"));
  const activity = buildDraftRequest("activity", "read-book", "A book", {
    Name: "A book",
    Description: "Private intention",
    Target: "5",
  });
  assert.ok(!activity.context.includes("Private intention"));
  assert.ok(!activity.context.includes("Target:"));
  assert.ok(
    !buildDraftRequest("subject", "book", "A book", {
      Edition: "ISBN 123",
    }).context.includes("Edition unknown"),
  );
  assert.match(
    buildDraftRequest("subject", "series", "A show", {}).context,
    /Do not assume a season/,
  );
});

test("one click fills only empty supported details, preserves the typed title and manual values, and leaves uncertain facts blank", () => {
  const before = {
    Title: "My typed title",
    Author: "Manual Author",
    Edition: "",
    Chapters: "",
  };
  const filled = fillDraft(before, before, result, "subject");
  assert.deepEqual(filled.values, { ...before, Chapters: "12" });
  assert.deepEqual(filled.changes, [
    { key: "Chapters", before: "", after: "12" },
  ]);
  assert.deepEqual(before, {
    Title: "My typed title",
    Author: "Manual Author",
    Edition: "",
    Chapters: "",
  });
});

test("edits made while AI runs are never overwritten by the response", () => {
  const baseline = { Title: "A book", Author: "", Chapters: "" };
  const current = { ...baseline, Chapters: "My newer count" };
  const filled = fillDraft(current, baseline, result, "subject");
  assert.equal(filled.values.Chapters, "My newer count");
  assert.equal(filled.values.Author, "Fixture Author");
  assert.deepEqual(filled.skipped, ["Chapters"]);
});

test("Undo removes AI values but keeps later manual edits", () => {
  const before = { Title: "A book", Author: "", Chapters: "" };
  const filled = fillDraft(before, before, result, "subject");
  const edited = { ...filled.values, Author: "My correction" };
  assert.deepEqual(undoDraft(edited, filled.changes), {
    ...before,
    Author: "My correction",
  });
});

test("only untouched activity defaults are replaceable; planning details remain editable drafts", () => {
  const activity = {
    ...result,
    fields: [
      field("Name", "AI name", "uncertain"),
      field("Description", "Proposed plan", "uncertain"),
      field("Target", "12"),
    ],
  };
  const before = { Name: "My plan", Description: "", Target: "10" };
  const filled = fillDraft(before, before, activity, "activity", ["Target"]);
  assert.deepEqual(filled.values, {
    ...before,
    Description: "Proposed plan",
    Target: "12",
  });
  assert.equal(
    fillDraft(before, before, activity, "activity").values.Target,
    "10",
  );
  assert.equal(
    fillDraft({ ...before, Target: "20" }, before, activity, "activity", [
      "Target",
    ]).values.Target,
    "20",
  );
  assert.deepEqual(undoDraft(filled.values, filled.changes), before);
});

test("ambiguous matches do not fill anything", () => {
  const before = { Title: "A book", Author: "" };
  assert.deepEqual(
    fillDraft(
      before,
      before,
      { ...result, match: "ambiguous", fields: [] },
      "subject",
    ).values,
    before,
  );
});

test("provenance and AI Source values never enter a saved subject; filling emits no records or events", () => {
  const db = createSeed();
  const before = structuredClone(db);
  const recipe = {
    ...result,
    fields: [
      field("Ingredients", "Lentils and cumin"),
      field("Method", `Instructions at ${url}`),
      field("Source", url),
    ],
  };
  const values = {
    Title: "My recipe",
    Ingredients: "",
    Method: "",
    Source: "",
  };
  const filled = fillDraft(values, values, recipe, "subject");
  assert.equal(filled.values.Source, "");
  assert.equal(filled.values.Method, "");
  assert.deepEqual(db, before);
  const saved = execute(db, {
    type: "createSubject",
    actorId: "mosaab",
    templateId: "recipe",
    title: filled.values.Title!,
    metadata: {
      Ingredients: filled.values.Ingredients!,
      Method: filled.values.Method!,
      Source: filled.values.Source!,
    },
  });
  const subject = saved.db.subjects.find((row) => row.id === saved.entityId)!;
  assert.ok(!JSON.stringify(subject).includes(url));
  assert.ok(!("sources" in subject));
  assert.ok(parseDatabase(saved.db));
});
