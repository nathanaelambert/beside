"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type {
  ApiState,
  UpdateActivityInput,
  UpdateMilestoneInput,
} from "@beside/api-client";
import type { Activity, Homebase, Milestone } from "../lib/types";
import { milestoneSubtree } from "../lib/model";

type Saved = boolean | Promise<boolean>;

export function RecordManager({
  kind,
  name,
  description,
  busy = false,
  onDelete,
  editor,
}: {
  kind: "home base" | "activity" | "milestone";
  name: string;
  description: string;
  busy?: boolean;
  onDelete: () => Saved;
  editor: (close: () => void) => ReactNode;
}) {
  const [mode, setMode] = useState<"closed" | "edit" | "delete">("closed");
  if (mode === "edit")
    return (
      <div className="record-editor">{editor(() => setMode("closed"))}</div>
    );
  if (mode === "delete")
    return (
      <div
        className="delete-confirmation"
        role="group"
        aria-label={`Confirm deletion of ${name}`}
      >
        <strong>Delete “{name}”?</strong>
        <p>{description} This cannot be undone.</p>
        <div className="record-actions">
          <button
            className="button small secondary"
            type="button"
            disabled={busy}
            onClick={() => setMode("closed")}
          >
            Cancel
          </button>
          <button
            className="button small danger"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await onDelete()) setMode("closed");
            }}
          >
            Delete {kind}
          </button>
        </div>
      </div>
    );
  return (
    <div className="record-actions">
      <button
        className="button small secondary"
        type="button"
        aria-label={`Edit ${kind} ${name}`}
        disabled={busy}
        onClick={() => setMode("edit")}
      >
        <Pencil size={14} /> Edit
      </button>
      <button
        className="button small secondary"
        type="button"
        aria-label={`Delete ${kind} ${name}`}
        disabled={busy}
        onClick={() => setMode("delete")}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}

function SaveButtons({ cancel }: { cancel: () => void }) {
  return (
    <div className="record-actions">
      <button className="button small" type="submit">
        Save changes
      </button>
      <button className="button small secondary" type="button" onClick={cancel}>
        Cancel
      </button>
    </div>
  );
}

export function HomebaseEditor({
  base,
  busy,
  save,
  cancel,
}: {
  base: Homebase;
  busy?: boolean;
  save: (name: string) => Saved;
  cancel: () => void;
}) {
  return (
    <form
      aria-label={`Edit home base ${base.name}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (await save(String(data.get("name")))) cancel();
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Home-base name
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={base.name}
          />
        </label>
        <p className="field-help">
          Renaming keeps its members and invitation code.
        </p>
        <SaveButtons cancel={cancel} />
      </fieldset>
    </form>
  );
}

export function ActivityEditor({
  activity,
  target,
  busy,
  save,
  cancel,
}: {
  activity: Activity;
  target?: number;
  busy?: boolean;
  save: (input: UpdateActivityInput) => Saved;
  cancel: () => void;
}) {
  return (
    <form
      aria-label={`Edit activity ${activity.name}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (
          await save({
            name: String(data.get("name")),
            description: String(data.get("description")),
            ...(target === undefined
              ? {}
              : { target: Number(data.get("target")) }),
          })
        )
          cancel();
      }}
    >
      <fieldset disabled={busy}>
        <div className="form-grid two">
          <label>
            Activity name
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={activity.name}
            />
          </label>
          {target !== undefined && (
            <label>
              Your target
              <input
                name="target"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={target}
              />
            </label>
          )}
          <label className="span-two">
            Description
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={activity.description}
              rows={2}
            />
          </label>
        </div>
        <p className="field-help">
          Name and description change for everyone.{" "}
          {target !== undefined && "Your target applies only to you. "}The
          template and home base stay fixed.
        </p>
        <SaveButtons cancel={cancel} />
      </fieldset>
    </form>
  );
}

type MilestoneData = Pick<
  ApiState,
  "milestones" | "logs" | "rewards" | "rewardItems"
>;
const localDate = (value: string | null) =>
  value
    ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export function MilestoneEditor({
  milestone,
  data,
  busy,
  save,
  cancel,
}: {
  milestone: Milestone;
  data: MilestoneData;
  busy?: boolean;
  save: (input: UpdateMilestoneInput) => Saved;
  cancel: () => void;
}) {
  const [policy, setPolicy] = useState(milestone.policy);
  const logged = data.logs.some((log) => log.milestoneId === milestone.id);
  const subtree = milestoneSubtree(data, milestone.id);
  return (
    <form
      aria-label={`Edit milestone ${milestone.name}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const iso = (field: string) => {
          const value = String(values.get(field) ?? "");
          return value ? new Date(value).toISOString() : null;
        };
        const changes: UpdateMilestoneInput = {
          name: String(values.get("name")),
        };
        if (!logged)
          Object.assign(changes, {
            parentId: String(values.get("parentId")),
            quantity: Number(values.get("quantity")),
            policy,
            startAt: policy === "paced" ? iso("startAt") : null,
            endAt: policy === "open" ? null : iso("endAt"),
            itemId: String(values.get("itemId")) || null,
          });
        if (await save(changes)) cancel();
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Milestone name
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={milestone.name}
          />
        </label>
        <p className="field-help">
          {logged
            ? "This milestone has logs. Its name can change; recorded quantities, schedule, parent and reward rules are fixed."
            : "Quantity, schedule, parent and reward can change until the first log. Existing reward requirements stay fixed."}
        </p>
        <fieldset disabled={logged}>
          <div className="form-grid two">
            <label>
              Parent milestone
              <select name="parentId" defaultValue={milestone.parentId}>
                {data.milestones
                  .filter(
                    (parent) =>
                      parent.activityId === milestone.activityId &&
                      !subtree.has(parent.id),
                  )
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.kind === "join"
                        ? "Activity root (milestone zero)"
                        : parent.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Quantity / position
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={milestone.quantity}
              />
            </label>
            <label>
              Logging policy
              <select
                name="policy"
                value={policy}
                onChange={(event) =>
                  setPolicy(event.target.value as typeof policy)
                }
              >
                <option value="open">Open · any time</option>
                <option value="paced">Paced · start/end window</option>
                <option value="deadline">Deadline · until end</option>
              </select>
            </label>
            {policy === "paced" && (
              <label>
                Window starts
                <input
                  name="startAt"
                  type="datetime-local"
                  required
                  defaultValue={localDate(milestone.startAt)}
                />
              </label>
            )}
            {policy !== "open" && (
              <label>
                {policy === "paced" ? "Window ends" : "Deadline"}
                <input
                  name="endAt"
                  type="datetime-local"
                  required
                  defaultValue={localDate(milestone.endAt)}
                />
              </label>
            )}
            <label>
              Reward item
              <select
                name="itemId"
                defaultValue={
                  data.rewards.find(
                    (reward) => reward.id === milestone.rewardId,
                  )?.itemId ?? ""
                }
              >
                <option value="">No reward</option>
                {data.rewardItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <SaveButtons cancel={cancel} />
      </fieldset>
    </form>
  );
}
