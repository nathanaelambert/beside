"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Link2,
  LockKeyhole,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { Activity, Database } from "../lib/types";
import {
  members,
  participation,
  progress,
  visibleActivities,
  visibleSubjects,
} from "../lib/model";
import { categories } from "../lib/templates";
import {
  Avatar,
  Badge,
  CategoryIcon,
  Empty,
  JsonRecord,
  Person,
  shortId,
} from "./ui";
import type { ViewProps } from "./playground";
import { LogComposer } from "./log-composer";
import { AiFillInput } from "./ai-fill";

export function Workbench({ db, userId, run }: ViewProps) {
  const [selectedId, setSelectedId] = useState("");
  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [creating, setCreating] = useState(false);
  const activities = visibleActivities(db, userId).filter(
    (a) =>
      (scope === "all" ||
        (scope === "personal"
          ? a.personalOwnerId === userId
          : a.connectionId === scope)) &&
      (category === "all" || a.category === category),
  );
  const selected = activities.find((a) => a.id === selectedId) ?? activities[0];
  const connections = db.connections.filter((c) =>
    members(db, c.id).includes(userId),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your experiments</h2>
          <p>One shared purpose, a separate commitment for each person.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setCreating(!creating)}
        >
          {creating ? <X size={16} /> : <Plus size={16} />}
          {creating ? "Close form" : "New activity"}
        </button>
      </div>
      {creating && (
        <ActivityForm
          db={db}
          userId={userId}
          run={run}
          onCreated={(activityId) => {
            setSelectedId(activityId);
            setScope("all");
            setCategory("all");
            setCreating(false);
          }}
        />
      )}
      <div className="workbench-grid">
        <section className="activity-area">
          <div className="filter-row">
            <label>
              <span className="sr-only">Activity scope</span>
              <select
                aria-label="Activity scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="all">All my spaces</option>
                <option value="personal">Personal only</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Activity category</span>
              <select
                aria-label="Activity category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Every activity</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <span>{activities.length} visible</span>
          </div>
          <div className="activity-list">
            {activities.map((a) => {
              const p = participation(db, a.id, userId);
              const stats = p ? progress(db, p) : null;
              const people = db.participations.filter(
                (p) => p.activityId === a.id,
              );
              return (
                <button
                  className={`activity-card ${selected?.id === a.id ? "selected" : ""}`}
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  aria-pressed={selected?.id === a.id}
                >
                  <span className="activity-symbol">
                    <CategoryIcon category={a.category} size={21} />
                  </span>
                  <span className="activity-card-content">
                    <span className="activity-card-name">{a.name}</span>
                    <span className="activity-card-scope">
                      {a.connectionId ? (
                        <Users size={12} />
                      ) : (
                        <LockKeyhole size={12} />
                      )}
                      {db.connections.find((c) => c.id === a.connectionId)
                        ?.name ?? "Personal"}
                    </span>
                    <span className="mini-progress">
                      <span style={{ width: `${stats?.percent ?? 0}%` }} />
                    </span>
                  </span>
                  <span className="activity-card-end">
                    <span className="avatar-stack">
                      {people.map((p) => (
                        <Avatar
                          key={p.id}
                          user={db.users.find((u) => u.id === p.userId)!}
                          small
                        />
                      ))}
                    </span>
                    <span>
                      {p?.status === "invited"
                        ? "Invited"
                        : `${stats?.value ?? 0} / ${p?.target ?? "—"}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!activities.length && (
            <Empty>
              No activities in this view yet. Start one from a template or
              choose another space.
            </Empty>
          )}
          {selected && (
            <ActivityDetail
              key={selected.id}
              activity={selected}
              db={db}
              userId={userId}
              run={run}
            />
          )}
          <div className="experiment-tip">
            <span>TRY THIS</span>
            <p>
              Log chapter 5 in <strong>Dune</strong> and credit both reading
              activities. Switch to Nathaniel, then Rishik, to see their
              different views.
            </p>
            <ArrowRight size={18} />
          </div>
        </section>
        <aside className="composer-area">
          {selected ? (
            <LogComposer
              key={selected.id}
              {...{ db, userId, run }}
              initialActivity={selected}
            />
          ) : (
            <LogComposer {...{ db, userId, run }} />
          )}
        </aside>
      </div>
    </>
  );
}

function ActivityForm({
  db,
  userId,
  run,
  onCreated,
}: ViewProps & { onCreated: (id: string) => void }) {
  const [templateId, setTemplateId] = useState(db.activityTemplates[0]!.id);
  const template = db.activityTemplates.find((t) => t.id === templateId)!;
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState(String(template.target));
  const [targetEdited, setTargetEdited] = useState(false);
  const [connectionId, setConnectionId] = useState("personal");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [inviteOthers, setInviteOthers] = useState(true);
  const subjects = visibleSubjects(db, userId).filter(
    (s) =>
      db.subjectTemplates.find((t) => t.id === s.templateId)?.category ===
      template.category,
  );
  return (
    <form
      className="creation-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const result = run(
          {
            type: "createActivity",
            actorId: userId,
            templateId,
            name,
            description,
            connectionId: connectionId === "personal" ? null : connectionId,
            subjectIds,
            target: Number(target),
            inviteOthers,
          },
          "Activity created. Its ownership and participation records are ready to inspect.",
        );
        if (result) onCreated(result.entityId);
      }}
    >
      <div className="form-title">
        <Badge color="ochre">Activity</Badge>
        <h3>Start with an intention</h3>
      </div>
      <div className="form-grid three">
        <label>
          Template
          <select
            value={templateId}
            onChange={(e) => {
              const t = db.activityTemplates.find(
                (t) => t.id === e.target.value,
              )!;
              setTemplateId(t.id);
              setName(t.name);
              setTarget(String(t.target));
              setTargetEdited(false);
              setSubjectIds([]);
            }}
          >
            {db.activityTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <AiFillInput
          key={templateId}
          kind="activity"
          templateId={templateId}
          label="Activity name"
          value={name}
          onChange={setName}
          query={
            subjectIds.length === 1
              ? (subjects.find((s) => s.id === subjectIds[0])?.title ?? name)
              : name === template.name
                ? ""
                : name
          }
          lookupDetails={
            subjectIds.length === 1
              ? subjects.find((s) => s.id === subjectIds[0])?.metadata
              : undefined
          }
          values={{ Name: name, Description: description, Target: target }}
          replaceable={targetEdited ? [] : ["Target"]}
          onApply={(values) => {
            setName(values.Name ?? name);
            setDescription(values.Description ?? description);
            setTarget(values.Target ?? target);
          }}
          placeholder="What would you like to do?"
        />
        <label>
          Owner
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
          >
            <option value="personal">Personal · just me</option>
            {db.connections
              .filter((c) => members(db, c.id).includes(userId))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Starting personal target
          <input
            type="number"
            min="0.01"
            step="any"
            value={target}
            required
            onChange={(e) => {
              setTarget(e.target.value);
              setTargetEdited(true);
            }}
          />
          <small>{template.unit}, sandbox total</small>
        </label>
        <label className="span-two">
          Description (optional)
          <input
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={template.description}
          />
        </label>
      </div>
      <fieldset className="subject-choices">
        <legend>Subjects (optional, choose any number)</legend>
        {subjects.length ? (
          subjects.map((s) => (
            <label className="check-chip" key={s.id}>
              <input
                type="checkbox"
                checked={subjectIds.includes(s.id)}
                onChange={(e) =>
                  setSubjectIds(
                    e.target.checked
                      ? [...subjectIds, s.id]
                      : subjectIds.filter((id) => id !== s.id),
                  )
                }
              />
              {s.title}
            </label>
          ))
        ) : (
          <p className="muted">
            Create a matching subject in the Subjects tab, or start without one.
          </p>
        )}
      </fieldset>
      <div className="form-bottom">
        <p className="muted">
          {template.progressMode === "position"
            ? "Progress uses the furthest position reached."
            : template.progressMode === "sessions"
              ? "Each distinct log counts as one session."
              : "Progress adds up matching quantities."}
        </p>
        {connectionId !== "personal" && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={inviteOthers}
              onChange={(e) => setInviteOthers(e.target.checked)}
            />
            Invite others instead of joining them immediately
          </label>
        )}
        <button className="button primary" type="submit">
          <Plus size={16} />
          Create activity
        </button>
      </div>
    </form>
  );
}
function ActivityDetail({
  activity: a,
  db,
  userId,
  run,
}: ViewProps & { activity: Activity }) {
  const mine = participation(db, a.id, userId);
  const [target, setTarget] = useState(String(mine?.target ?? 1));
  const [linkId, setLinkId] = useState("");
  const links = db.activitySubjects.filter((l) => l.activityId === a.id);
  const subjects = visibleSubjects(db, userId).filter(
    (s) =>
      db.subjectTemplates.find((t) => t.id === s.templateId)?.category ===
        a.category && !links.some((l) => l.subjectId === s.id),
  );
  const participants = db.participations.filter((p) => p.activityId === a.id);
  return (
    <section className="activity-detail" aria-label="Selected activity">
      <div className="detail-heading">
        <div>
          <Badge color="ochre">Activity</Badge>
          <h3>{a.name}</h3>
        </div>
        <code>{shortId(a.id)}</code>
      </div>
      <p>{a.description || "A shared intention, ready to explore."}</p>
      <div className="ownership-line">
        <span>Owner</span>
        <strong>
          {db.connections.find((c) => c.id === a.connectionId)?.name ??
            db.users.find((u) => u.id === a.personalOwnerId)?.name}
        </strong>
        <span>
          Created by{" "}
          <b>{db.users.find((u) => u.id === a.creatorUserId)?.name}</b>
        </span>
      </div>
      <div className="linked-subjects">
        <span className="eyebrow">SUBJECTS</span>
        {links.length ? (
          links.map((l) => (
            <Badge color="moss" key={l.id}>
              <CategoryIcon category={a.category} size={13} />
              {db.subjects.find((s) => s.id === l.subjectId)?.title}
            </Badge>
          ))
        ) : (
          <span className="muted">Any matching subject, or none</span>
        )}
      </div>
      {mine?.status === "active" && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (linkId) {
              const result = run(
                {
                  type: "linkSubject",
                  actorId: userId,
                  activityId: a.id,
                  subjectId: linkId,
                },
                "Subject linked. Its descriptive ownership stays unchanged.",
              );
              if (result) setLinkId("");
            }
          }}
        >
          <label className="sr-only" htmlFor={`link-${a.id}`}>
            Link another subject
          </label>
          <select
            id={`link-${a.id}`}
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
          >
            <option value="">Link another subject…</option>
            {subjects.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button className="button small" disabled={!linkId}>
            <Link2 size={14} />
            Link
          </button>
        </form>
      )}
      <div className="subheading">
        <h4>Participation</h4>
        <span>Everyone keeps their own pace</span>
      </div>
      <div className="participation-list">
        {participants.map((p) => {
          const stats = progress(db, p);
          return (
            <div className="participation-row" key={p.id}>
              <Person db={db} id={p.userId} />
              <div className="participation-progress">
                <div>
                  <span>
                    {stats.value} / {p.target} {a.unit}
                  </span>
                  <Badge color={p.status === "active" ? "moss" : "neutral"}>
                    {p.status}
                  </Badge>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${db.users.find((u) => u.id === p.userId)?.name}'s progress`}
                  aria-valuemin={0}
                  aria-valuemax={p.target}
                  aria-valuenow={Math.min(stats.value, p.target)}
                  aria-valuetext={`${stats.value} of ${p.target} ${a.unit}`}
                >
                  <span style={{ width: `${stats.percent}%` }} />
                </div>
              </div>
              {stats.met && (
                <Check
                  size={17}
                  className="moss-text"
                  aria-label="Target met"
                />
              )}
            </div>
          );
        })}
      </div>
      {mine && (
        <div className="participation-controls">
          {mine.status !== "active" ? (
            <button
              className="button primary small"
              onClick={() =>
                run(
                  {
                    type: "participate",
                    actorId: userId,
                    activityId: a.id,
                    status: "active",
                  },
                  "You joined the activity. New logs can now contribute.",
                )
              }
            >
              {mine.status === "invited"
                ? "Accept invitation"
                : "Resume participation"}
            </button>
          ) : (
            <>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    {
                      type: "participate",
                      actorId: userId,
                      activityId: a.id,
                      status: "active",
                      target: Number(target),
                    },
                    "Your sandbox target changed. Other participants' targets stayed the same.",
                  );
                }}
              >
                <label htmlFor={`target-${a.id}`}>My target</label>
                <input
                  id={`target-${a.id}`}
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
                <button className="button small">Update</button>
              </form>
              <div className="row-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    run(
                      {
                        type: "participate",
                        actorId: userId,
                        activityId: a.id,
                        status: "finished",
                      },
                      "You marked yourself finished. Your history remains, and friends can continue.",
                    )
                  }
                >
                  Mark myself finished
                </button>
                <button
                  className="text-button muted"
                  onClick={() =>
                    run(
                      {
                        type: "participate",
                        actorId: userId,
                        activityId: a.id,
                        status: "left",
                      },
                      "You left this activity. Existing contributions remain in its history.",
                    )
                  }
                >
                  Leave activity
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="rule-note">
        <span className="rule-label">RULE</span>
        <p>
          {a.progressMode === "position"
            ? "Use the highest position from your credited logs. Chapter 5 after chapter 3 means 5, not 8."
            : a.progressMode === "sessions"
              ? "Count each credited log once. One reading log can advance a book and add one habit session."
              : `Add the quantity from each credited log, in ${a.unit}. Units must match.`}{" "}
          Targets here are experiment totals, with no weekly reset or reward
          economy.
        </p>
      </div>
      <JsonRecord
        label="Inspect activity + participation rows"
        value={{
          activity: a,
          activitySubjects: links,
          participations: participants,
        }}
      />
    </section>
  );
}
