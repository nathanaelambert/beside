# Data flows (as-is)

How requests move through the system today, traced from the code on `main`
(`9dabc6d`). Component overview: [`current-architecture.md`](current-architecture.md).

## 1. Write a command (example: record a log)

Every write runs as one transaction behind a single global lock and works on an
in-memory copy of the whole database.

```mermaid
sequenceDiagram
  autonumber
  actor U as Mobile app
  participant G as AuthGuard
  participant D as DomainService
  participant X as domain execute()
  participant DB as Neon Postgres
  U->>G: POST /api/v1/logs (Bearer token, externalKey)
  G->>DB: find auth_session by sha256(token)
  DB-->>G: user
  G->>D: command(recordLog)
  D->>DB: BEGIN + pg_advisory_xact_lock(724390821)
  Note over D,DB: every other write waits here
  D->>DB: loadDatabase: SELECT all 17 tables
  DB-->>D: full snapshot
  D->>X: execute(snapshot, command)
  X-->>D: new snapshot: log, contribution, events,<br/>deliveries, reward if all required users succeeded
  D->>DB: persistChanges: upsert changed rows, delete removed
  D->>DB: COMMIT
  D-->>U: 201 { entityId, duplicate }
  Note over U,D: a retry with the same externalKey returns duplicate: true
```

## 2. Read the workspace (`GET /api/v1/state`)

Reads also take the write lock, because they settle expired milestones before
answering.

```mermaid
sequenceDiagram
  autonumber
  actor U as Mobile / Playground
  participant D as DomainService
  participant DB as Neon Postgres
  U->>D: GET /api/v1/state (Bearer)
  D->>DB: BEGIN + global advisory lock
  D->>DB: loadDatabase (all tables)
  D->>D: settleExpiredMilestones(now)
  alt missed deadlines found
    D->>DB: persistChanges (failure logs, events)
  end
  D->>D: stateForUser: keep only what the user may see
  D->>DB: COMMIT
  D-->>U: 200 workspace JSON
```

## 3. Daily cron (recurring milestones and missed deadlines)

```mermaid
sequenceDiagram
  autonumber
  participant C as Vercel Cron (05:00 UTC)
  participant R as CronController
  participant S as SchedulingService
  participant DB as Neon Postgres
  C->>R: GET /api/cron/milestones (Bearer CRON_SECRET)
  R->>R: timingSafeEqual(secret)
  R->>S: run()
  S->>DB: BEGIN + global lock, loadDatabase
  S->>DB: SELECT enabled milestone_schedule rows
  loop each schedule
    S->>S: generate due occurrences as milestones
  end
  S->>S: settleExpiredMilestones(now)
  S->>DB: persistChanges + INSERT milestone_occurrence
  S->>DB: COMMIT
  S-->>C: { processedAt, milestonesCreated, failuresRecorded }
```

## 4. Sign up and join a home base

```mermaid
sequenceDiagram
  autonumber
  actor U as New user
  participant A as AuthService
  participant DB as Neon Postgres
  U->>A: POST /api/v1/auth/register (name, email, password, inviteCode?)
  A->>DB: rate limit by IP (auth_rate_limit, 30 per 15 min)
  A->>A: scrypt(password, random salt)
  A->>DB: BEGIN + global lock
  A->>DB: INSERT app_user, auth_credential
  alt inviteCode given
    A->>DB: join that home base: member row, participations,<br/>milestone-zero join logs for its activities
  else no code
    A->>DB: create "Name's home base" + invite code
  end
  A->>DB: INSERT auth_session (hashed token, 30 days)
  A->>DB: COMMIT (an invalid code rolls back the whole signup)
  A-->>U: 201 { token, user }
```

## 5. Deploy

```mermaid
sequenceDiagram
  autonumber
  actor Dev as Developer
  participant GH as GitHub
  participant CI as GitHub Actions
  participant PG as PostgreSQL 17 (CI service)
  participant V as Vercel
  participant N as Neon (production)
  Dev->>GH: push branch, open PR
  GH->>CI: checks job
  CI->>PG: migrate disposable database
  CI->>CI: type checks, lint, API / client / playground tests
  Dev->>GH: merge to main
  GH->>CI: checks, then deploy job (api, playground)
  CI->>V: vercel pull (production env) + vercel build
  CI->>N: run migrate.ts (api only)
  CI->>V: vercel deploy --prebuilt --prod
  CI->>V: verify-deployment.mjs smoke checks
```
