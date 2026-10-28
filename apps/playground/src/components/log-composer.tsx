"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Check,
  Code2,
  PenLine,
  RotateCcw,
  Zap,
} from "lucide-react";
import type { Activity, LogInput, Origin } from "../lib/types";
import {
  completedMilestone,
  homebaseForActivity,
  logRejection,
  visibleActivities,
} from "../lib/model";
import type { ViewProps } from "./playground";
import { Badge, Empty, JsonRecord, when } from "./ui";

const sources = [
  { id: "manual", label: "Manual", icon: PenLine },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "mcp", label: "MCP", icon: Bot },
  { id: "automation", label: "Event", icon: Zap },
] as const;
const localDate = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function LogComposer({
  db,
  userId,
  run,
  initialActivity,
  initialMilestoneId,
}: ViewProps & { initialActivity?: Activity; initialMilestoneId?: string }) {
  const activities = visibleActivities(db, userId);
  const [activityId, setActivityId] = useState(
    initialActivity?.id ?? activities[0]?.id ?? "",
  );
  const activity = activities.find((a) => a.id === activityId) ?? activities[0];
  const milestones = db.milestones.filter((m) => m.activityId === activity?.id);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId ?? "");
  const [isSuccess, setIsSuccess] = useState(() => {
    const initial = milestones.find((m) => m.id === initialMilestoneId);
    return !(
      initial?.kind === "join" && completedMilestone(db, initial.id, userId)
    );
  });
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("0");
  const [occurredAt, setOccurredAt] = useState(localDate);
  const [origin, setOrigin] = useState<Origin>("manual");
  const [externalKey, setExternalKey] = useState("");
  const [lastInput, setLastInput] = useState<LogInput | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  const milestone = milestones.find((m) => m.id === milestoneId);
  const homebase = activity ? homebaseForActivity(db, activity) : null;
  const reward = db.rewards.find((r) => r.id === milestone?.rewardId);
  const rejection = milestone
    ? logRejection(db, userId, milestone, isSuccess, now)
    : "Choose a milestone.";
  const input: LogInput = {
    authorUserId: userId,
    milestoneId: milestone?.id ?? "",
    isSuccess,
    title:
      title.trim() ||
      (milestone
        ? `${isSuccess ? "Succeeded" : "Did not succeed"}: ${milestone.name}`
        : ""),
    durationMinutes: Number(duration),
    occurredAt: Number.isFinite(Date.parse(occurredAt))
      ? new Date(occurredAt).toISOString()
      : "",
    origin,
    externalKey: origin === "manual" ? null : externalKey.trim() || null,
  };
  if (!activity)
    return (
      <Empty>
        Create an activity and a milestone before recording a log.{" "}
        <a href="#activities">Open activities</a>
      </Empty>
    );
  return (
    <form
      className="log-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const result = run(
          { type: "recordLog", actorId: userId, input },
          milestone?.kind === "join"
            ? "Milestone-zero decision saved."
            : `Milestone ${isSuccess ? "completed" : "attempt recorded"}. Shared rewards update when their requirements are met.`,
        );
        if (result) {
          setLastInput(input);
          setNow(new Date().toISOString());
        }
      }}
    >
      <div className="composer-heading">
        <div>
          <Badge color="blue">Milestone log</Badge>
          <h2>One small achievement</h2>
          <p>Choose a milestone, then record its outcome.</p>
        </div>
        <PenLine size={22} />
      </div>
      <div className="form-grid two">
        <label>
          Activity
          <select
            value={activity.id}
            onChange={(event) => {
              setActivityId(event.target.value);
              setMilestoneId("");
              setTitle("");
              setLastInput(null);
            }}
          >
            {activities.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Milestone
          <select
            required
            value={milestone?.id ?? ""}
            onChange={(event) => {
              setMilestoneId(event.target.value);
              setTitle("");
              const selected = milestones.find(
                (m) => m.id === event.target.value,
              );
              setIsSuccess(
                !(
                  selected?.kind === "join" &&
                  completedMilestone(db, selected.id, userId)
                ),
              );
            }}
          >
            <option value="">Choose a milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.kind === "join"
                  ? "0 · Automatic activity start / leave"
                  : m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {milestone && (
        <div className="milestone-log-context">
          <div className="badge-row">
            <Badge color="ochre">
              {milestone.kind === "join"
                ? "Milestone zero"
                : milestone.policy === "open"
                  ? "Open · any time"
                  : milestone.policy === "paced"
                    ? "Paced · start to end"
                    : "Deadline · until end"}
            </Badge>
            <Badge>{homebase?.name}</Badge>
          </div>
          {milestone.startAt && <p>Starts: {when(milestone.startAt)}</p>}
          {milestone.endAt && <p>Ends: {when(milestone.endAt)}</p>}
          {milestone.kind !== "join" && (
            <p>
              {activity.progressMode === "position" ? "Position" : "Progress"}:{" "}
              {milestone.quantity} {activity.unit}. Other milestones stay
              unchanged.
            </p>
          )}
          {reward && (
            <p>
              Shared reward:{" "}
              <strong>
                {db.rewardItems.find((item) => item.id === reward.itemId)?.name}
              </strong>
              {reward.obtainedAt
                ? " · already earned"
                : ` · requires ${reward.requiredUserIds.map((id) => db.users.find((u) => u.id === id)?.name).join(", ")}`}
            </p>
          )}
        </div>
      )}
      <label>
        Outcome
        <select
          value={String(isSuccess)}
          onChange={(event) => setIsSuccess(event.target.value === "true")}
        >
          <option value="true">
            {milestone?.kind === "join"
              ? "Join this activity"
              : "Success · achieved this milestone"}
          </option>
          <option value="false">
            {milestone?.kind === "join"
              ? "Decline / leave this activity"
              : "Failure · record an unsuccessful attempt"}
          </option>
        </select>
      </label>
      <label>
        Note
        <input
          maxLength={500}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            milestone ? input.title : "Optional note about this attempt"
          }
        />
      </label>
      <div className="form-grid two">
        <label>
          When it happened
          <input
            required
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>
        <label>
          Duration (minutes)
          <input
            required
            type="number"
            min="0"
            step="any"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
      </div>
      <p className="field-help">
        Schedules are checked at submission. Changing the occurrence time cannot
        reopen a closed window. Failed attempts give no progress or reward.
      </p>
      <fieldset className="trigger-picker">
        <legend>Trigger source</legend>
        <div>
          {sources.map((source) => (
            <label
              key={source.id}
              className={origin === source.id ? "selected" : ""}
            >
              <input
                className="sr-only"
                type="radio"
                name="origin"
                checked={origin === source.id}
                onChange={() => setOrigin(source.id)}
              />
              <source.icon size={15} />
              {source.label}
            </label>
          ))}
        </div>
      </fieldset>
      {origin !== "manual" && (
        <>
          <p className="simulation-note">
            <Code2 size={15} /> Simulated input uses the same milestone rules.
            No external service is connected.
          </p>
          <label>
            Request key
            <input
              maxLength={200}
              value={externalKey}
              onChange={(event) => setExternalKey(event.target.value)}
              placeholder="Optional key for safe retries"
            />
            <small>
              The same author, source and key returns the original log.
            </small>
          </label>
        </>
      )}
      <div className="distribution-preview">
        <span>
          {`Visible to ${homebase?.name}.`} A successful achievement counts only
          toward {activity.name}.
        </span>
      </div>
      {rejection && (
        <p className="field-help" role="status">
          {rejection}
        </p>
      )}
      <button
        className="button primary full"
        type="submit"
        disabled={Boolean(rejection)}
      >
        Save milestone log <ArrowRight size={17} />
      </button>
      {lastInput && (
        <div className="saved-feedback">
          <Check size={14} />
          Last log recorded
          {lastInput.externalKey && (
            <button
              type="button"
              className="text-button"
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
  );
}
