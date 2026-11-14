# Beside target data model (ERD)

Source of truth: [`target-schema.sql`](target-schema.sql). These diagrams render natively on GitHub.
Example data from the whiteboard: [`seed-whiteboard-example.sql`](seed-whiteboard-example.sql).

## Whiteboard mapping (2026-11-14)

| Whiteboard                               | Schema                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `USER_ID`                                | `app_user.id`                                                                                        |
| `USR_TYPE` (Teacher, Student)            | `app_user.user_type`; per-place permissions stay in `org_membership.role` and `homebase_member.role` |
| `HOMEBASE_P` list `[3A, 3B, 3A+3B]`      | one `homebase_member` row per homebase (no arrays, so each has an FK, role and dates)                |
| `Homebase_Spec` (4A / NULL)              | `app_user.home_homebase_id` (nullable FK)                                                            |
| Homebase `HB_ID`                         | `homebase.id`                                                                                        |
| Homebase `TYPE` (School, Sch_Prj, Class) | `homebase.type` in `school`, `school_project`, `class`, `club`, `group`, `personal`                  |
| `SUB_HB` + self arrow, N-ary tree        | `homebase.parent_homebase_id` (one parent, many children; cycles rejected by trigger)                |
| Combined homebase `3A+3B`                | `homebase` of type `school_project` + `homebase_composition` rows to 3A and 3B                       |
| `Sport` (Futbol)                         | `sport`                                                                                              |
| `MAP_sport_Homebase`                     | `homebase_sport`                                                                                     |

## 1. Tenancy, people and homebases

```mermaid
erDiagram
  ORGANIZATION ||--o{ ORGANIZATION : "parent of"
  ORGANIZATION ||--o| ORG_POLICY : configures
  ORGANIZATION ||--o{ ORG_MEMBERSHIP : has
  ORGANIZATION ||--o{ HOMEBASE : owns
  APP_USER ||--o{ ORG_MEMBERSHIP : holds
  APP_USER ||--o{ GUARDIAN_LINK : "guardian or student"
  HOMEBASE |o--o{ HOMEBASE : "parent of (SUB_HB)"
  HOMEBASE ||--o{ HOMEBASE_COMPOSITION : "combined from"
  HOMEBASE ||--o{ HOMEBASE_COMPOSITION : "source of"
  HOMEBASE ||--o{ HOMEBASE_MEMBER : has
  APP_USER ||--o{ HOMEBASE_MEMBER : "belongs to (HOMEBASE_P)"
  HOMEBASE |o--o{ APP_USER : "home of (Homebase_Spec)"
  HOMEBASE ||--o{ HOMEBASE_INVITE : issues
  HOMEBASE ||--o{ HOMEBASE_SPORT : plays
  SPORT ||--o{ HOMEBASE_SPORT : "played in"
  ORGANIZATION {
    text id PK
    text parent_org_id FK
    text type "personal|family|school_board|school|club"
    text name
    text region "us|ca"
  }
  ORG_POLICY {
    text org_id PK,FK
    jsonb features
    boolean activity_approval
    int retention_days
  }
  ORG_MEMBERSHIP {
    text org_id PK,FK
    text user_id PK,FK
    text role
    timestamptz joined_at
  }
  APP_USER {
    text id PK
    text email UK
    text user_type "student|teacher|guardian|staff|member"
    text home_homebase_id FK "Homebase_Spec"
    text sso_subject
  }
  GUARDIAN_LINK {
    text guardian_id PK,FK
    text student_id PK,FK
    timestamptz consented_at
  }
  HOMEBASE {
    text id PK
    text org_id FK
    text name
    text type "school|class|school_project|club|group|personal"
    text parent_homebase_id FK "SUB_HB"
    timestamptz deleted_at
  }
  HOMEBASE_COMPOSITION {
    text combined_homebase_id PK,FK
    text source_homebase_id PK,FK
    text org_id FK
  }
  HOMEBASE_MEMBER {
    text homebase_id PK,FK
    text user_id PK,FK
    text role "owner|teacher|member|guest"
    text status
    timestamptz expires_at
  }
  HOMEBASE_INVITE {
    text id PK
    text homebase_id FK
    text code UK
    timestamptz expires_at
    int max_uses
  }
  SPORT {
    text id PK
    text name UK
  }
  HOMEBASE_SPORT {
    text homebase_id PK,FK
    text sport_id PK,FK
  }
```

## 2. Activities, milestones and logs

```mermaid
erDiagram
  ACTIVITY ||--|{ ACTIVITY_AUDIENCE : "shared with"
  HOMEBASE ||--o{ ACTIVITY_AUDIENCE : sees
  SPORT |o--o{ ACTIVITY : "about"
  ACTIVITY ||--o{ PARTICIPATION : has
  APP_USER ||--o{ PARTICIPATION : takes
  ACTIVITY ||--|{ MILESTONE : contains
  MILESTONE |o--o{ MILESTONE : "parent of"
  ACTIVITY ||--o{ MILESTONE_SCHEDULE : generates
  MILESTONE_SCHEDULE ||--o{ MILESTONE_OCCURRENCE : creates
  MILESTONE ||--o| MILESTONE_OCCURRENCE : "is"
  MILESTONE ||--o{ ACTIVITY_LOG : "logged on"
  APP_USER ||--o{ ACTIVITY_LOG : writes
  ACTIVITY_LOG ||--o| LOG_CONTRIBUTION : credits
  PARTICIPATION ||--o{ LOG_CONTRIBUTION : accrues
  ACTIVITY_LOG ||--o{ LOG_SHARE : "shared to"
  ACTIVITY ||--o{ ACTIVITY_SUBJECT : about
  SUBJECT ||--o{ ACTIVITY_SUBJECT : linked
  ACTIVITY {
    text id PK
    text org_id FK
    text template_id FK "nullable"
    text sport_id FK "nullable"
    text name
    text progress_mode
  }
  ACTIVITY_AUDIENCE {
    text activity_id PK,FK
    text homebase_id PK,FK
  }
  PARTICIPATION {
    text id PK
    text activity_id FK
    text user_id FK
    numeric target
    numeric progress_total
    text status
  }
  MILESTONE {
    text id PK
    text activity_id FK
    text parent_id FK "NULL for milestone zero"
    text kind "join|achievement"
    text policy "open|paced|deadline"
    timestamptz end_at
  }
  MILESTONE_SCHEDULE {
    text id PK
    text activity_id FK
    jsonb configuration
    date next_date
  }
  MILESTONE_OCCURRENCE {
    text schedule_id PK,FK
    date local_date PK
    text milestone_id FK,UK
  }
  ACTIVITY_LOG {
    text id PK
    text milestone_id FK
    text author_user_id FK
    boolean is_success
    timestamptz occurred_at
  }
  LOG_CONTRIBUTION {
    text log_id PK,FK
    text participation_id FK
    numeric amount
  }
  LOG_SHARE {
    text log_id PK,FK
    text homebase_id PK,FK
  }
  SUBJECT {
    text id PK
    text owner_user_id FK
    jsonb metadata
  }
  ACTIVITY_SUBJECT {
    text activity_id PK,FK
    text subject_id PK,FK
  }
```

## 3. Rewards, world and events

```mermaid
erDiagram
  MILESTONE ||--o| REWARD : unlocks
  REWARD_ITEM ||--o{ REWARD : "instance of"
  REWARD ||--|{ REWARD_REQUIREMENT : requires
  PARTICIPATION ||--o{ REWARD_REQUIREMENT : "must complete"
  REWARD ||--o| REWARD_PLACEMENT : "placed in world"
  HOMEBASE ||--o{ REWARD_PLACEMENT : shows
  REWARD ||--o{ WORLD_MESSAGE : carries
  HOMEBASE ||--o| HOMEBASE_STARTER_OAK : "starts with"
  DOMAIN_EVENT ||--o{ EVENT_DELIVERY : "fans out"
  APP_USER ||--o{ EVENT_DELIVERY : receives
  REWARD {
    text id PK
    text milestone_id FK,UK
    text item_id FK
    timestamptz obtained_at
  }
  REWARD_ITEM {
    text id PK
    text category
    jsonb artifact
  }
  REWARD_REQUIREMENT {
    text reward_id PK,FK
    text participation_id PK,FK
    text status "pending|met|waived"
  }
  REWARD_PLACEMENT {
    text reward_id PK,FK
    text homebase_id FK
    int x
    int y
    int layer
  }
  HOMEBASE_STARTER_OAK {
    text homebase_id PK,FK
    int x
    int y
  }
  WORLD_MESSAGE {
    text id PK
    text reward_id FK
    text author_id FK
    text body
    timestamptz expires_at
  }
  DOMAIN_EVENT {
    text id PK
    text org_id FK
    text type
    jsonb payload
    timestamptz published_at
  }
  EVENT_DELIVERY {
    text event_id PK,FK
    text recipient_user_id PK,FK
    timestamptz read_at
  }
```

Not drawn: `category`, `subject_template`, `activity_template`, `auth_credential`, `auth_session` (see the SQL).
