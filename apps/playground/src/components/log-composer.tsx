"use client";
import { useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Check,
  Code2,
  LockKeyhole,
  PenLine,
  Radio,
  RotateCcw,
  Zap,
} from "lucide-react";
import type { Activity, Category, LogInput, Origin } from "../lib/types";
import {
  compatible,
  members,
  visibleActivities,
  visibleSubjects,
} from "../lib/model";
import { categories } from "../lib/templates";
import type { ViewProps } from "./playground";
import { Badge, Empty, JsonRecord, Person } from "./ui";

const sources = [
  { id: "manual", label: "Manual", icon: PenLine },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "mcp", label: "MCP", icon: Bot },
  { id: "automation", label: "Event", icon: Zap },
] as const;
const defaultUnits: Record<Category, string> = {
  reading: "chapters",
  watching: "episodes",
  movement: "km",
  cooking: "sessions",
  learning: "minutes",
  habits: "sessions",
  custom: "steps",
};
const localDate = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function LogComposer({
  db,
  userId,
  run,
  initialActivity,
}: ViewProps & { initialActivity?: Activity }) {
  const initialSubjectId =
    db.activitySubjects.find((l) => l.activityId === initialActivity?.id)
      ?.subjectId ?? null;
  const initialCategory = initialActivity?.category ?? "reading";
  const initialUnit =
    initialActivity?.progressMode === "sessions"
      ? (db.subjectTemplates.find(
          (t) =>
            t.id ===
            db.subjects.find((s) => s.id === initialSubjectId)?.templateId,
        )?.unit ?? "sessions")
      : (initialActivity?.unit ?? "chapters");
  const [category, setCategory] = useState<Category>(initialCategory);
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [quantity, setQuantity] = useState(
    initialCategory === "reading" && initialUnit === "chapters" ? "5" : "1",
  );
  const [unit, setUnit] = useState(initialUnit);
  const [title, setTitle] = useState(
    initialCategory === "reading" && initialUnit === "chapters"
      ? "Read through chapter 5"
      : "A little progress today",
  );
  const [duration, setDuration] = useState("30");
  const [occurredAt, setOccurredAt] = useState(localDate);
  const [origin, setOrigin] = useState<Origin>("manual");
  const [externalKey, setExternalKey] = useState("demo-request-1");
  const [activityIds, setActivityIds] = useState<string[]>(() =>
    initialActivity
      ? visibleActivities(db, userId)
          .filter((a) =>
            compatible(db, userId, a, {
              category: initialCategory,
              subjectId: initialSubjectId,
              unit: initialUnit,
            }),
          )
          .map((a) => a.id)
      : [],
  );
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [lastInput, setLastInput] = useState<LogInput | null>(null);
  const subjects = visibleSubjects(db, userId).filter(
    (s) =>
      db.subjectTemplates.find((t) => t.id === s.templateId)?.category ===
      category,
  );
  const eligible = visibleActivities(db, userId).filter((a) =>
    compatible(db, userId, a, { category, subjectId: subjectId || null, unit }),
  );
  const chosen = eligible.filter((a) => activityIds.includes(a.id));
  const connections = db.connections.filter((c) =>
    members(db, c.id).includes(userId),
  );
  const audiences = [
    ...new Set([
      ...connectionIds,
      ...chosen.flatMap((a) => (a.connectionId ? [a.connectionId] : [])),
    ]),
  ];
  const input: LogInput = {
    authorUserId: userId,
    subjectId: subjectId || null,
    category,
    title,
    quantity: Number(quantity),
    unit,
    durationMinutes: Number(duration),
    occurredAt: Number.isFinite(Date.parse(occurredAt))
      ? new Date(occurredAt).toISOString()
      : "",
    origin,
    externalKey: origin === "manual" ? null : externalKey.trim() || null,
    activityIds: chosen.map((a) => a.id),
    connectionIds,
  };
  const newest = db.events.slice(-3).reverse();
  return (
    <>
      <form
        className="log-composer"
        onSubmit={(e) => {
          e.preventDefault();
          const result = run(
            { type: "recordLog", actorId: userId, input },
            `One log saved. ${chosen.length} activity contribution(s), ${audiences.length} connection audience(s).`,
          );
          if (result) setLastInput(input);
        }}
      >
        <div className="composer-heading">
          <div>
            <Badge color="blue">Log</Badge>
            <h2>Make a little progress</h2>
            <p>Record once. Choose where it goes.</p>
          </div>
          <span className="composer-symbol">
            <PenLine size={22} />
          </span>
        </div>
        <fieldset className="trigger-picker">
          <legend>Trigger source</legend>
          <div>
            {sources.map((s) => (
              <label key={s.id} className={origin === s.id ? "selected" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name="origin"
                  value={s.id}
                  checked={origin === s.id}
                  onChange={() => setOrigin(s.id)}
                />
                <s.icon size={15} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        {origin !== "manual" && (
          <div className="simulation-note">
            <Code2 size={15} />
            <span>
              <strong>
                {origin === "voice"
                  ? "Voice"
                  : origin === "mcp"
                    ? "MCP"
                    : "Event"}{" "}
                simulation.
              </strong>{" "}
              A prepared payload enters the same command as manual input. No
              microphone or external service is connected.
            </span>
          </div>
        )}
        <div className="form-grid two">
          <label>
            Activity category
            <select
              value={category}
              onChange={(e) => {
                const value = e.target.value as Category;
                setCategory(value);
                setSubjectId("");
                setUnit(defaultUnits[value]);
                setActivityIds([]);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                const subject = db.subjects.find(
                  (s) => s.id === e.target.value,
                );
                if (subject)
                  setUnit(
                    db.subjectTemplates.find(
                      (t) => t.id === subject.templateId,
                    )!.unit,
                  );
                setActivityIds([]);
              }}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          What happened?
          <input
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Read through chapter 5"
          />
        </label>
        <div className="form-grid two">
          <label>
            {chosen.some((a) => a.progressMode === "position")
              ? "Position reached / quantity"
              : "Quantity"}
            <input
              required
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Unit
            <input
              required
              maxLength={100}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              list="log-units"
            />
            <datalist id="log-units">
              {[
                "chapters",
                "pages",
                "episodes",
                "sessions",
                "km",
                "minutes",
                "steps",
              ].map((u) => (
                <option value={u} key={u} />
              ))}
            </datalist>
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min="0"
              step="any"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label>
            When it happened
            <input
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>
        </div>
        {origin !== "manual" && (
          <label>
            Request key
            <input
              value={externalKey}
              maxLength={200}
              onChange={(e) => setExternalKey(e.target.value)}
              placeholder="Optional key for safe retries"
            />
            <small>Same author + source + key reuses the original log.</small>
          </label>
        )}
        <fieldset className="credit-choices">
          <legend>
            <span className="step-number ochre">1</span>Give progress to
          </legend>
          {eligible.length ? (
            eligible.map((a) => (
              <label className="credit-choice" key={a.id}>
                <input
                  type="checkbox"
                  checked={activityIds.includes(a.id)}
                  onChange={(e) =>
                    setActivityIds(
                      e.target.checked
                        ? [...activityIds, a.id]
                        : activityIds.filter((id) => id !== a.id),
                    )
                  }
                />
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {a.progressMode === "sessions"
                      ? "+1 session"
                      : a.progressMode === "position"
                        ? `Position ${quantity || "0"}`
                        : `+${quantity || "0"} ${a.unit}`}{" "}
                    ·{" "}
                    {db.connections.find((c) => c.id === a.connectionId)
                      ?.name ?? "Personal"}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted">
              No active activity matches this subject, category, and unit. You
              can still save a standalone log.
            </p>
          )}
        </fieldset>
        <fieldset className="audience-choices">
          <legend>
            <span className="step-number blue">2</span>Share an update with
          </legend>
          <p className="field-help">
            Credited connections already receive it. Extra audiences see an
            update without progress.
          </p>
          {connections.map((c) => {
            const credited = chosen.some((a) => a.connectionId === c.id);
            return (
              <label className="check-line" key={c.id}>
                <input
                  type="checkbox"
                  checked={credited || connectionIds.includes(c.id)}
                  disabled={credited}
                  onChange={(e) =>
                    setConnectionIds(
                      e.target.checked
                        ? [...connectionIds, c.id]
                        : connectionIds.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>{c.name}</span>
                {credited && <Badge color="ochre">credited</Badge>}
              </label>
            );
          })}
        </fieldset>
        <div className="distribution-preview">
          {audiences.length ? (
            <>
              <Radio size={16} />
              <span>
                {audiences.length} connection{audiences.length > 1 ? "s" : ""}{" "}
                will see this · {chosen.length} activit
                {chosen.length === 1 ? "y" : "ies"} credited
              </span>
            </>
          ) : (
            <>
              <LockKeyhole size={16} />
              <span>
                Only you will see this log
                {chosen.length ? ", with personal progress" : ""}.
              </span>
            </>
          )}
        </div>
        <button className="button primary full" type="submit">
          {origin === "manual"
            ? "Save log & follow the ripple"
            : `Simulate ${origin === "automation" ? "event" : origin} log`}
          <ArrowRight size={17} />
        </button>
        {lastInput && (
          <div className="saved-feedback">
            <Check size={14} />
            Last log recorded
            {lastInput.origin !== "manual" && lastInput.externalKey && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  run({ type: "recordLog", actorId: userId, input: lastInput })
                }
              >
                <RotateCcw size={13} />
                Replay request
              </button>
            )}
          </div>
        )}
        <JsonRecord
          label="Inspect the command payload"
          value={{ type: "recordLog", actorId: userId, input }}
        />
      </form>
      <section className="latest-ripple">
        <div className="subheading">
          <h3>
            <Radio size={16} />
            Latest ripple
          </h3>
          <span>Observer preview</span>
        </div>
        {newest.length ? (
          newest.map((e) => (
            <div key={e.id} className="ripple-row">
              <span className="event-dot" />
              <div>
                <code>{e.type}</code>
                <p>{e.message}</p>
                <div className="recipient-row">
                  {db.deliveries
                    .filter((d) => d.eventId === e.id)
                    .map((d) => (
                      <Person db={db} id={d.recipientUserId} key={d.id} />
                    ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <Empty>Save a log to see the resulting events.</Empty>
        )}
      </section>
    </>
  );
}
