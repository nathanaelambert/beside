"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info, LoaderCircle, Sparkles, X } from "lucide-react";
import {
  aiResponseSchema,
  fillTemplate,
  validateSuggestions,
  type AiRequest,
  type AiResponse,
} from "../lib/ai-fill";
import {
  buildDraftRequest,
  fillDraft,
  undoDraft,
  type DraftChange,
} from "../lib/ai-draft";

type Props = {
  kind: AiRequest["kind"];
  templateId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
  placeholder: string;
  query?: string;
  lookupDetails?: Record<string, string>;
  replaceable?: string[];
};

export function AiFillInput(props: Props) {
  const inputId = useId();
  const popoverId = useId();
  const statusId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<AiResponse | null>(null);
  const [changes, setChanges] = useState<DraftChange[]>([]);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  useEffect(() => () => controller.current?.abort(), []);

  const query = props.query ?? props.value;
  const supported = !!fillTemplate(props.kind, props.templateId);
  const enabled = supported && query.trim().length > 0;
  const usedSources =
    result?.sources.filter((source) =>
      result.fields.some(
        (field) =>
          changes.some((change) => change.key === field.key) &&
          field.sourceUrls.includes(source.url),
      ),
    ) ?? [];
  const shownSources = usedSources.length
    ? usedSources
    : (result?.sources ?? []);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
    setNotice("AI fill cancelled.");
  }

  async function research() {
    if (loading) {
      cancel();
      return;
    }
    if (!enabled) return;
    const current = new AbortController();
    controller.current = current;
    const baseline = { ...props.values };
    const request = buildDraftRequest(
      props.kind,
      props.templateId,
      query,
      props.lookupDetails ?? props.values,
    );
    const replaceable = props.replaceable ?? [];
    setLoading(true);
    setError("");
    setNotice("Filling details…");
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
            : "AI fill failed. Try again.",
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
      const now = latest.current;
      const nowRequest = buildDraftRequest(
        now.kind,
        now.templateId,
        now.query ?? now.value,
        now.lookupDetails ?? now.values,
      );
      if (
        nowRequest.query !== request.query ||
        nowRequest.context !== request.context
      ) {
        setNotice("Lookup details changed. Try AI fill again.");
        return;
      }
      setResult(verified);
      if (verified.match === "not_found") {
        const hint =
          props.kind === "subject"
            ? {
                book: "Add an author or edition",
                series: "Add a creator or season",
                movie: "Add a director or year",
                course: "Add a provider or version",
                recipe: "Add an author or recipe URL",
              }[props.templateId]
            : "Add the work's title and version";
        setNotice(
          `No reliable match. ${hint ?? "Add more detail"} and try again.`,
        );
        return;
      }
      const filled = fillDraft(
        now.values,
        baseline,
        verified,
        props.kind,
        replaceable.filter((key) => now.replaceable?.includes(key)),
      );
      if (filled.changes.length) {
        now.onApply(filled.values);
        setChanges(filled.changes);
        setNotice(
          `AI filled ${filled.changes.length} field${filled.changes.length === 1 ? "" : "s"}${verified.match === "ambiguous" ? " using the most likely match" : ""}. Review before creating.`,
        );
      } else {
        setNotice(
          filled.skipped.length
            ? "Kept your newer edits. Nothing filled."
            : "No empty details could be filled. Your entries are kept.",
        );
      }
    } catch (e) {
      if (current.signal.aborted) return;
      setNotice("");
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "AI returned invalid details. Your entries are kept.",
      );
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setLoading(false);
      }
    }
  }

  const buttonTitle = !supported
    ? "AI fill is not available for this template"
    : loading
      ? "Cancel AI fill"
      : !enabled
        ? "Enter a title to fill details using AI"
        : "Fill empty details using AI";
  return (
    <div className="ai-input-field">
      <div className="ai-input-label-row">
        <label htmlFor={inputId}>{props.label}</label>
        {result && (
          <button
            type="button"
            className="ai-info-button"
            aria-label="About AI-filled details"
            title="About AI-filled details"
            popoverTarget={popoverId}
          >
            <Info size={14} />
          </button>
        )}
      </div>
      <div className="ai-input-wrap" aria-busy={loading}>
        <input
          id={inputId}
          value={props.value}
          placeholder={props.placeholder}
          maxLength={200}
          required
          aria-describedby={statusId}
          onChange={(e) => {
            const wasPending = !!controller.current;
            if (wasPending) cancel();
            setError("");
            setResult(null);
            if (changes.length)
              setNotice("Title changed. Check the filled details.");
            else if (!wasPending) setNotice("");
            props.onChange(e.target.value);
          }}
        />
        <button
          type="button"
          className={`ai-input-suffix${loading ? " is-loading" : ""}`}
          aria-label={loading ? "Cancel AI fill" : "Fill using AI"}
          title={buttonTitle}
          disabled={!loading && !enabled}
          onClick={research}
        >
          {loading ? (
            <LoaderCircle size={17} className="ai-loading-icon" />
          ) : (
            <Sparkles size={17} />
          )}
        </button>
      </div>
      <div id={statusId} className="ai-input-feedback">
        {error ? (
          <p role="alert" className="ai-input-error">
            {error}
          </p>
        ) : (
          <p role="status">{notice}</p>
        )}
        {!!changes.length && !loading && (
          <button
            type="button"
            className="ai-undo"
            onClick={() => {
              props.onApply(undoDraft(props.values, changes));
              setChanges([]);
              setResult(null);
              setError("");
              setNotice("AI fill undone. Your edits are kept.");
            }}
          >
            Undo
          </button>
        )}
      </div>
      {result && (
        <div
          id={popoverId}
          popover="auto"
          className="ai-info-popover"
          role="dialog"
          aria-label="AI fill information"
        >
          <div className="ai-info-heading">
            <strong>AI fill details</strong>
            <button
              type="button"
              aria-label="Close AI fill information"
              popoverTarget={popoverId}
              popoverTargetAction="hide"
            >
              <X size={16} />
            </button>
          </div>
          <p>{result.summary}</p>
          {(!!result.missing.length ||
            result.fields.some((f) => f.certainty === "uncertain")) && (
            <details>
              <summary>Missing or uncertain details</summary>
              <ul>
                {result.missing.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {result.fields
                  .filter((f) => f.certainty === "uncertain")
                  .map((field) => (
                    <li key={field.key}>
                      {field.key}:{" "}
                      {field.note ||
                        "Uncertain suggestion; check before creating."}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          <ul className="ai-info-sources">
            {shownSources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title} ↗
                </a>
              </li>
            ))}
          </ul>
          <small>
            Sources are only kept for this draft and are never saved to the
            subject or activity.
          </small>
        </div>
      )}
    </div>
  );
}
