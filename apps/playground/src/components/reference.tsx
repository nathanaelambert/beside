"use client";

import { useState } from "react";
import { tables, type TableKey } from "../lib/schema";
import { MermaidDiagram } from "./mermaid-diagram";

const definitions: Record<
  TableKey,
  { name: string; meaning: string; purpose: string; example: string }
> = {
  users: {
    name: "User",
    meaning: "A person using Beside.",
    purpose: "Identify who creates, owns, or participates in something.",
    example: "Mosaab or Nathaniel.",
  },
  connections: {
    name: "Connection",
    meaning: "A shared context for a group of people.",
    purpose: "Give shared activities and updates a specific home and audience.",
    example: "Mosaab and Nathaniel’s shared space.",
  },
  memberships: {
    name: "Membership",
    meaning: "A person’s membership in a connection.",
    purpose: "Record who belongs to each shared space.",
    example: "Nathaniel belongs to the connection with Mosaab.",
  },
  subjectTemplates: {
    name: "Subject template",
    meaning: "A starting set of descriptive fields for a kind of thing.",
    purpose: "Keep similar subjects easy to describe consistently.",
    example: "The Book template asks for author, edition, and chapters.",
  },
  activityTemplates: {
    name: "Activity template",
    meaning: "Starting rules for a kind of activity.",
    purpose:
      "Suggest how progress is measured without setting everyone’s final target.",
    example:
      "Reading can track a chapter position; exercise can add up distance.",
  },
  subjects: {
    name: "Subject",
    meaning: "The thing an activity or log is about.",
    purpose:
      "Describe a reusable thing separately from what people do with it.",
    example: "Dune is a subject. Reading Dune together is an activity.",
  },
  activities: {
    name: "Activity",
    meaning: "Something a person or connection intends to do.",
    purpose:
      "Bring together a purpose, related subjects, and rules for measuring progress.",
    example: "Read Dune together, with each reader setting their own target.",
  },
  activitySubjects: {
    name: "Activity subject link",
    meaning: "A link between an activity and a subject.",
    purpose:
      "Let an activity involve several subjects and let a subject be reused.",
    example: "A reading habit can include Dune and another book.",
  },
  participations: {
    name: "Participation",
    meaning: "One person’s commitment to an activity.",
    purpose:
      "Keep their target and invitation or completion status independent of everyone else’s.",
    example: "Mosaab aims for chapter 20; Nathaniel aims for chapter 30.",
  },
  logs: {
    name: "Log",
    meaning: "An author’s record of something that happened.",
    purpose:
      "Capture a moment once, whether it stays private, gets shared, or counts toward progress.",
    example: "Mosaab read through chapter 5 of Dune for 30 minutes.",
  },
  logShares: {
    name: "Log share",
    meaning: "Permission for a connection to see a log.",
    purpose: "Share an update without necessarily awarding progress.",
    example:
      "Share a reading note with Nathaniel without crediting an activity.",
  },
  contributions: {
    name: "Contribution",
    meaning: "The credit a log gives to one person’s participation.",
    purpose:
      "Count one moment toward relevant activities without duplicating the original log.",
    example:
      "One reading log advances Dune to chapter 5 and adds one reading-habit session.",
  },
  events: {
    name: "Event",
    meaning: "A record explaining a change in the experiment.",
    purpose: "Make actions traceable: who did what and which record changed.",
    example: "Mosaab created an activity or recorded a log.",
  },
  deliveries: {
    name: "Event delivery",
    meaning: "A record of who receives an event.",
    purpose: "Keep each person’s inbox tied to the right shared context.",
    example:
      "Nathaniel receives a shared reading update in his connection with Mosaab.",
  },
};

export function Lexicon() {
  return (
    <div className="reference-page">
      <div className="section-heading">
        <div>
          <h2>Lexicon</h2>
          <p>The models in plain English. Each one has a distinct job.</p>
        </div>
      </div>
      <p className="reference-summary">
        A <strong>subject</strong> is what it’s about. An{" "}
        <strong>activity</strong> is what you intend to do. A{" "}
        <strong>log</strong> records what happened. A{" "}
        <strong>contribution</strong> makes that moment count toward progress.
      </p>
      <div className="lexicon-list">
        {tables.map((table) => {
          const entry = definitions[table.key];
          return (
            <article className="lexicon-entry" key={table.key}>
              <div>
                <h3>{entry.name}</h3>
                <code>{table.sql}</code>
              </div>
              <div>
                <p>{entry.meaning}</p>
                <p className="muted">{entry.purpose}</p>
                <p className="lexicon-example">{entry.example}</p>
              </div>
            </article>
          );
        })}
      </div>
      <a className="button" href="#model">
        Explore the ERDs
      </a>
    </div>
  );
}

const steps = [
  [
    "Choose your shared space",
    "You and Nathaniel share a space with a novel, exercise activities, decorations, and keepsakes. Open that connection.",
  ],
  [
    "Encounter Nathaniel’s update",
    "Nathaniel is offline. His update says he reached chapter 4 and left a note there.",
  ],
  [
    "Find the waiting note",
    "Your recorded progress ends at chapter 3. The chapter 4 note stays hidden until you log progress, or explicitly choose to reveal it early.",
  ],
  [
    "Record what you did",
    "You already read chapter 4 outside the app. Save that progress to the shared novel, with its audience visible. Earlier milestones are not silently completed.",
  ],
  [
    "Continue the conversation",
    "The chapter 4 note becomes available. Read it and reply, or leave it for later. Nathaniel can respond on his next visit.",
  ],
  [
    "Add something to your world",
    "The shared pool has enough accumulated credit. Choose a tree, review its cost, purchase it, and place it in your shared space.",
  ],
  [
    "Revisit a keepsake",
    "Open an existing book keepsake to see a past activity’s history. Later, when you both explicitly finish this novel, it can become a keepsake too.",
  ],
] as const;
const storyDiagram = `flowchart TD
  A[Open the connection with Nathaniel] --> B[See his chapter 4 update]
  B --> C[Find his waiting note]
  C --> D{How do you open it?}
  D -->|Log actual progress| E[Save chapter 4 with a visible audience]
  D -->|Reveal early with warning| F[Read without changing progress]
  E --> G[Read and optionally reply]
  F --> G
  G --> H[Return to the shared space]
  H --> I[Purchase and place a tree with accumulated credit]
  I --> J[Revisit a past activity through a keepsake]
  J -. Later, both explicitly finish the novel .-> K[Make a keepsake for this novel]`;

export function UserStories() {
  const [mode, setMode] = useState<"text" | "diagram">("text");
  return (
    <div className="reference-page story-page">
      <div className="section-heading">
        <div>
          <h2>User stories</h2>
          <p>One documented story, from the proposed Beside experience.</p>
        </div>
      </div>
      <article>
        <p className="eyebrow">STORY 01 · PROPOSED EXPERIENCE</p>
        <h3 className="story-title">Returning to a shared space</h3>
        <p className="story-intent">
          As someone sharing activities with a friend, I want to catch up,
          record what I did, and revisit our experiences in one shared space.
        </p>
        <div className="story-scope">
          <strong>What you can try today</strong>
          <p>
            The playground supports subjects, activities, individual targets,
            logs, sharing, and event delivery. Shared worlds, chapter-specific
            notes and reveals, decorations, rewards, and keepsakes are proposals
            in this story.
          </p>
        </div>
        <div className="segmented story-switch" aria-label="Story format">
          <button
            aria-pressed={mode === "text"}
            className={mode === "text" ? "active" : ""}
            onClick={() => setMode("text")}
          >
            Text
          </button>
          <button
            aria-pressed={mode === "diagram"}
            className={mode === "diagram" ? "active" : ""}
            onClick={() => setMode("diagram")}
          >
            Diagram
          </button>
        </div>
        {mode === "text" ? (
          <ol className="story-steps">
            {steps.map(([title, description]) => (
              <li key={title}>
                <h4>{title}</h4>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="story-diagram">
            <MermaidDiagram
              source={storyDiagram}
              label="Flow diagram for returning to a shared space"
            />
            <details className="source-details">
              <summary>View diagram as text</summary>
              <pre>{storyDiagram}</pre>
            </details>
          </div>
        )}
        <p className="muted story-source">
          Based on docs/design/storyboard.md. This describes an established
          connection, rather than onboarding.
        </p>
        <a className="button" href="#activities">
          Try activities in the playground
        </a>
      </article>
    </div>
  );
}
