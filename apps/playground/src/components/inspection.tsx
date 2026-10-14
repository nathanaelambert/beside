"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Eye,
  GitBranch,
  Inbox,
  Minus,
  Plus,
  Radio,
} from "lucide-react";
import type { ViewProps } from "./playground";
import { Badge, Empty, JsonRecord, Person, shortId, when } from "./ui";
import { diagramFor, modules, tables, type TableKey } from "../lib/schema";
import { MermaidDiagram } from "./mermaid-diagram";

export function EventTrail({ db, userId }: ViewProps) {
  const [observer, setObserver] = useState(false);
  const [eventType, setEventType] = useState("all");
  const mine = new Set(
    db.deliveries
      .filter((d) => d.recipientUserId === userId)
      .map((d) => d.eventId),
  );
  const events = db.events
    .filter(
      (e) =>
        (observer || mine.has(e.id)) &&
        (eventType === "all" || e.type === eventType),
    )
    .toReversed();
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Follow the ripple</h2>
          <p>
            Every mutation has an actor, a result, and an explicit list of
            recipients.
          </p>
        </div>
        <Badge color="rose">Event trail</Badge>
      </div>
      <div className="event-toolbar">
        <div className="segmented">
          <button
            className={!observer ? "active" : ""}
            onClick={() => setObserver(false)}
          >
            <Inbox size={16} />
            My inbox
          </button>
          <button
            className={observer ? "active" : ""}
            onClick={() => setObserver(true)}
          >
            <Eye size={16} />
            Observer: all events
          </button>
        </div>
        <select
          aria-label="Filter event type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          <option value="all">Every event type</option>
          {[...new Set(db.events.map((e) => e.type))].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <span className="muted">{events.length} events</span>
      </div>
      {observer && (
        <div className="assumption-note compact">
          <Eye size={17} />
          <p>
            <strong>Observer mode sees the whole local database.</strong> This
            is a teaching tool, not an authenticated access boundary. Return to
            My inbox to test the selected person’s deliveries.
          </p>
        </div>
      )}
      <div className="event-legend">
        <span>
          <span className="event-key blue" />
          Private / update
        </span>
        <span>
          <span className="event-key ochre" />
          Progress
        </span>
        <span>
          <span className="event-key moss" />
          Activity change
        </span>
        <span>Color is paired with a delivery label.</span>
      </div>
      <div className="event-list">
        {events.map((event) => {
          const deliveries = db.deliveries.filter(
            (d) => d.eventId === event.id,
          );
          const kind = deliveries[0]?.kind;
          const color =
            kind === "progress"
              ? "ochre"
              : kind === "activity"
                ? "moss"
                : "blue";
          return (
            <article key={event.id} className="event-card">
              <div className={`event-symbol ${color}`}>
                <Radio size={19} />
              </div>
              <div className="event-content">
                <div className="event-title">
                  <code>{event.type}</code>
                  <Badge color={color}>{kind}</Badge>
                  <Badge>{event.origin}</Badge>
                  <time>{when(event.createdAt)}</time>
                </div>
                <p>{event.message}</p>
                <div className="event-route">
                  <Person db={db} id={event.actorUserId} />
                  <ArrowRight size={15} />
                  <span className="record-reference">
                    {event.entityType} <code>{shortId(event.entityId)}</code>
                  </span>
                  <ArrowRight size={15} />
                  <div className="recipient-row">
                    {deliveries.map((d) => (
                      <div
                        className={`delivery-chip ${d.recipientUserId === userId ? "mine" : ""}`}
                        key={d.id}
                      >
                        <Person db={db} id={d.recipientUserId} />
                        <span>
                          {db.connections.find((c) => c.id === d.connectionId)
                            ?.name ?? "Private"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <JsonRecord
                  label="Inspect event + delivery rows"
                  value={{ event, deliveries }}
                />
              </div>
            </article>
          );
        })}
      </div>
      {!events.length && (
        <Empty>
          No matching deliveries. Create an activity or save a log, then compare
          inboxes.
        </Empty>
      )}
    </>
  );
}

export function ModelView({ db }: ViewProps) {
  const [moduleId, setModuleId] = useState("ownership");
  const [tableKey, setTableKey] = useState<TableKey>("activities");
  const [zoom, setZoom] = useState(1);
  const [copyStatus, setCopyStatus] = useState("");
  const module = modules.find((m) => m.id === moduleId)!;
  const source = diagramFor(moduleId);
  const table = tables.find((t) => t.key === tableKey)!;
  const records = db[tableKey] as unknown as Record<string, unknown>[];
  const columns = records[0]
    ? Object.keys(records[0])
    : table.columns.map((c) =>
        c
          .split(" ")[1]!
          .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>A model you can look inside</h2>
          <p>
            Working SQL relationships, rendered as Mermaid. The rows below are
            the live experiment.
          </p>
        </div>
        <Badge>
          <GitBranch size={14} />
          Draft model · v1
        </Badge>
      </div>
      <div className="model-module-tabs">
        {modules.map((m) => (
          <button
            className={moduleId === m.id ? "active" : ""}
            onClick={() => {
              setModuleId(m.id);
              setCopyStatus("");
              setZoom(1);
            }}
            key={m.id}
          >
            {m.name}
          </button>
        ))}
      </div>
      <section className="diagram-panel">
        <div className="diagram-header">
          <div>
            <h3>{module.name}</h3>
            <p>{module.description}</p>
          </div>
          <div className="diagram-controls">
            <button
              className="icon-button"
              aria-label="Zoom out diagram"
              disabled={zoom <= 0.6}
              onClick={() => setZoom(Math.max(0.6, zoom - 0.2))}
            >
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              aria-label="Zoom in diagram"
              disabled={zoom >= 1.8}
              onClick={() => setZoom(Math.min(1.8, zoom + 0.2))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="diagram-viewport">
          <div style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 860}px` }}>
            <MermaidDiagram source={source} />
          </div>
        </div>
        <div className="diagram-foot">
          <span>
            PK = primary key · FK = foreign key · UK = unique key · crow’s feet
            = many
          </span>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(source);
                setCopyStatus("Copied Mermaid source");
              } catch {
                setCopyStatus("Copy unavailable. Select the source below.");
              }
            }}
          >
            {copyStatus.startsWith("Copied") ? (
              <Check size={14} />
            ) : (
              <Copy size={14} />
            )}
            {copyStatus || "Copy Mermaid"}
          </button>
        </div>
        <details className="source-details">
          <summary>
            <Code2 size={15} />
            View Mermaid source
          </summary>
          <pre>{source}</pre>
        </details>
      </section>
      <div className="assumption-grid">
        <div>
          <Badge color="ochre">Ownership</Badge>
          <p>
            An activity has exactly one owner scope. Subjects stay
            creator-owned; linking them does not move ownership.
          </p>
        </div>
        <div>
          <Badge color="blue">Progress</Badge>
          <p>
            Derived from contributions, not stored on the log. Unique join rows
            prevent the same log being counted twice per participant.
          </p>
        </div>
        <div>
          <Badge color="rose">Still exploratory</Badge>
          <p>
            Targets are sandbox totals. Periods, reward accounting, edits,
            revocation, and membership changes need their own experiments.
          </p>
        </div>
      </div>
      <div className="section-heading records-heading">
        <div>
          <h2>The records behind the experiment</h2>
          <p>
            Observer view: all rows, including records outside the selected
            person’s perspective.
          </p>
        </div>
        <Badge>
          <Eye size={14} />
          Full local database
        </Badge>
      </div>
      <div className="data-inspector">
        <aside className="table-list" aria-label="Database tables">
          {tables.map((t) => (
            <button
              className={tableKey === t.key ? "active" : ""}
              onClick={() => setTableKey(t.key)}
              key={t.key}
            >
              <span className={`table-dot ${t.color}`} />
              <span>{t.sql}</span>
              <b>{db[t.key].length}</b>
            </button>
          ))}
        </aside>
        <section className="table-panel">
          <div className="table-heading">
            <div>
              <h3>{table.sql}</h3>
              <p>{table.description}</p>
            </div>
            <Badge color={table.color}>{records.length} rows</Badge>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record, i) => (
                  <tr key={String(record.id ?? i)}>
                    {columns.map((column) => {
                      const value = record[column];
                      return (
                        <td key={column}>
                          <span
                            title={
                              typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value ?? "NULL")
                            }
                          >
                            {value === null ? (
                              <em>NULL</em>
                            ) : typeof value === "object" ? (
                              JSON.stringify(value)
                            ) : typeof value === "string" &&
                              (column === "id" || column.endsWith("Id")) ? (
                              shortId(value)
                            ) : (
                              String(value)
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!records.length && (
            <Empty>No rows yet. Use the workbench to create some.</Empty>
          )}
          <JsonRecord label="Inspect complete table as JSON" value={records} />
        </section>
      </div>
    </>
  );
}
