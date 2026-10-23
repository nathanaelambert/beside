import {
  applyReviewedFields,
  type AiRequest,
  type AiResponse,
} from "./ai-fill.ts";

export type DraftChange = { key: string; before: string; after: string };

// Reuse the existing form as context, without a separate set of lookup inputs.
export function buildDraftRequest(
  kind: AiRequest["kind"],
  templateId: string,
  query: string,
  details: Record<string, string>,
): AiRequest {
  const context = Object.entries(details)
    .filter(
      ([key, value]) =>
        [
          "Author",
          "Edition",
          "Creator",
          "Season",
          "Director",
          "Year",
          "Provider",
          "Source",
        ].includes(key) && value.trim(),
    )
    .map(([key, value]) => `${key}: ${value.trim().slice(0, 250)}`);
  if (templateId === "book" || templateId === "read-book") {
    context.push(
      details.Edition?.trim()
        ? "Use this specific edition only."
        : "Edition unknown. Leave Edition blank; do not infer the user's copy from publication history.",
    );
  } else if (templateId === "series" || templateId === "watch-series") {
    context.push(
      "Do not assume a season. If neither title nor form identifies it, leave season-specific details blank.",
    );
  } else if (templateId === "course" || templateId === "course-progress") {
    context.push(
      "Respect any identified provider and version; otherwise choose the most likely matching course.",
    );
  } else if (templateId === "recipe" || templateId === "cook-recipe") {
    context.push(
      "Find an identifiable original recipe; choose the most likely matching recipe when no author or URL is supplied.",
    );
  }
  context.push(
    "Choose the most likely match using the title and supplied details. Fill descriptive facts from that single match; explain the choice in summary. Keep source links in provenance, never in field values.",
  );
  return {
    kind,
    templateId,
    query: query.trim(),
    context: context.join("\n").slice(0, 1000),
  };
}

export function fillDraft(
  current: Record<string, string>,
  baseline: Record<string, string>,
  result: AiResponse,
  kind: AiRequest["kind"],
  replaceable: string[] = [],
) {
  const eligible =
    result.match !== "not_found"
      ? result.fields.filter(
          (field) =>
            !["Title", "Name", "Source"].includes(field.key) &&
            !/https?:\/\//i.test(field.value) &&
            (!baseline[field.key]?.trim() || replaceable.includes(field.key)) &&
            (field.certainty === "supported" || kind === "activity"),
        )
      : [];
  const merged = applyReviewedFields(
    current,
    baseline,
    eligible,
    eligible.map((f) => f.key),
  );
  const changes: DraftChange[] = merged.applied.map((key) => ({
    key,
    before: current[key] ?? "",
    after: merged.values[key]!,
  }));
  return { ...merged, changes };
}

// Undo only values still equal to the AI fill. Later manual edits always win.
export function undoDraft(
  current: Record<string, string>,
  changes: DraftChange[],
) {
  const values = { ...current };
  for (const change of changes) {
    if (values[change.key] === change.after) values[change.key] = change.before;
  }
  return values;
}
