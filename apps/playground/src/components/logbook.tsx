"use client";
import { useState } from "react";
import { ArrowRight, BookOpen, LockKeyhole, Plus, Radio } from "lucide-react";
import type { Log } from "../lib/types";
import {
  compatible,
  members,
  participation,
  visibleActivities,
  visibleLogs,
} from "../lib/model";
import type { ViewProps } from "./playground";
import {
  Badge,
  CategoryIcon,
  Empty,
  JsonRecord,
  Person,
  shortId,
  when,
} from "./ui";
import { LogComposer } from "./log-composer";

export function Logbook(props: ViewProps) {
  const { db, userId } = props;
  const [ownOnly, setOwnOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const logs = visibleLogs(db, userId)
    .filter((l) => !ownOnly || l.authorUserId === userId)
    .toReversed();
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Logbook</h2>
          <p>
            Private originals and shared moments, with each contribution
            visible.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setCreating(!creating)}
        >
          <Plus size={16} />
          {creating ? "Close composer" : "New standalone log"}
        </button>
      </div>
      <div className={creating ? "library-grid" : ""}>
        <section>
          <div className="filter-row">
            <label className="check-line">
              <input
                type="checkbox"
                checked={ownOnly}
                onChange={(e) => setOwnOnly(e.target.checked)}
              />
              Only my logs
            </label>
            <span>{logs.length} visible logs</span>
          </div>
          <div className="log-list">
            {logs.map((log) => (
              <LogCard key={log.id} {...props} log={log} />
            ))}
          </div>
          {!logs.length && (
            <Empty>
              No logs in this view yet. Save a standalone log or record progress
              from the workbench.
            </Empty>
          )}
        </section>
        {creating && (
          <aside>
            <LogComposer {...props} />
          </aside>
        )}
      </div>
    </>
  );
}
function LogCard({ db, userId, run, log }: ViewProps & { log: Log }) {
  const [distributing, setDistributing] = useState(false);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const visible = visibleActivities(db, userId);
  const credits = db.contributions
    .filter((c) => c.logId === log.id)
    .flatMap((c) => {
      const p = db.participations.find((p) => p.id === c.participationId)!;
      const a = visible.find((a) => a.id === p.activityId);
      return a ? [{ c, a }] : [];
    });
  const shares = db.logShares.filter(
    (s) => s.logId === log.id && members(db, s.connectionId).includes(userId),
  );
  const eligible = visible.filter(
    (a) =>
      compatible(db, userId, a, log) &&
      !db.contributions.some(
        (c) =>
          c.logId === log.id &&
          c.participationId === participation(db, a.id, userId)?.id,
      ),
  );
  const connections = db.connections.filter(
    (c) =>
      members(db, c.id).includes(userId) &&
      !shares.some((s) => s.connectionId === c.id),
  );
  return (
    <article className="log-card">
      <div className="log-card-heading">
        <span className="log-icon">
          <CategoryIcon category={log.category} size={22} />
        </span>
        <div>
          <h3>{log.title}</h3>
          <div className="log-meta">
            <Person db={db} id={log.authorUserId} />
            <span>{when(log.occurredAt)}</span>
            <Badge color="blue">{log.origin}</Badge>
          </div>
        </div>
        <code>{shortId(log.id)}</code>
      </div>
      <div className="log-facts">
        <span>
          <BookOpen size={14} />
          {log.subjectId
            ? db.subjects.find((s) => s.id === log.subjectId)?.title
            : "No subject"}
        </span>
        <strong>
          {log.quantity} {log.unit}
        </strong>
        <span>{log.durationMinutes} minutes</span>
      </div>
      <div className="log-routing">
        <div>
          <span className="eyebrow blue-text">VISIBLE IN</span>
          <div className="badge-row">
            {shares.length ? (
              shares.map((s) => (
                <Badge key={s.id} color="blue">
                  <Radio size={12} />
                  {db.connections.find((c) => c.id === s.connectionId)?.name}
                </Badge>
              ))
            ) : (
              <Badge>
                <LockKeyhole size={12} />
                Private to author
              </Badge>
            )}
          </div>
        </div>
        <ArrowRight size={16} />
        <div>
          <span className="eyebrow ochre-text">PROGRESS CREDIT</span>
          <div className="badge-row">
            {credits.length ? (
              credits.map(({ c, a }) => (
                <Badge key={c.id} color="ochre">
                  {a.name}: {a.progressMode === "position" ? "position" : "+"}
                  {c.amount} {a.unit}
                </Badge>
              ))
            ) : (
              <span className="muted">No visible activity credited</span>
            )}
          </div>
        </div>
      </div>
      {log.authorUserId === userId && (
        <>
          <button
            className="text-button"
            onClick={() => setDistributing(!distributing)}
          >
            <Plus size={14} />
            {distributing
              ? "Close distribution"
              : "Share later / add progress credit"}
          </button>
          {distributing && (
            <form
              className="late-share-form"
              onSubmit={(e) => {
                e.preventDefault();
                const result = run(
                  {
                    type: "distributeLog",
                    actorId: userId,
                    logId: log.id,
                    activityIds,
                    connectionIds,
                  },
                  "Distribution updated. Existing shares and contributions were reused.",
                );
                if (result) {
                  setDistributing(false);
                  setActivityIds([]);
                  setConnectionIds([]);
                }
              }}
            >
              <fieldset>
                <legend>Additional activity credit</legend>
                {eligible.length ? (
                  eligible.map((a) => (
                    <label className="check-line" key={a.id}>
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
                      {a.name}
                    </label>
                  ))
                ) : (
                  <p className="muted">
                    No additional matching activity. Previously credited logs
                    cannot earn twice in the same activity.
                  </p>
                )}
              </fieldset>
              <fieldset>
                <legend>Additional update-only audiences</legend>
                {connections.length ? (
                  connections.map((c) => (
                    <label className="check-line" key={c.id}>
                      <input
                        type="checkbox"
                        checked={connectionIds.includes(c.id)}
                        onChange={(e) =>
                          setConnectionIds(
                            e.target.checked
                              ? [...connectionIds, c.id]
                              : connectionIds.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {c.name}
                    </label>
                  ))
                ) : (
                  <p className="muted">
                    Already shared to all your connections.
                  </p>
                )}
              </fieldset>
              <p className="field-help">
                Adding shared progress also adds that connection’s audience.
                This experiment adds distribution; it does not retract past
                credit or sharing.
              </p>
              <button
                className="button small"
                disabled={!activityIds.length && !connectionIds.length}
              >
                Apply distribution
              </button>
            </form>
          )}
        </>
      )}
      <JsonRecord
        label="Inspect log + visible distribution rows"
        value={{ log, shares, contributions: credits.map(({ c }) => c) }}
      />
    </article>
  );
}
