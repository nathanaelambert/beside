import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiRequestSchema,
  applyReviewedFields,
  safeSourceUrl,
  validateSuggestions,
  type AiRequest,
} from "./ai-fill.ts";
import {
  createOpenRouterProvider,
  FillError,
  researchSources,
} from "./ai-provider.ts";
import { createFillHandler } from "./ai-handler.ts";
import { createSeed } from "./seed.ts";
import { execute } from "./model.ts";
import { parseDatabase } from "./validation.ts";
import { buildDraftRequest, fillDraft } from "./ai-draft.ts";

const request: AiRequest = {
  kind: "subject",
  templateId: "book",
  query: "A test book",
  context: "Test author, edition unknown",
};
const url = "https://publisher.example/book";
const sources = [{ url, title: "Publisher record (fixture)" }];
const suggestion = {
  match: "found" as const,
  summary: "Test book by Test Author. Edition unknown. This is a fixture.",
  fields: [
    {
      key: "Title",
      value: "A test book",
      certainty: "supported" as const,
      note: "",
      sourceUrls: [url],
    },
    {
      key: "Author",
      value: "Test Author",
      certainty: "supported" as const,
      note: "",
      sourceUrls: [url],
    },
  ],
  missing: ["Edition and Chapters: not established."],
};
const citation = {
  type: "url_citation",
  url_citation: { url, title: "Publisher record (fixture)" },
};
const completion = (
  content: string,
  annotations: unknown[] = [],
  finish_reason = "stop",
) =>
  Response.json({
    choices: [{ finish_reason, message: { content, annotations } }],
  });

test("AI requests reject unsupported templates, excessive input and unknown keys", () => {
  assert.equal(
    aiRequestSchema.safeParse({ ...request, context: "" }).success,
    false,
  );
  assert.equal(
    aiRequestSchema.safeParse({ ...request, query: "x".repeat(201) }).success,
    false,
  );
  assert.equal(
    aiRequestSchema.safeParse({ ...request, apiKey: "do-not-accept" }).success,
    false,
  );
  assert.throws(() =>
    validateSuggestions(
      suggestion,
      { ...request, templateId: "routine" },
      sources,
    ),
  );
});

test("an explicitly unknown edition cannot be replaced with source-backed publication history", () => {
  const input = {
    ...suggestion,
    fields: [
      ...suggestion.fields,
      {
        ...suggestion.fields[0]!,
        key: "Edition",
        value: "First published in 1943",
      },
    ],
  };
  for (const context of [
    "Test Author, edition unknown",
    "Test Author, unknown edition",
    "Edition is not known",
    "ISBN unspecified",
  ]) {
    const result = validateSuggestions(input, { ...request, context }, sources);
    assert.ok(!result.fields.some((field) => field.key === "Edition"));
    assert.ok(result.missing.some((note) => note.includes("Edition")));
    assert.ok(result.fields.some((field) => field.key === "Author"));
  }
  const known = validateSuggestions(
    input,
    { ...request, context: "Test Author, first edition 1943" },
    sources,
  );
  assert.ok(known.fields.some((field) => field.key === "Edition"));
});

test("citations are deduplicated and unsafe or invented source URLs are rejected", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:pass@example.com",
    "http://127.0.0.1",
    "http://[::1]",
    "http://localhost",
    "http://app.local",
  ])
    assert.equal(safeSourceUrl(value), null);
  assert.deepEqual(
    researchSources([
      citation,
      citation,
      { type: "url_citation", url_citation: { url: "javascript:test" } },
      {},
    ]),
    sources,
  );
  assert.throws(() =>
    validateSuggestions(
      {
        ...suggestion,
        fields: [
          {
            ...suggestion.fields[0]!,
            sourceUrls: ["https://invented.example/fake"],
          },
        ],
      },
      request,
      sources,
    ),
  );
  assert.throws(() => validateSuggestions(suggestion, request, []));
});

test("AI output rejects unknown fields, duplicates, oversized names and facts without a match", () => {
  for (const fields of [
    [{ ...suggestion.fields[0]!, key: "ownerUserId" }],
    [suggestion.fields[0]!, suggestion.fields[0]!],
    [{ ...suggestion.fields[0]!, value: "x".repeat(201) }],
  ])
    assert.throws(() =>
      validateSuggestions({ ...suggestion, fields }, request, sources),
    );
  assert.throws(() =>
    validateSuggestions(
      { ...suggestion, match: "not_found" },
      request,
      sources,
    ),
  );
  assert.equal(
    validateSuggestions(
      { ...suggestion, match: "not_found", fields: [] },
      request,
      sources,
    ).fields.length,
    0,
  );
  assert.ok(
    validateSuggestions(
      { ...suggestion, fields: [] },
      request,
      sources,
    ).missing.some((note) => note.includes("Author")),
  );
  const likely = validateSuggestions(
    { ...suggestion, match: "ambiguous" },
    request,
    sources,
  );
  assert.deepEqual(likely.fields, suggestion.fields);
  assert.ok(likely.missing.some((note) => note.includes("Chapters")));
  assert.throws(() =>
    validateSuggestions(
      {
        ...suggestion,
        match: "ambiguous",
        fields: [
          {
            ...suggestion.fields[0]!,
            sourceUrls: ["https://invented.example/fake"],
          },
        ],
      },
      request,
      sources,
    ),
  );
});

test("activity targets require positive finite numbers in the existing template; AI cannot choose ownership or subject links", () => {
  const activity = {
    ...request,
    kind: "activity" as const,
    templateId: "read-book",
  };
  for (const value of ["NaN", "Infinity", "0", "-1", "10 chapters", "1e999"])
    assert.throws(() =>
      validateSuggestions(
        {
          ...suggestion,
          fields: [{ ...suggestion.fields[0]!, key: "Target", value }],
        },
        activity,
        sources,
      ),
    );
  const valid = validateSuggestions(
    {
      ...suggestion,
      fields: [{ ...suggestion.fields[0]!, key: "Target", value: "12" }],
    },
    activity,
    sources,
  );
  assert.equal(valid.fields[0]!.value, "12");
  assert.throws(() =>
    validateSuggestions(
      {
        ...suggestion,
        fields: [{ ...suggestion.fields[0]!, key: "subjectIds" }],
      },
      activity,
      sources,
    ),
  );
});

test("additional templates use their own fields and session plans stay explicitly uncertain across validation", () => {
  for (const [templateId, key, value] of [
    ["series", "Episodes", "9"],
    ["movie", "Director", "Fixture Director"],
    ["course", "Provider", "Fixture University"],
    ["recipe", "Ingredients", "Fixture ingredients"],
  ]) {
    const result = validateSuggestions(
      { ...suggestion, fields: [{ ...suggestion.fields[0]!, key, value }] },
      { ...request, templateId: templateId! },
      sources,
    );
    assert.equal(result.fields[0]!.key, key);
  }
  const activity = {
    ...request,
    kind: "activity" as const,
    templateId: "cook-recipe",
  };
  const once = validateSuggestions(
    {
      ...suggestion,
      fields: [{ ...suggestion.fields[0]!, key: "Target", value: "1" }],
    },
    activity,
    sources,
  );
  assert.equal(once.fields[0]!.certainty, "uncertain");
  const twice = validateSuggestions(
    {
      match: once.match,
      summary: once.summary,
      fields: once.fields,
      missing: once.missing,
    },
    activity,
    sources,
  );
  assert.equal(twice.fields[0]!.note, once.fields[0]!.note);
});

test("review/fill is draft-only, applies explicit selections and protects edits made during research", () => {
  const db = createSeed();
  const before = structuredClone(db);
  const baseline = { Title: "My manual title", Author: "" };
  const reviewed = validateSuggestions(suggestion, request, sources);
  const fields = reviewed.fields.map((f) =>
    f.key === "Author" ? { ...f, value: "Reviewed author" } : f,
  );
  assert.deepEqual(
    applyReviewedFields(baseline, baseline, fields, []).values,
    baseline,
  );
  const filled = applyReviewedFields(baseline, baseline, fields, ["Author"]);
  assert.equal(filled.values.Title, "My manual title");
  assert.equal(filled.values.Author, "Reviewed author");
  const conflict = applyReviewedFields(
    { ...baseline, Author: "Newer edit" },
    baseline,
    fields,
    ["Title", "Author"],
  );
  assert.equal(conflict.values.Author, "Newer edit");
  assert.deepEqual(conflict.skipped, ["Author"]);
  assert.deepEqual(db, before);
  const saved = execute(db, {
    type: "createSubject",
    actorId: "mosaab",
    templateId: "book",
    title: filled.values.Title!,
    metadata: { Author: filled.values.Author! },
  }).db;
  assert.equal(saved.subjects.length, before.subjects.length + 1);
  assert.equal(saved.events.length, before.events.length + 1);
  assert.ok(parseDatabase(saved));
});

test("OpenRouter uses bounded Exa server search then strict JSON extraction; no domain records or credentials enter prompts", async () => {
  const calls: Record<string, unknown>[] = [];
  const provider = createOpenRouterProvider({
    apiKey: "test-key-not-a-secret",
    model: "test/model",
    fetch: async (_url, options) => {
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        "Bearer test-key-not-a-secret",
      );
      const body = JSON.parse(options!.body as string);
      assert.ok(!JSON.stringify(body).includes("test-key-not-a-secret"));
      calls.push(body);
      return calls.length === 1
        ? completion("Fixture research with a source.", [citation])
        : completion(JSON.stringify(suggestion));
    },
  });
  const result = await provider.suggest(request, new AbortController().signal);
  assert.equal(result.fields[0]!.value, "A test book");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.reasoning, { effort: "high", exclude: true });
    assert.equal(call.max_tokens, 12000);
  }
  assert.deepEqual(calls[0]!.tools, [
    {
      type: "openrouter:web_search",
      parameters: {
        engine: "exa",
        max_results: 5,
        max_total_results: 8,
        max_uses: 2,
        max_characters: 3000,
      },
    },
  ]);
  assert.equal(calls[0]!.max_tool_calls, 2);
  assert.deepEqual(calls[1]!.provider, { require_parameters: true });
  assert.equal(
    (calls[1]!.response_format as { type: string }).type,
    "json_schema",
  );
});

test("multiple research matches yield one sourced candidate that fills the draft instead of blocking", async () => {
  const alternateUrl = "https://studio.example/remake";
  const lookup = buildDraftRequest("subject", "movie", "Shared title", {});
  const selected = {
    match: "ambiguous",
    summary:
      "Selected the better-known 1982 film by Fixture Director over its 2011 remake.",
    fields: [
      { ...suggestion.fields[0]!, key: "Director", value: "Fixture Director" },
      { ...suggestion.fields[0]!, key: "Year", value: "1982" },
    ],
    missing: [],
  };
  let count = 0;
  const provider = createOpenRouterProvider({
    apiKey: "test",
    model: "test",
    fetch: async (_url, options) => {
      count++;
      const body = JSON.parse(options!.body as string);
      assert.match(
        body.messages[0].content,
        /select the single most likely result/,
      );
      return count === 1
        ? completion(
            "Two exact-title matches: 1982 by Fixture Director; 2011 by Another Director. The 1982 film is better known.",
            [
              citation,
              {
                type: "url_citation",
                url_citation: { url: alternateUrl, title: "Remake (fixture)" },
              },
            ],
          )
        : completion(JSON.stringify(selected));
    },
  });
  const result = await provider.suggest(lookup, new AbortController().signal);
  assert.equal(result.match, "ambiguous");
  assert.ok(
    result.fields.every((field) => !field.sourceUrls.includes(alternateUrl)),
  );
  const before = { Title: "Shared title", Director: "", Year: "" };
  assert.deepEqual(fillDraft(before, before, result, "subject").values, {
    ...before,
    Director: "Fixture Director",
    Year: "1982",
  });
  assert.equal(count, 2);
});

test("provider rejects source-free, truncated, invalid and unsourced results without silently falling back to model memory", async () => {
  for (const scenario of [
    "no-sources",
    "truncated",
    "invalid-json",
    "invented-source",
    "search-not-run",
  ]) {
    let count = 0;
    const provider = createOpenRouterProvider({
      apiKey: "test",
      model: "test",
      fetch: async () => {
        count++;
        if (count === 1) {
          if (scenario === "search-not-run")
            return Response.json({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: "memory only", annotations: [citation] },
                },
              ],
              usage: { server_tool_use: { web_search_requests: 0 } },
            });
          return completion(
            "Research",
            scenario === "no-sources" ? [] : [citation],
            scenario === "truncated" ? "length" : "stop",
          );
        }
        return completion(
          scenario === "invalid-json"
            ? "not json"
            : JSON.stringify({
                ...suggestion,
                fields: [
                  {
                    ...suggestion.fields[0]!,
                    sourceUrls: ["https://fake.example/book"],
                  },
                ],
              }),
        );
      },
    });
    await assert.rejects(
      provider.suggest(request, new AbortController().signal),
      FillError,
    );
  }
});

const httpRequest = (
  body: unknown = request,
  origin = "http://localhost:3003",
) =>
  new Request("http://localhost:3003/api/ai-fill", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
test("API rejects cross-origin, malformed, oversized and unsupported requests before any inference", async () => {
  let calls = 0;
  const handler = createFillHandler(() => ({
    suggest: async () => {
      calls++;
      return validateSuggestions(suggestion, request, sources);
    },
  }));
  assert.equal(
    (await handler(httpRequest(request, "https://other.example"))).status,
    403,
  );
  assert.equal(
    (await handler(httpRequest({ ...request, templateId: "routine" }))).status,
    400,
  );
  assert.equal(
    (await handler(httpRequest({ ...request, query: "x".repeat(7000) })))
      .status,
    413,
  );
  assert.equal(
    (
      await handler(
        new Request("http://localhost:3003/api/ai-fill", {
          method: "POST",
          headers: {
            origin: "http://localhost:3003",
            "content-type": "application/json",
          },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});

test("API returns safe configuration/provider failures, forwards abort, and enforces a shared sandbox budget", async () => {
  const missing = createFillHandler(() => {
    throw new FillError("AI not configured", 503);
  });
  assert.equal((await missing(httpRequest())).status, 503);
  const failing = createFillHandler(() => ({
    suggest: async () => {
      throw new Error("sensitive upstream body");
    },
  }));
  const failure = await failing(httpRequest());
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes("sensitive"));
  const controller = new AbortController();
  const aborted = new Request(httpRequest(), { signal: controller.signal });
  controller.abort();
  const handler = createFillHandler(() => ({
    suggest: async (_request, signal) => {
      signal.throwIfAborted();
      return validateSuggestions(suggestion, request, sources);
    },
  }));
  assert.equal((await handler(aborted)).status, 504);
  const budget = createFillHandler(() => ({
    suggest: async () => validateSuggestions(suggestion, request, sources),
  }));
  for (let i = 0; i < 30; i++)
    assert.equal((await budget(httpRequest())).status, 200);
  assert.equal((await budget(httpRequest())).status, 429);
});

test("provider HTTP errors never echo upstream bodies or authorization headers", async () => {
  const provider = createOpenRouterProvider({
    apiKey: "sensitive-test-value",
    model: "test",
    fetch: async () => new Response("sensitive-test-value", { status: 401 }),
  });
  await assert.rejects(
    provider.suggest(request, new AbortController().signal),
    (error: unknown) =>
      error instanceof FillError &&
      error.status === 503 &&
      !error.message.includes("sensitive-test-value"),
  );
});
