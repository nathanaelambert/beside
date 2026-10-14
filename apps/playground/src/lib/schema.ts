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
    key: "users",
    sql: "app_user",
    color: "neutral",
    description:
      "Three demo identities. The selector simulates perspective, not authentication.",
    columns: ["text id PK", "text name", "text email UK", "text color"],
  },
  {
    key: "connections",
    sql: "connection",
    color: "neutral",
    description:
      "A distinct shared context. Membership grants access to this connection's activities and shared logs.",
    columns: ["text id PK", "text name"],
  },
  {
    key: "memberships",
    sql: "connection_member",
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
      "Unique (activity_id, user_id). Target and invitation/completion status belong to the individual. Progress is derived from contributions.",
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
      "One original event owned by its author. Subject is optional. Unique (author_user_id, origin, external_key) handles trigger retries.",
    columns: [
      "text id PK",
      "text author_user_id FK",
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
