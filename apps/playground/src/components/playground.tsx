"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Beaker,
  BookOpen,
  Check,
  Database as DatabaseIcon,
  Download,
  FlaskConical,
  GitBranch,
  Radio,
  RotateCcw,
  Shapes,
  Upload,
  X,
} from "lucide-react";
import type { Command, Database, LogInput } from "../lib/types";
import {
  dispatch,
  downloadData,
  importDatabase,
  resetDatabase,
  useDatabase,
} from "../lib/store";
import { visibleActivities, visibleLogs, visibleSubjects } from "../lib/model";
import { Avatar } from "./ui";
import { Workbench } from "./workbench";
import { Subjects, Templates } from "./subjects";
import { Logbook } from "./logbook";
import { EventTrail, ModelView } from "./inspection";

export type Run = (
  command: Command,
  message?: string,
) => ReturnType<typeof dispatch> | null;
export type ViewProps = { db: Database; userId: string; run: Run };
type Tab = "workbench" | "subjects" | "logs" | "events" | "model" | "templates";
const tabs = [
  { id: "workbench", label: "Workbench", icon: FlaskConical },
  { id: "subjects", label: "Subjects", icon: Shapes },
  { id: "logs", label: "Logbook", icon: BookOpen },
  { id: "events", label: "Event trail", icon: Radio },
  { id: "model", label: "Working model", icon: GitBranch },
  { id: "templates", label: "Templates", icon: Beaker },
] as const;
declare global {
  interface Window {
    besidePlayground?: {
      getDatabase: () => Database;
      recordLog: (
        input: Omit<LogInput, "authorUserId">,
      ) => ReturnType<typeof dispatch>;
    };
  }
}

export function Playground() {
  const { db, ready, storageError } = useDatabase();
  const [userId, setUserId] = useState("mosaab");
  const [tab, setTab] = useState<Tab>("workbench");
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeUserId = db?.users.some((u) => u.id === userId)
    ? userId
    : (db?.users[0]?.id ?? "mosaab");
  useEffect(() => {
    if (!db) return;
    window.besidePlayground = {
      getDatabase: () => structuredClone(db),
      recordLog: (input) =>
        dispatch({
          type: "recordLog",
          actorId: activeUserId,
          input: { ...input, authorUserId: activeUserId },
        }),
    };
    return () => {
      delete window.besidePlayground;
    };
  }, [db, activeUserId]);
  const run: Run = (command, message) => {
    try {
      const result = dispatch(command);
      setNotice({
        message: result.duplicate
          ? "Duplicate request detected. The original log was reused; no new credit or deliveries."
          : (message ??
            "Experiment updated. Follow the changes in the event trail."),
        error: false,
      });
      return result;
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "The action could not be completed.",
        error: true,
      });
      return null;
    }
  };
  if (!ready || !db)
    return (
      <main className="loading">
        <FlaskConical size={32} />
        <h1>Opening the playground</h1>
        <p>Preparing your local experiment…</p>
      </main>
    );
  const user = db.users.find((u) => u.id === activeUserId)!;
  const view = { db, userId: activeUserId, run };
  const counts = {
    subjects: visibleSubjects(db, activeUserId).length,
    activities: visibleActivities(db, activeUserId).length,
    logs: visibleLogs(db, activeUserId).length,
    events: new Set(
      db.deliveries
        .filter((d) => d.recipientUserId === activeUserId)
        .map((d) => d.eventId),
    ).size,
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to experiment
      </a>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Beside Playground home">
          <span className="brand-mark">
            <FlaskConical size={21} />
          </span>
          <span className="wordmark">
            beside<span className="brand-divider">/</span>
            <strong>playground</strong>
          </span>
          <span className="version-tag">v0.2</span>
        </a>
        <div className="topbar-right">
          <span className="local-label">
            <span className="status-dot" />
            {storageError
              ? "Temporary memory session"
              : "Saved in this browser"}
          </span>
          <div className="user-picker">
            <Avatar user={user} />
            <label className="sr-only" htmlFor="perspective">
              View as
            </label>
            <select
              id="perspective"
              value={activeUserId}
              onChange={(e) => {
                setUserId(e.target.value);
                setNotice(null);
              }}
              aria-label="View as"
            >
              <option disabled>View as</option>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <div className="intro">
        <div>
          <p className="eyebrow">
            <span className="tiny-spark">✳</span> A SHARED WORKBENCH
          </p>
          <h1>Small actions. Visible connections.</h1>
          <p>
            Create something, log a moment, and follow what changes for each
            person.
          </p>
        </div>
        <div className="sandbox-note">
          <span className="note-symbol">↗</span>
          <div>
            <strong>Try things. Change your mind.</strong>
            <span>Three demo people. Local data. A model in progress.</span>
          </div>
        </div>
      </div>
      <nav className="flow-strip" aria-label="Explore model entities">
        <button onClick={() => setTab("subjects")} className="flow-step moss">
          <Shapes size={19} />
          <span>
            Subjects<small>what it’s about</small>
          </span>
          <b>{counts.subjects}</b>
        </button>
        <ArrowRight size={17} aria-hidden="true" />
        <button onClick={() => setTab("workbench")} className="flow-step ochre">
          <ActivityIcon size={19} />
          <span>
            Activities<small>what we intend</small>
          </span>
          <b>{counts.activities}</b>
        </button>
        <ArrowRight size={17} aria-hidden="true" />
        <button onClick={() => setTab("logs")} className="flow-step blue">
          <BookOpen size={19} />
          <span>
            Logs<small>what happened</small>
          </span>
          <b>{counts.logs}</b>
        </button>
        <ArrowRight size={17} aria-hidden="true" />
        <button onClick={() => setTab("events")} className="flow-step rose">
          <Radio size={19} />
          <span>
            Events<small>who hears about it</small>
          </span>
          <b>{counts.events}</b>
        </button>
      </nav>
      <div className="nav-row">
        <nav className="tabs" aria-label="Playground sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </nav>
        <span className="perspective-caption">
          Perspective: <strong>{user.name}</strong>
        </span>
      </div>
      {storageError && (
        <div className="notice error" role="alert">
          {storageError}
          <button className="button small" onClick={() => downloadData(true)}>
            Export saved data for recovery
          </button>
        </div>
      )}
      {notice && (
        <div
          className={`notice ${notice.error ? "error" : "success"}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <X size={17} /> : <Check size={17} />}
          <span>{notice.message}</span>
          <button
            className="icon-button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <main id="main" key={activeUserId}>
        {tab === "workbench" && <Workbench {...view} />}
        {tab === "subjects" && <Subjects {...view} />}
        {tab === "logs" && <Logbook {...view} />}
        {tab === "events" && <EventTrail {...view} />}
        {tab === "model" && <ModelView {...view} />}
        {tab === "templates" && <Templates db={db} />}
      </main>
      <footer className="footer">
        <div>
          <DatabaseIcon size={15} />
          <span>
            Browser database · {db.logs.length} logs · {db.contributions.length}{" "}
            contributions
          </span>
        </div>
        <div className="footer-actions">
          <button onClick={() => downloadData()}>
            <Download size={15} />
            Export
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <Upload size={15} />
            Import
          </button>
          <button onClick={() => setConfirmReset(!confirmReset)}>
            <RotateCcw size={15} />
            Reset seed
          </button>
        </div>
        <input
          className="sr-only"
          type="file"
          accept="application/json,.json"
          ref={fileRef}
          aria-label="Import experiment"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 5_000_000)
                throw new Error("Choose an experiment smaller than 5 MB.");
              importDatabase(JSON.parse(await file.text()));
              setNotice({
                message:
                  "Experiment imported. Its records and relationships passed validation.",
                error: false,
              });
            } catch (error) {
              setNotice({
                message:
                  error instanceof Error
                    ? error.message
                    : "Invalid experiment file.",
                error: true,
              });
            }
          }}
        />
      </footer>
      {confirmReset && (
        <div className="reset-confirm">
          <p>
            Replace this browser’s experiment with the original seed? Export
            first to keep your changes.
          </p>
          <button className="button" onClick={() => setConfirmReset(false)}>
            Keep experimenting
          </button>
          <button
            className="button danger"
            onClick={() => {
              resetDatabase();
              setConfirmReset(false);
              setNotice({ message: "Original seed restored.", error: false });
            }}
          >
            Replace with seed
          </button>
        </div>
      )}
    </div>
  );
}
