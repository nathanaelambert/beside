"use client";

import { useState } from "react";
import { ArrowRight, Check, Flag, Plus } from "lucide-react";
import type { Activity, LoggingPolicy } from "../lib/types";
import {
  completedMilestone,
  homebaseForActivity,
  participation,
  scheduleStatus,
  visibleActivities,
} from "../lib/model";
import type { ViewProps } from "./playground";
import { Badge, Empty, JsonRecord, Person, when } from "./ui";
import { PixelSprite } from "./reward-items";
import { RecordManager, MilestoneEditor } from "./record-management";

export type RecordMilestone = (
  activityId?: string,
  milestoneId?: string,
) => void;
export function Milestones(props: ViewProps & { onRecord: RecordMilestone }) {
  const activities = visibleActivities(props.db, props.userId);
  const [selectedId, setSelectedId] = useState("");
  const activity = activities.find((a) => a.id === selectedId) ?? activities[0];
  return (
    <div className="milestones-page">
      <div className="section-heading">
        <div>
          <h2>Milestones</h2>
          <p>
            A chapter, an episode, a workout day. One achievement at a time.
          </p>
        </div>
        <Flag size={24} />
      </div>
      <label className="milestone-activity-picker">
        Activity
        <select
          value={activity?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {activity ? (
        <ActivityMilestones key={activity.id} {...props} activity={activity} />
      ) : (
        <Empty>
          <a href="#activities">Create an activity</a> to start planning
          milestones.
        </Empty>
      )}
    </div>
  );
}
export function ActivityMilestones({
  db,
  userId,
  run,
  activity,
  onRecord,
}: ViewProps & { activity: Activity; onRecord: RecordMilestone }) {
  const [creating, setCreating] = useState(false);
  const milestones = db.milestones.filter((m) => m.activityId === activity.id);
  const achievements = milestones.filter((m) => m.kind === "achievement");
  const root = milestones.find((m) => m.kind === "join");
  const mine = participation(db, activity.id, userId);
  const complete = achievements.filter((m) =>
    completedMilestone(db, m.id, userId),
  ).length;
  return (
    <section
      className="milestone-section"
      aria-label={`${activity.name} milestones`}
    >
      <div className="subheading">
        <div>
          <h3>Milestones</h3>
          <p className="muted">
            {complete} of {achievements.length} achieved by you
          </p>
        </div>
        <button
          className="button small"
          disabled={mine?.status !== "active"}
          onClick={() => setCreating(!creating)}
        >
          <Plus size={15} />
          {creating ? "Close form" : "New milestone"}
        </button>
      </div>
      {root && (
        <div className="milestone-zero">
          <div>
            <Badge color="blue">0 · Participation</Badge>
            <p>
              The first milestone is logged automatically for every participant
              when the activity starts. It gives no achievement credit and
              cannot be edited or deleted separately.
            </p>
            <small>
              Your status: {mine?.status ?? "not participating"}. Leaving
              preserves your history and the reward's required participants.
            </small>
          </div>
          <button
            className="button small"
            disabled={mine?.status === "left"}
            onClick={() => onRecord(activity.id, root.id)}
          >
            {mine?.status === "active"
              ? "Leave activity"
              : mine?.status === "left"
                ? "Left activity"
                : "Record decision"}{" "}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {creating && (
        <MilestoneForm
          key={activity.id}
          db={db}
          userId={userId}
          run={run}
          activity={activity}
          onCreated={() => setCreating(false)}
        />
      )}
      {!achievements.length && (
        <Empty>
          No achievements planned yet. Join the activity, then add its first
          milestone.
        </Empty>
      )}
      <ol className="milestone-list">
        {achievements.map((milestone) => {
          const done = completedMilestone(db, milestone.id, userId);
          const closed = scheduleStatus(milestone, new Date().toISOString());
          const reward = db.rewards.find((r) => r.id === milestone.rewardId);
          const item = db.rewardItems.find((i) => i.id === reward?.itemId);
          const parent = milestones.find((m) => m.id === milestone.parentId);
          const successes = db.logs.filter(
            (l) => l.milestoneId === milestone.id && l.isSuccess,
          );
          return (
            <li
              key={milestone.id}
              className={`milestone-row ${done ? "achieved" : ""}`}
            >
              <span className="milestone-marker" aria-hidden="true">
                {done ? <Check size={17} /> : <Flag size={17} />}
              </span>
              <div className="milestone-content">
                <div className="badge-row">
                  <h4>{milestone.name}</h4>
                  <Badge color={done ? "moss" : "ochre"}>
                    {done ? "Achieved by you" : milestone.policy}
                  </Badge>
                </div>
                {parent?.kind !== "join" && (
                  <p className="muted">Within: {parent?.name}</p>
                )}
                <p>
                  {activity.progressMode === "position"
                    ? "Position"
                    : "Quantity"}{" "}
                  {milestone.quantity} {activity.unit}
                  {milestone.startAt
                    ? ` · From ${when(milestone.startAt)}`
                    : ""}
                  {milestone.endAt ? ` · Until ${when(milestone.endAt)}` : ""}
                </p>
                {closed && !done && <p className="muted">{closed}</p>}
                <div className="recipient-row">
                  {successes.map((log) => (
                    <Person key={log.id} db={db} id={log.authorUserId} />
                  ))}
                  {!successes.length && (
                    <small className="muted">No completions yet</small>
                  )}
                </div>
                {reward && item && (
                  <div className="milestone-reward">
                    <PixelSprite item={item} />
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {reward.obtainedAt
                          ? `Earned for ${homebaseForActivity(db, activity)?.name}`
                          : `Shared reward · ${reward.requiredUserIds.filter((id) => successes.some((log) => log.authorUserId === id)).length} / ${reward.requiredUserIds.length} required people`}
                      </p>
                      <small>
                        {reward.requiredUserIds
                          .map((id) => db.users.find((u) => u.id === id)?.name)
                          .join(", ")}
                      </small>
                    </div>
                  </div>
                )}
                <RecordManager
                  kind="milestone"
                  name={milestone.name}
                  description="This deletes this milestone and its descendants for every participant, including their logs, progress and attached rewards."
                  onDelete={() =>
                    !!run(
                      {
                        type: "deleteMilestone",
                        actorId: userId,
                        milestoneId: milestone.id,
                      },
                      "Milestone and child milestones deleted.",
                    )
                  }
                  editor={(close) => (
                    <MilestoneEditor
                      milestone={milestone}
                      data={db}
                      cancel={close}
                      save={(changes) =>
                        !!run(
                          {
                            type: "updateMilestone",
                            actorId: userId,
                            milestoneId: milestone.id,
                            changes,
                          },
                          "Milestone updated.",
                        )
                      }
                    />
                  )}
                />
                <JsonRecord value={{ milestone, reward }} />
              </div>
              {done ? (
                <a className="button small" href="#logs">
                  View logbook <ArrowRight size={14} />
                </a>
              ) : (
                <button
                  className="button small"
                  onClick={() => onRecord(activity.id, milestone.id)}
                >
                  Record outcome <ArrowRight size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
function MilestoneForm({
  db,
  userId,
  run,
  activity,
  onCreated,
}: ViewProps & { activity: Activity; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [policy, setPolicy] = useState<LoggingPolicy>("open");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [itemId, setItemId] = useState("");
  const required = db.participations.filter(
    (p) => p.activityId === activity.id && p.status === "active",
  );
  const iso = (value: string) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : null;
  return (
    <form
      className="creation-panel milestone-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          run(
            {
              type: "createMilestone",
              actorId: userId,
              activityId: activity.id,
              parentId: parentId || null,
              name,
              quantity: Number(quantity),
              policy,
              startAt: policy === "paced" ? iso(start) : null,
              endAt: policy !== "open" ? iso(end) : null,
              itemId: itemId || null,
            },
            "Milestone planned. The reward's required participants are fixed at creation.",
          )
        )
          onCreated();
      }}
    >
      <h4>Plan a milestone</h4>
      <div className="form-grid two">
        <label>
          Name
          <input
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Chapter 1, Episode 2, Monday workout…"
          />
        </label>
        <label>
          Parent milestone
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Activity root (milestone zero)</option>
            {db.milestones
              .filter(
                (m) => m.activityId === activity.id && m.kind === "achievement",
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          {activity.progressMode === "position"
            ? "Position reached"
            : "Quantity"}{" "}
          ({activity.unit})
          <input
            required
            type="number"
            min="0.01"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label>
          Logging policy
          <select
            value={policy}
            onChange={(event) => setPolicy(event.target.value as LoggingPolicy)}
          >
            <option value="open">Open · any time</option>
            <option value="paced">Paced · within a start/end window</option>
            <option value="deadline">Deadline · any time until end</option>
          </select>
        </label>
        {policy === "paced" && (
          <label>
            Window starts
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
        )}
        {policy !== "open" && (
          <label>
            {policy === "paced" ? "Window ends" : "Deadline"}
            <input
              type="datetime-local"
              required
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        )}
        <label>
          Reward item (optional)
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
          >
            <option value="">No reward</option>
            {db.rewardItems.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.category}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="field-help">
        {policy === "open"
          ? "No time restrictions."
          : policy === "paced"
            ? "Logs before the start or after the end are refused."
            : "Logs after the deadline are refused. Several milestones can be completed in one session."}{" "}
        Parents organize milestones; they never complete other milestones
        automatically.
      </p>
      {itemId && (
        <p className="field-help">
          One item for {homebaseForActivity(db, activity)?.name}, after all
          currently joined participants succeed:{" "}
          {required
            .map((p) => db.users.find((u) => u.id === p.userId)?.name)
            .join(", ")}
          . This roster is saved with the reward; leaving cannot reduce it.
        </p>
      )}
      <button className="button primary" type="submit">
        <Plus size={15} />
        Create milestone
      </button>
    </form>
  );
}
