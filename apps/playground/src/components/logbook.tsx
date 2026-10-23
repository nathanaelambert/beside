"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { members, visibleLogs } from "../lib/model";
import type { Log } from "../lib/types";
import type { ViewProps } from "./playground";
import { Badge, Empty, JsonRecord, Person, when } from "./ui";
import { LogComposer } from "./log-composer";

export function Logbook(props: ViewProps) {
  const [creating, setCreating] = useState(false);
  const [ownOnly, setOwnOnly] = useState(false);
  const logs = visibleLogs(props.db, props.userId)
    .filter((log) => !ownOnly || log.authorUserId === props.userId)
    .slice()
    .reverse();
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Logbook</h2>
          <p>Milestone decisions, attempts, and achievements.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setCreating(!creating)}
        >
          <Plus size={16} />
          {creating ? "Close composer" : "New milestone log"}
        </button>
      </div>
      <div className={creating ? "library-grid" : ""}>
        <section>
          <div className="filter-row">
            <label className="check-line">
              <input
                type="checkbox"
                checked={ownOnly}
                onChange={(event) => setOwnOnly(event.target.checked)}
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
              Record an outcome on a milestone to start your logbook.
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
  const [sharing, setSharing] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const milestone = db.milestones.find((m) => m.id === log.milestoneId);
  const activity = db.activities.find((a) => a.id === milestone?.activityId);
  const shares = db.logShares.filter(
    (s) => s.logId === log.id && members(db, s.connectionId).includes(userId),
  );
  const credits = db.contributions.filter((c) => c.logId === log.id);
  const available = db.connections.filter(
    (base) =>
      !base.personalOwnerId &&
      members(db, base.id).includes(userId) &&
      !shares.some((s) => s.connectionId === base.id),
  );
  return (
    <article className="log-card">
      <div className="log-card-heading">
        <div>
          <h3>{log.title}</h3>
          <div className="log-meta">
            <Person db={db} id={log.authorUserId} />
            <span>{when(log.occurredAt)}</span>
            <Badge color={log.isSuccess ? "moss" : "rose"}>
              {log.isSuccess ? "Success" : "Failure"}
            </Badge>
            <Badge color="blue">{log.origin}</Badge>
          </div>
        </div>
      </div>
      <p>
        {milestone
          ? `${activity?.name} · ${milestone.kind === "join" ? "Milestone zero" : milestone.name}`
          : "Historical log · preserved from the earlier playground"}
      </p>
      <div className="log-facts">
        <strong>
          {milestone?.kind === "join"
            ? "Participation decision"
            : `${log.quantity} ${log.unit}`}
        </strong>
        <span>{log.durationMinutes} minutes</span>
        <span>
          {credits.length
            ? `${credits.length} activity credit(s)`
            : "No progress credit"}
        </span>
      </div>
      <div className="badge-row">
        {shares.length ? (
          shares.map((s) => (
            <Badge key={s.id} color="blue">
              {db.connections.find((base) => base.id === s.connectionId)?.name}
            </Badge>
          ))
        ) : (
          <Badge>Private to author</Badge>
        )}
      </div>
      {log.authorUserId === userId && (
        <>
          <button className="text-button" onClick={() => setSharing(!sharing)}>
            {sharing ? "Close sharing" : "Share update with another home base"}
          </button>
          {sharing && (
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  run(
                    {
                      type: "distributeLog",
                      actorId: userId,
                      logId: log.id,
                      connectionIds: [connectionId],
                    },
                    "Update shared. Its milestone and progress are unchanged.",
                  )
                ) {
                  setSharing(false);
                  setConnectionId("");
                }
              }}
            >
              <label className="sr-only" htmlFor={`share-${log.id}`}>
                Additional home base
              </label>
              <select
                id={`share-${log.id}`}
                value={connectionId}
                onChange={(event) => setConnectionId(event.target.value)}
              >
                <option value="">Choose a home base</option>
                {available.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.name}
                  </option>
                ))}
              </select>
              <button className="button small" disabled={!connectionId}>
                Share update
              </button>
            </form>
          )}
        </>
      )}
      <JsonRecord
        label="Inspect log and distribution"
        value={{ log, shares, contributions: credits }}
      />
    </article>
  );
}
