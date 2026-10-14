"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  aiResponseSchema,
  applyReviewedFields,
  fillTemplate,
  validateSuggestions,
  type AiRequest,
  type AiResponse,
} from "../lib/ai-fill";

type Props = {
  kind: AiRequest["kind"];
  templateId: string;
  values: Record<string, string>;
  initialQuery: string;
  onApply: (values: Record<string, string>) => void;
};
const hints: Record<string, string> = {
  book: "Author and edition, language or ISBN. Say if the edition is unknown.",
  series: "Creator or release year and the exact season.",
  movie: "Release year or director to distinguish remakes.",
  course: "Provider and course version/year, ideally an official course URL.",
  recipe:
    "Original recipe URL or author and recipe name. Avoid generic dish names alone.",
  "read-book":
    "Book author and edition/ISBN, or say the edition is unknown. What do you want to read?",
  "watch-series":
    "Show release year or creator, and the exact season to watch.",
  "movie-night":
    "Film director or release year. This plans one viewing session.",
  "course-progress":
    "Course provider, version/year and official course URL if known.",
  "cook-recipe":
    "Original recipe URL or author and recipe name. This plans one cooking session.",
};

export function AiFill(props: Props) {
  const [open, setOpen] = useState(false);
  const supported = !!fillTemplate(props.kind, props.templateId);
  return (
    <div className="ai-fill">
      <button
        type="button"
        className="button ai-fill-toggle"
        aria-expanded={open}
        disabled={!supported}
        onClick={() => setOpen(!open)}
      >
        <Sparkles size={16} /> Fill using AI
      </button>
      {!supported && (
        <p className="muted">
          AI fill supports books, TV seasons, movies, courses and recipes, with
          their matching activities.
        </p>
      )}
      {supported && open && (
        <AiFillReview {...props} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function AiFillReview({
  kind,
  templateId,
  values,
  initialQuery,
  onApply,
  onClose,
}: Props & { onClose: () => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<AiResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const baseline = useRef<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  const requestRef = useRef<AiRequest | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
    setNotice("Research cancelled. Your form has not changed.");
  }
  async function research() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    baseline.current = { ...values };
    const request: AiRequest = {
      kind,
      templateId,
      query: query.trim(),
      context: context.trim(),
    };
    requestRef.current = request;
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setSelected([]);
    try {
      const response = await fetch("/api/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: current.signal,
        body: JSON.stringify(request),
      });
      const body = await response.json();
      if (current.signal.aborted) return;
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "AI research failed. Please retry.",
        );
      const parsed = aiResponseSchema.parse(body);
      const verified = validateSuggestions(
        {
          match: parsed.match,
          summary: parsed.summary,
          fields: parsed.fields,
          missing: parsed.missing,
        },
        request,
        parsed.sources,
      );
      setResult(verified);
      setSelected(
        verified.fields
          .filter(
            (f) =>
              !baseline.current[f.key]?.trim() && f.certainty === "supported",
          )
          .map((f) => f.key),
      );
      setNotice("Suggestions are ready to review. Nothing has been saved.");
    } catch (e) {
      if (current.signal.aborted) return;
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "The AI response was invalid. Your form has not changed.",
      );
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setLoading(false);
      }
    }
  }
  function apply() {
    if (!result || !requestRef.current) return;
    try {
      validateSuggestions(
        {
          match: result.match,
          summary: result.summary,
          fields: result.fields,
          missing: result.missing,
        },
        requestRef.current,
        result.sources,
      );
      const merged = applyReviewedFields(
        values,
        baseline.current,
        result.fields,
        selected,
      );
      onApply(merged.values);
      setSelected([]);
      setError("");
      setNotice(
        `${merged.applied.length} field${merged.applied.length === 1 ? "" : "s"} filled in the draft. Nothing saved.${merged.skipped.length ? ` Kept your newer edits to: ${merged.skipped.join(", ")}.` : ""} Review the form, then use Create when ready.`,
      );
    } catch {
      setError(
        "Check your suggestions: names need 1–200 characters, details 1–2000, and targets must be positive numbers.",
      );
    }
  }
  return (
    <fieldset
      className="ai-review"
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          (e.target as HTMLElement).tagName === "INPUT" &&
          (e.target as HTMLInputElement).type !== "checkbox"
        )
          e.preventDefault();
      }}
    >
      <legend>Research, review, then fill</legend>
      <div className="ai-review-heading">
        <p>
          Only the title and context below go to OpenRouter and web search.
          Check sources before using suggestions.
        </p>
        <button
          type="button"
          className="icon-button"
          aria-label="Close AI fill"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <label>
        What should AI look up?
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={200}
          disabled={loading}
          placeholder="Book, show, film, course or recipe title"
        />
      </label>
      <label>
        Edition, version or other context
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          maxLength={1000}
          rows={3}
          disabled={loading}
          placeholder={hints[templateId]}
        />
        <small>{hints[templateId]}</small>
      </label>
      <div className="ai-actions">
        <button
          type="button"
          className="button"
          disabled={
            loading || query.trim().length < 2 || context.trim().length < 3
          }
          onClick={research}
        >
          {loading
            ? "Researching the web…"
            : result
              ? "Research again"
              : "Find suggestions"}
        </button>
        {loading && (
          <button type="button" className="button" onClick={cancel}>
            Cancel research
          </button>
        )}
      </div>
      {loading && (
        <p role="status">
          Looking for the exact work and checking source-linked fields. You can
          keep editing your form.
        </p>
      )}
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      <p className="ai-notice" role="status">
        {notice}
      </p>
      {result && (
        <>
          <div className="ai-match">
            <strong>
              {result.match === "found"
                ? "Matched work"
                : result.match === "ambiguous"
                  ? "More context needed"
                  : "No reliable match"}
            </strong>
            <p>{result.summary}</p>
          </div>
          {result.fields.length > 0 && (
            <p className="muted">
              Check each field to use it. Existing values and uncertain
              suggestions start unchecked. Newer manual edits are kept.
            </p>
          )}
          {result.fields.map((field, index) => (
            <div className="ai-suggestion" key={field.key}>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={selected.includes(field.key)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, field.key]
                        : selected.filter((key) => key !== field.key),
                    )
                  }
                />
                Use {field.key}
                <span className="ai-certainty">
                  {field.certainty === "uncertain"
                    ? "Uncertain / proposed"
                    : "Source-linked"}
                </span>
              </label>
              {!!values[field.key] && (
                <p className="ai-current">Current: {values[field.key]}</p>
              )}
              <label>
                Suggested {field.key}
                <textarea
                  rows={field.value.length > 160 ? 4 : 2}
                  value={field.value}
                  maxLength={["Title", "Name"].includes(field.key) ? 200 : 2000}
                  onChange={(e) =>
                    setResult({
                      ...result,
                      fields: result.fields.map((f, i) =>
                        i === index ? { ...f, value: e.target.value } : f,
                      ),
                    })
                  }
                />
              </label>
              {field.note && <p>{field.note}</p>}
              <div className="ai-sources">
                {field.sourceUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {result.sources.find((s) => s.url === url)?.title ||
                      new URL(url).hostname}{" "}
                    ↗
                  </a>
                ))}
              </div>
            </div>
          ))}
          {result.missing.length > 0 && (
            <div className="ai-missing">
              <strong>Missing or uncertain</strong>
              <ul>
                {result.missing.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="ai-sources">
            <summary>
              All research sources ({result.sources.length}) · {result.provider}
            </summary>
            <ul>
              {result.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <p className="muted">
            Chapter and lesson totals describe the work. They do not create
            milestones or mark anything complete. Source links stay in this
            review and are not saved with the record.
          </p>
          {result.fields.length > 0 && (
            <button
              type="button"
              className="button primary"
              disabled={!selected.length}
              onClick={apply}
            >
              Fill {selected.length} selected field
              {selected.length === 1 ? "" : "s"}
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            Discard suggestions
          </button>
        </>
      )}
    </fieldset>
  );
}
