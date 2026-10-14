import { z } from "zod";
import { activityTemplates, subjectTemplates } from "./templates.ts";

export const supportedSubjects = [
  "book",
  "series",
  "movie",
  "course",
  "recipe",
];
export const supportedActivities = [
  "read-book",
  "watch-series",
  "movie-night",
  "course-progress",
  "cook-recipe",
];
export const aiRequestSchema = z.strictObject({
  kind: z.enum(["subject", "activity"]),
  templateId: z.string().min(1).max(100),
  query: z.string().trim().min(1).max(200),
  context: z.string().trim().min(3).max(1000),
});
export type AiRequest = z.infer<typeof aiRequestSchema>;

export function fillTemplate(kind: AiRequest["kind"], templateId: string) {
  if (kind === "subject" && supportedSubjects.includes(templateId)) {
    const template = subjectTemplates.find((t) => t.id === templateId)!;
    return {
      name: template.name,
      fields: ["Title", ...template.fields],
      unit: template.unit,
      mode: "description",
    };
  }
  if (kind === "activity" && supportedActivities.includes(templateId)) {
    const template = activityTemplates.find((t) => t.id === templateId)!;
    return {
      name: template.name,
      fields: ["Name", "Description", "Target"],
      unit: template.unit,
      mode: template.progressMode,
    };
  }
  return null;
}

// URLs are displayed as links only. Neither the server nor browser fetches them.
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase();
    if (
      !host.includes(".") ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.includes(":") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)
    )
      return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
const sourceSchema = z.strictObject({
  url: z
    .string()
    .max(2000)
    .refine((v) => safeSourceUrl(v) !== null),
  title: z.string().min(1).max(300),
});
export const suggestionSchema = z.strictObject({
  // ambiguous still selects one most likely candidate; its facts may fill the draft.
  match: z.enum(["found", "ambiguous", "not_found"]),
  summary: z.string().min(1).max(1000),
  fields: z
    .array(
      z.strictObject({
        key: z.string().min(1).max(100),
        value: z.string().trim().min(1).max(2000),
        certainty: z.enum(["supported", "uncertain"]),
        note: z.string().max(500),
        sourceUrls: z.array(z.string().max(2000)).min(1).max(8),
      }),
    )
    .max(8),
  missing: z.array(z.string().max(300)).max(12),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const aiResponseSchema = suggestionSchema.extend({
  sources: z.array(sourceSchema).min(1).max(12),
  provider: z.literal("OpenRouter"),
});
export type AiResponse = z.infer<typeof aiResponseSchema>;

export function validateSuggestions(
  input: unknown,
  request: AiRequest,
  sources: AiResponse["sources"],
): AiResponse {
  const template = fillTemplate(request.kind, request.templateId);
  if (!template) throw new Error("This template does not support AI fill yet.");
  const result = suggestionSchema.parse(input);
  const urls = new Set(sources.map((s) => safeSourceUrl(s.url)));
  if (new Set(result.fields.map((f) => f.key)).size !== result.fields.length)
    throw new Error("Duplicate suggested field.");
  if (result.match === "not_found" && result.fields.length)
    throw new Error("A missing match cannot supply fields.");
  for (const field of result.fields) {
    if (!template.fields.includes(field.key))
      throw new Error("Unsupported suggested field.");
    if (["Title", "Name"].includes(field.key) && field.value.length > 200)
      throw new Error("Suggested name is too long.");
    if (
      field.key === "Target" &&
      (!/^\d+(\.\d+)?$/.test(field.value) ||
        !Number.isFinite(Number(field.value)) ||
        Number(field.value) <= 0)
    )
      throw new Error("Invalid suggested target.");
    if (
      request.kind === "activity" &&
      (field.key !== "Target" || template.mode === "sessions")
    ) {
      field.certainty = "uncertain";
      if (!field.note.startsWith("Planning suggestion;")) {
        field.note =
          `Planning suggestion; choose your own commitment. ${field.note}`
            .trim()
            .slice(0, 500);
      }
    }
    field.sourceUrls = [
      ...new Set(field.sourceUrls.map((url) => safeSourceUrl(url))),
    ].map((url) => {
      if (!url || !urls.has(url))
        throw new Error("Suggested source was not returned by web search.");
      return url;
    });
  }
  // Respect explicit unknown-edition context even when the model supplies a
  // source-backed publication date. That date does not identify the user's copy.
  if (
    request.kind === "subject" &&
    request.templateId === "book" &&
    /\b(?:(?:edition|printing|isbn)(?:\s+is)?\s+(?:unknown|unspecified|not\s+known|not\s+specified)|(?:unknown|unspecified)\s+(?:edition|printing|isbn))\b/i.test(
      request.context,
    )
  ) {
    result.fields = result.fields.filter((field) => field.key !== "Edition");
    const note =
      "Edition: you specified an unknown edition; identify your copy or enter this manually.";
    if (!result.missing.some((item) => /\bedition\b/i.test(item)))
      result.missing.push(note);
  }
  if (result.match !== "not_found") {
    for (const field of template.fields.filter(
      (key) => !result.fields.some((f) => f.key === key),
    )) {
      if (!result.missing.some((note) => note.includes(field)))
        result.missing.push(
          `${field}: no reliable suggestion returned; enter it manually.`,
        );
    }
  }
  return aiResponseSchema.parse({ ...result, sources, provider: "OpenRouter" });
}

// Pure draft merge: it has no access to the database or command dispatcher.
// Explicitly checked replacements are allowed, except edits made since research began.
export function applyReviewedFields(
  current: Record<string, string>,
  baseline: Record<string, string>,
  fields: Suggestion["fields"],
  selected: string[],
) {
  const values = { ...current };
  const skipped: string[] = [];
  const applied: string[] = [];
  for (const field of fields.filter((f) => selected.includes(f.key))) {
    if ((current[field.key] ?? "") !== (baseline[field.key] ?? "")) {
      skipped.push(field.key);
      continue;
    }
    values[field.key] = field.value;
    applied.push(field.key);
  }
  return { values, skipped, applied };
}
