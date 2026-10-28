"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  BookOpen,
  Check,
  Database as DatabaseIcon,
  Download,
  FlaskConical,
  Flag,
  Gift,
  GitBranch,
  NotebookPen,
  BookText,
  Radio,
  Server,
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
import { visibleActivities } from "../lib/model";
import { Avatar } from "./ui";
import { Workbench } from "./workbench";
import { Subjects, Templates } from "./subjects";
import { Logbook } from "./logbook";
import { EventTrail, ModelView } from "./inspection";
import { Lexicon, UserStories } from "./reference";
import { LogComposer } from "./log-composer";
import { Milestones } from "./milestones";
import { RewardItems } from "./reward-items";
import { BackendApi } from "./backend-api";

export type Run = (
  command: Command,
  message?: string,
) => ReturnType<typeof dispatch> | null;
export type ViewProps = { db: Database; userId: string; run: Run };
const sections = [
  {
    id: "api",
    label: "Backend API",
    icon: Server,
    group: "inspect",
    description:
      "Try the shared mobile and web API, sign in, and inspect its OpenAPI contract.",
    detail: "Live PostgreSQL workspace",
  },
  {
    id: "lexicon",
    label: "Lexicon",
    icon: BookText,
    group: "learn",
    description:
      "What each model means, why it exists, and how it fits together.",
    detail: "17 models, in plain English",
  },
  {
    id: "model",
    label: "ERDs",
    icon: GitBranch,
    group: "learn",
    description:
      "Explore the relationships between models and inspect the data.",
    detail: "5 model diagrams",
  },
  {
    id: "stories",
    label: "User stories",
    icon: BookOpen,
    group: "learn",
    description:
      "Walk through returning to a shared space, in words and a diagram.",
    detail: "1 story · proposed experience",
  },
  {
    id: "subjects",
    label: "Subjects",
    icon: Shapes,
    group: "try",
    description:
      "Add and browse the books, recipes, trails, and other things you do activities with.",
    detail: "Add a subject",
  },
  {
    id: "activities",
    label: "Activities",
    icon: FlaskConical,
    group: "try",
    description:
      "Create a personal or shared activity, initialize its participants, and set individual targets.",
    detail: "Create an activity",
  },
  {
    id: "milestones",
    label: "Milestones",
    icon: Flag,
    group: "try",
    description:
      "Plan chapters, episodes, or workout days. Set logging windows and shared rewards.",
    detail: "Plan an achievement",
  },
  {
    id: "rewards",
    label: "Reward items",
    icon: Gift,
    group: "try",
    description:
      "Browse pixel-art trees, flowers, statues, and flagpoles. Try placing them in a world preview.",
    detail: "Explore the catalog",
  },
  {
    id: "record",
    label: "Record a log",
    icon: NotebookPen,
    group: "try",
    description:
      "Record success or failure on one milestone. Follow participation, progress, and shared rewards.",
    detail: "Log a moment",
  },
  {
    id: "logs",
    label: "Logbook",
    icon: BookOpen,
    group: "inspect",
    description:
      "Review milestone outcomes and share updates with other home bases.",
    detail: "Browse logs",
  },
  {
    id: "events",
    label: "Event trail",
    icon: Radio,
    group: "inspect",
    description: "See what changed and who received each update.",
    detail: "Inspect deliveries",
  },
  {
    id: "templates",
    label: "Templates",
    icon: Beaker,
    group: "inspect",
    description:
      "Browse the starting fields and rules for subjects and activities.",
    detail: "Browse templates",
  },
] as const;
type Tab = "home" | (typeof sections)[number]["id"];
function tabFromHash(): Tab {
  const id = window.location.hash.slice(1);
  return sections.some((section) => section.id === id) ? (id as Tab) : "home";
}
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
  const [tab, setTab] = useState<Tab>("home");
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [recordActivityId, setRecordActivityId] = useState<string>();
  const [recordMilestoneId, setRecordMilestoneId] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#main") return;
      const nextTab = tabFromHash();
      setTab(nextTab);
      if (nextTab !== "record") {
        setRecordActivityId(undefined);
        setRecordMilestoneId(undefined);
      }
      setNotice(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [tab, ready]);
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
  const onRecord = (activityId?: string, milestoneId?: string) => {
    setRecordActivityId(activityId);
    setRecordMilestoneId(milestoneId);
    window.location.hash = "record";
  };
  const section = sections.find((item) => item.id === tab);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a href="#home" className="brand" aria-label="Beside Playground home">
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
                setRecordActivityId(undefined);
                setRecordMilestoneId(undefined);
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
      {tab !== "home" && (
        <nav className="section-nav" aria-label="Breadcrumb">
          <a href="#home">
            <ArrowLeft size={16} /> Playground
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{section?.label}</span>
        </nav>
      )}
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
      <main id="main" tabIndex={-1} key={activeUserId}>
        {tab === "home" && (
          <div className="playground-home">
            <div className="home-intro">
              <p className="eyebrow">BESIDE PLAYGROUND</p>
              <h1>What would you like to explore?</h1>
              <p>Understand the model, then try one thing at a time.</p>
            </div>
            {[
              {
                id: "learn",
                title: "Understand the model",
                description: "Start here to get familiar with Beside.",
              },
              {
                id: "try",
                title: "Try it out",
                description:
                  "Work with a local experiment as the person selected above.",
              },
              {
                id: "inspect",
                title: "Look closer",
                description:
                  "Review the records and rules behind your experiment.",
              },
            ].map((group) => (
              <section
                className="home-group"
                key={group.id}
                aria-labelledby={`group-${group.id}`}
              >
                <div className="home-group-heading">
                  <h2 id={`group-${group.id}`}>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
                <div className="destination-grid">
                  {sections
                    .filter((item) => item.group === group.id)
                    .map((item) => (
                      <a
                        className="destination"
                        href={`#${item.id}`}
                        key={item.id}
                      >
                        <item.icon
                          size={22}
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                        <h3>{item.label}</h3>
                        <p>{item.description}</p>
                        <span>
                          {item.detail}
                          <ArrowRight size={16} aria-hidden="true" />
                        </span>
                      </a>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {tab === "lexicon" && <Lexicon />}
        {tab === "stories" && <UserStories />}
        {tab === "activities" && <Workbench {...view} onRecord={onRecord} />}
        {tab === "record" && (
          <div className="record-page">
            <div className="section-heading">
              <div>
                <h2>Record a log</h2>
                <p>
                  Choose one milestone and record its outcome. Each user can
                  succeed once per milestone.
                </p>
              </div>
            </div>
            <LogComposer
              {...view}
              key={`${activeUserId}:${recordActivityId}:${recordMilestoneId}`}
              initialMilestoneId={recordMilestoneId}
              initialActivity={visibleActivities(db, activeUserId).find(
                (activity) => activity.id === recordActivityId,
              )}
            />
          </div>
        )}
        {tab === "milestones" && <Milestones {...view} onRecord={onRecord} />}
        {tab === "subjects" && <Subjects {...view} />}
        {tab === "rewards" && (
          <RewardItems
            key={JSON.stringify(db.rewardItems)}
            db={db}
            userId={activeUserId}
          />
        )}
        {tab === "logs" && <Logbook {...view} />}
        {tab === "events" && <EventTrail {...view} />}
        {tab === "model" && <ModelView {...view} />}
        {tab === "templates" && <Templates db={db} />}
        {tab === "api" && <BackendApi />}
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
