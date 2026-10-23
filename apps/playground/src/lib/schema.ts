import type { Database } from "./types.ts";

export type TableKey = Exclude<keyof Database, "version">;
type Table = {
  key: TableKey;
  sql: string;
  color: string;
  description: string;
  columns: string[];
};
export const tables: Table[] = [
  {
    key: "rewardItems",
    sql: "reward_item",
    color: "moss",
    description:
      "A shared catalog of named, categorized pixel-art artifacts. Milestone rewards reference its ID; artwork is independent of earning and ownership.",
    columns: ["text id PK", "text name", "text category", "jsonb artifact"],
  },
  {
    key: "milestones",
    sql: "milestone",
    color: "ochre",
    description:
      "The smallest loggable achievement. Exactly one self-parented milestone zero per activity is logged automatically for every participant and records leaving; other milestones have an acyclic parent in the same activity. Open, paced and deadline policies validate submission time.",
    columns: [
      "text id PK",
      "text activity_id FK",
      "text parent_id FK",
      "text kind",
      "text name",
      "numeric quantity",
      "text policy",
      "timestamptz start_at",
      "timestamptz end_at",
      "text reward_id FK",
      "timestamptz created_at",
    ],
  },
  {
    key: "rewards",
    sql: "reward",
    color: "moss",
    description:
      "One item for the entire home base, linked to one milestone. Required participants are snapshotted at planning; all must succeed once. obtained_at is set once and never creates duplicate items.",
    columns: [
      "text id PK",
      "text homebase_id FK",
      "text item_id FK",
      "timestamptz obtained_at",
      "jsonb required_user_ids",
    ],
  },
  {
    key: "users",
    sql: "app_user",
    color: "neutral",
    description:
      "Three demo identities. The selector simulates perspective, not authentication.",
    columns: ["text id PK", "text name", "text email UK", "text color"],
  },
  {
    key: "connections",
    sql: "homebase",
    color: "neutral",
    description:
      "A personal or shared home base. Membership grants access to its activities, logs, and collectively earned rewards. Existing JSON uses the connections key.",
    columns: ["text id PK", "text name", "text personal_owner_id FK"],
  },
  {
    key: "memberships",
    sql: "homebase_member",
    color: "neutral",
    description:
      "Unique (connection_id, user_id). Users can belong to many separate connections.",
    columns: ["text id PK", "text connection_id FK", "text user_id FK"],
  },
  {
    key: "subjectTemplates",
    sql: "subject_template",
    color: "moss",
    description:
      "Descriptive fields and a default logging unit. Book, recipe, trail and more.",
    columns: [
      "text id PK",
      "text name",
      "text category",
      "jsonb fields",
      "text unit",
    ],
  },
  {
    key: "activityTemplates",
    sql: "activity_template",
    color: "ochre",
    description:
      "Starting rules for a commitment. Changing a template does not rewrite existing activity records.",
    columns: [
      "text id PK",
      "text name",
      "text category",
      "text description",
      "text progress_mode",
      "text unit",
      "numeric target",
    ],
  },
  {
    key: "subjects",
    sql: "subject",
    color: "moss",
    description:
      "Creator-owned descriptions. Referencing a subject shares its description, not the creator's private logs or conversations.",
    columns: [
      "text id PK",
      "text template_id FK",
      "text owner_user_id FK",
      "text title",
      "jsonb metadata",
      "timestamptz created_at",
    ],
  },
  {
    key: "activities",
    sql: "activity",
    color: "ochre",
    description:
      "Exactly one owner scope: personal_owner_id XOR connection_id. Shared rules, independent personal targets.",
    columns: [
      "text id PK",
      "text template_id FK",
      "text creator_user_id FK",
      "text personal_owner_id FK",
      "text connection_id FK",
      "text name",
      "text description",
      "text category",
      "text progress_mode",
      "text unit",
      "timestamptz created_at",
    ],
  },
  {
    key: "activitySubjects",
    sql: "activity_subject",
    color: "moss",
    description:
      "Unique (activity_id, subject_id). An activity has zero, one, or many subjects; a subject can be reused.",
    columns: ["text id PK", "text activity_id FK", "text subject_id FK"],
  },
  {
    key: "participations",
    sql: "participation",
    color: "ochre",
    description:
      "Unique (activity_id, user_id). Target and participation status belong to the individual; creation automatically logs milestone zero for each. Progress is derived from contributions.",
    columns: [
      "text id PK",
      "text activity_id FK",
      "text user_id FK",
      "numeric target",
      "text status",
    ],
  },
  {
    key: "logs",
    sql: "activity_log",
    color: "blue",
    description:
      "One success/failure on exactly one milestone. A successful milestone/user pair is unique. Only preserved historical logs have no milestone. Trigger keys deduplicate retries before schedule/once-only checks.",
    columns: [
      "text id PK",
      "text author_user_id FK",
      "text milestone_id FK",
      "boolean is_success",
      "text subject_id FK",
      "text category",
      "text title",
      "numeric quantity",
      "text unit",
      "numeric duration_minutes",
      "timestamptz occurred_at",
      "text origin",
      "text external_key",
      "timestamptz created_at",
    ],
  },
  {
    key: "logShares",
    sql: "log_share",
    color: "blue",
    description:
      "Unique (log_id, connection_id). Grants visibility to the connection without awarding progress.",
    columns: [
      "text id PK",
      "text log_id FK",
      "text connection_id FK",
      "text shared_by_user_id FK",
    ],
  },
  {
    key: "contributions",
    sql: "log_contribution",
    color: "blue",
    description:
      "Unique (log_id, participation_id). Interprets a log under an activity's rules. Shared credit requires a matching log_share.",
    columns: [
      "text id PK",
      "text log_id FK",
      "text participation_id FK",
      "numeric amount",
    ],
  },
  {
    key: "events",
    sql: "domain_event",
    color: "rose",
    description:
      "An append-only explanation of a mutation. entity_type/entity_id is an event-envelope reference validated by the command layer, not a polymorphic SQL foreign key.",
    columns: [
      "text id PK",
      "text actor_user_id FK",
      "text type",
      "text entity_type",
      "text entity_id",
      "text message",
      "text origin",
      "timestamptz created_at",
    ],
  },
  {
    key: "deliveries",
    sql: "event_delivery",
    color: "rose",
    description:
      "Unique (event_id, recipient_user_id). Shows exactly who receives an event and in which connection context.",
    columns: [
      "text id PK",
      "text event_id FK",
      "text recipient_user_id FK",
      "text connection_id FK",
      "text kind",
    ],
  },
];
const relations: [TableKey, string, TableKey, string][] = [
  ["activities", "||--|{", "milestones", "contains"],
  ["milestones", "||--o{", "milestones", "parent"],
  ["milestones", "o|--o{", "logs", "records_outcome"],
  ["rewards", "o|--||", "milestones", "awarded_by"],
  ["rewardItems", "||--o{", "rewards", "defines"],
  ["connections", "||--o{", "rewards", "owns"],
  ["users", "||--o{", "memberships", "belongs"],
  ["connections", "||--o{", "memberships", "includes"],
  ["users", "o|--o{", "activities", "personal_owner"],
  ["connections", "o|--o{", "activities", "shared_owner"],
  ["users", "||--o{", "activities", "creates"],
  ["activityTemplates", "||--o{", "activities", "initializes"],
  ["activities", "||--o{", "participations", "has"],
  ["users", "||--o{", "participations", "participates"],
  ["subjectTemplates", "||--o{", "subjects", "describes"],
  ["users", "||--o{", "subjects", "owns"],
  ["subjects", "||--o{", "activitySubjects", "referenced_by"],
  ["activities", "||--o{", "activitySubjects", "involves"],
  ["users", "||--o{", "logs", "authors"],
  ["subjects", "o|--o{", "logs", "about"],
  ["logs", "||--o{", "logShares", "shared_through"],
  ["connections", "||--o{", "logShares", "receives"],
  ["users", "||--o{", "logShares", "shares_as_author"],
  ["logs", "||--o{", "contributions", "interpreted_as"],
  ["participations", "||--o{", "contributions", "credited_by"],
  ["users", "||--o{", "events", "acts"],
  ["events", "||--o{", "deliveries", "routed_as"],
  ["users", "||--o{", "deliveries", "receives"],
  ["connections", "o|--o{", "deliveries", "context"],
];
export const modules: {
  id: string;
  name: string;
  description: string;
  keys: TableKey[];
}[] = [
  {
    id: "rewards",
    name: "Milestones & shared rewards",
    description:
      "Activities contain milestones. Each milestone can reference one home-base reward, which references reusable item artwork. All required participants cooperate to obtain that one shared reward.",
    keys: [
      "rewardItems",
      "rewards",
      "milestones",
      "activities",
      "connections",
      "logs",
    ],
  },
  {
    id: "ownership",
    name: "People & ownership",
    description:
      "A user belongs to connections. An activity belongs to one personal owner or one connection. Participation holds individual commitments.",
    keys: [
      "users",
      "connections",
      "memberships",
      "activities",
      "participations",
    ],
  },
  {
    id: "subjects",
    name: "Subjects & activities",
    description:
      "Templates describe things and commitments separately. Join rows let many activities reuse many subjects.",
    keys: [
      "users",
      "subjectTemplates",
      "activityTemplates",
      "subjects",
      "activities",
      "activitySubjects",
    ],
  },
  {
    id: "logs",
    name: "Logs & progress",
    description:
      "A log exists once. Shares grant visibility; contributions grant progress to a specific participation.",
    keys: [
      "users",
      "subjects",
      "logs",
      "logShares",
      "connections",
      "contributions",
      "participations",
      "activities",
      "milestones",
    ],
  },
  {
    id: "events",
    name: "Events & delivery",
    description:
      "Every command records what changed, then produces separate delivery rows for the intended recipients.",
    keys: ["users", "connections", "events", "deliveries"],
  },
];
export function diagramFor(moduleId: string) {
  const module = modules.find((m) => m.id === moduleId) ?? modules[0]!;
  const selected = tables.filter((t) => module.keys.includes(t.key));
  const blocks = selected
    .map(
      (t) =>
        `  ${t.sql} {\n${t.columns.map((c) => `    ${c}`).join("\n")}\n  }`,
    )
    .join("\n");
  const links = relations
    .filter(([a, , b]) => module.keys.includes(a) && module.keys.includes(b))
    .map(
      ([a, arrow, b, label]) =>
        `  ${tables.find((t) => t.key === a)!.sql} ${arrow} ${tables.find((t) => t.key === b)!.sql} : ${label}`,
    )
    .join("\n");
  const styles = selected.map((t) => `  class ${t.sql} ${t.color}`).join("\n");
  return `erDiagram\n  direction LR\n${blocks}\n${links}\n  classDef moss fill:#edf3e7,stroke:#687c50,color:#243522\n  classDef ochre fill:#faf0db,stroke:#ae8134,color:#4b3619\n  classDef blue fill:#eaf0fb,stroke:#647ea9,color:#283c5d\n  classDef rose fill:#f8e9ed,stroke:#ac6c80,color:#552b39\n  classDef neutral fill:#f5f4ed,stroke:#929487,color:#30342b\n${styles}`;
}
