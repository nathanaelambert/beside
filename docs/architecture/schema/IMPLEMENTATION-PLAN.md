# Implementation plan: moving to the target schema

This plan takes `apps/api` from migrations 001–005 to
[`target-schema.sql`](target-schema.sql) in small, reviewable pull requests.
Each PR ships on its own, keeps CI green and leaves production working.

Read first: [`ERD.md`](ERD.md) (diagrams and the whiteboard mapping) and the
proposal's sections on scaling and multi-tenancy.

## Ground rules

- **Migrations are append-only.** Never edit 001–005. New files start at
  `apps/api/src/db/migrations/006_*.sql`; `scripts/migrate.ts` applies them in
  name order inside a transaction.
- **Expand, then contract.** Add new columns/tables and backfill in one PR;
  switch code to them; drop the old ones in a later PR. Production deploys run
  migrations before the new code is live (`ci-and-deploy.yml`), so old code
  must keep working against the expanded schema.
- **Keep the API compatible for one release.** Where a field is renamed
  (e.g. `connectionId` → `homebaseId`), accept both in requests and return both
  in responses until mobile and playground are updated.
- **Every PR updates four layers together:** SQL migration, `packages/domain`
  types and logic, `apps/api` persistence and routes, and the clients
  (`packages/api-client`, `apps/mobile`, `apps/playground`).
- **Test against real Postgres.** Add cases to `apps/api/test/migrations.test.ts`
  (migrate a database seeded at the previous version, then assert the
  backfill) and to `api.test.ts` for behaviour.

## Two constraints in today's code to know before starting

1. **Generic persistence is keyed on `id`.** `apps/api/src/db/storage.ts`
   diffs every table by `record.id` and orders by `row_order`. The target
   schema uses composite primary keys on join tables (`homebase_member`,
   `activity_subject`, `log_share`, `log_contribution`) and drops `row_order`.
   Until PR 1 replaces the generic diff, **keep the surrogate `id` and
   `row_order` columns** and add the composite keys as `UNIQUE` constraints.
2. **RLS does not apply to the table owner.** The API currently connects with
   Neon's owner role, which bypasses row-level security. PR 3 must add a
   separate application role (and/or `ALTER TABLE … FORCE ROW LEVEL SECURITY`)
   or RLS will silently do nothing.

## PR sequence

| PR  | Title                                                  | Migration                        | Depends on |
| --- | ------------------------------------------------------ | -------------------------------- | ---------- |
| 0   | Hosting: Vercel Pro, preview databases, minute cron    | none                             | none       |
| 1   | Per-homebase writes and explicit persistence           | none                             | 0          |
| 2   | Integrity fixes (rewards, milestones, types)           | `006_integrity.sql`              | 1          |
| 3   | Organizations, `org_id` and RLS                        | `007_organizations.sql`          | 2          |
| 4   | Whiteboard: homebase hierarchy, user type, sports      | `008_homebase_hierarchy.sql`     | 3          |
| 5   | Audience, roles and invites                            | `009_audience_roles_invites.sql` | 4          |
| 6   | Outbox, queues and read-only reads                     | `010_outbox.sql`                 | 1          |
| 7   | World: placements and messages                         | `011_world.sql`                  | 2          |
| 8   | Contract: drop legacy columns, rename to `homebase_id` | `012_contract.sql`               | 3–5        |

PRs 6 and 7 can run in parallel with 3–5.

---

### PR 0 — Hosting (no code changes to the model)

- Upgrade the Vercel team to Pro (Hobby is non-commercial only).
- In the Neon integration, enable a database branch per preview deployment.
- `apps/api/vercel.json`: change the cron schedule to `* * * * *`.
- Update `.github/README.md` (cron note).

**Done when:** preview deployments never use the production database.

### PR 1 — Per-homebase writes and explicit persistence

Files: `apps/api/src/db/database.service.ts`, `storage.ts`, `tables.ts`,
`apps/api/src/domain.service.ts`, `homebases.ts`, `packages/domain/src/model.ts`.

- Replace the global `pg_advisory_xact_lock(724390821)` with a lock per
  homebase: `SELECT pg_advisory_xact_lock(hashtext($homebaseId))`, or
  `SELECT … FROM homebase WHERE id = $1 FOR UPDATE`.
- Add `loadHomebaseScope(client, homebaseId)` that loads only that homebase's
  rows into the existing `Database` shape, so `execute()` keeps working.
- Replace the generic `persistChanges` diff with explicit inserts/updates per
  command (follow `garden.service.ts`, which already writes SQL directly).
  This unblocks composite keys later.
- Commands that span homebases (e.g. `distributeLog`) lock every homebase
  involved, in sorted id order, to avoid deadlocks.

**Tests:** two writes in different homebases run concurrently; two in the same
homebase serialize; the existing cooperative-reward concurrency test still passes.

**Done when:** no request loads every table.

### PR 2 — Integrity fixes · `006_integrity.sql`

- `reward_requirement(reward_id, participation_id, status)`; backfill from
  `reward.required_user_ids` by joining each user to their participation.
- `reward.milestone_id` (unique, backfilled from `milestone.reward_id`).
- Milestone zero: allow `parent_id IS NULL` for `kind = 'join'`; backfill
  self-parents to `NULL`; replace the self-parent CHECK and deferrable FK.
- `activity_log.milestone_id NOT NULL` after moving any v1 rows to
  `activity_log_legacy`.
- `milestone_schedule.next_date` and `milestone_occurrence.local_date`: `text`
  → `date` (`USING next_date::date`).
- Add `created_at` to `app_user`, `homebase`, `homebase_member`,
  `participation`, `reward`.
- Domain: `Reward.requiredUserIds` → read from `reward_requirement`; a leaving
  participant marks their requirement `waived` so the reward can still be earned.

**Done when:** the reward is obtainable after a required participant leaves.

### PR 3 — Organizations and RLS · `007_organizations.sql`

- Create `organization`, `org_membership`, `org_policy`, `guardian_link`.
- Backfill one `personal` organization per existing user and set
  `homebase.org_id` from its first member; add `org_id` to every tenant table
  (see section 8 of `target-schema.sql`) and backfill through joins.
- Create an application role without ownership; enable RLS with
  `org_id = current_setting('app.org_id', true)`; the API runs
  `SET LOCAL app.org_id` at the start of each transaction.
- Domain/API: resolve the actor's organization on each request.

**Tests:** a user in org A cannot read org B's rows even with a forged id.

### PR 4 — Whiteboard additions · `008_homebase_hierarchy.sql`

From the 2026-11-14 whiteboard (see `ERD.md`):

- `app_user.user_type` (`student`, `teacher`, `guardian`, `staff`, `member`)
  and `app_user.home_homebase_id` (nullable FK, the whiteboard's Homebase_Spec).
- `homebase.type` (`school`, `class`, `school_project`, `club`, `group`,
  `personal`) and `homebase.parent_homebase_id` with the cycle-check trigger.
- `homebase_composition` for combined homebases such as 3A+3B.
- `sport` and `homebase_sport`; optional `activity.sport_id`.
- Backfill: existing homebases get `type = 'group'`, no parent.
- API: create/move homebases under a parent; list a subtree
  (recursive CTE in `target-schema.sql` §9); manage sports per homebase.
- Clients: homebase picker shows the tree; teacher view lists classes.

Use `seed-whiteboard-example.sql` as test data.

**Tests:** cycles rejected; a parent in another org rejected; subtree query
returns every class under a school.

### PR 5 — Audience, roles and invites · `009_audience_roles_invites.sql`

- `activity_audience(activity_id, homebase_id)`, backfilled from
  `activity.connection_id`; the activity is visible to members of any audience
  homebase. Keep `connection_id` until PR 8.
- `homebase_member.role`, `status`, `joined_at`, `left_at`, `expires_at`.
- `homebase_invite`: change the primary key from `homebase_id` to `id`; add
  `created_by`, `expires_at`, `max_uses`, `used_count`, `revoked_at`.
- Participation: stop auto-joining every member; support `invited` and `vetoed`.

### PR 6 — Outbox and queues · `010_outbox.sql`

- `domain_event.payload jsonb`, `published_at`; keep `message` until clients
  render from `payload`.
- `event_delivery.read_at`.
- `participation.progress_total`, updated in the same transaction as each
  contribution.
- Cron publishes unpublished events and expired milestones to Vercel Queues
  (or SQS on AWS); consumers settle and notify.
- Remove `settleExpiredMilestones` from `DomainService.state()` so reads are
  read-only.

### PR 7 — World · `011_world.sql`

- `reward_placement` and `world_message`.
- Decide whether `homebase_starter_oak` (migration 005) becomes a
  `reward_placement` of a free reward or stays a separate table.

### PR 8 — Contract · `012_contract.sql`

Only after all clients use the new fields:

- Drop `reward.required_user_ids`, `milestone.reward_id`, `reward.homebase_id`,
  `activity.connection_id`, `domain_event.message`.
- Rename `connection_id` → `homebase_id` in `homebase_member`, `log_share`,
  `event_delivery`; drop the `Connection`/`connections` aliases in
  `packages/domain/src/types.ts`.
- Drop surrogate `id` and `row_order` from join tables (PR 1 removed the need).

## Files touched across the plan

| Area        | Files                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL         | `apps/api/src/db/migrations/006_*.sql` onward                                                                                                   |
| Persistence | `apps/api/src/db/{storage,tables,database.service}.ts`                                                                                          |
| API         | `apps/api/src/{domain.service,homebases,auth,scheduling.service,garden.service,controllers}.ts`                                                 |
| Domain      | `packages/domain/src/{types,model,validation,view,expiry,api,migrations}.ts`                                                                    |
| Clients     | `packages/api-client/src/index.ts`, `apps/mobile/app/screens/*`, `apps/mobile/app/services/api/homebase.ts`, `apps/playground/src/components/*` |
| Tests       | `apps/api/test/{migrations,api,scheduling}.test.ts`, `apps/playground/src/lib/*.test.ts`                                                        |

`packages/domain/src/migrations.ts` upgrades the playground's local JSON
database; bump its version when `Database` changes shape.

## Checklist for every PR

- [ ] Migration applies on a copy of production data (Neon branch).
- [ ] `pnpm --filter @beside/api test` passes with `TEST_DATABASE_URL` set.
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm build` pass.
- [ ] OpenAPI updated; old field names still accepted where renamed.
- [ ] `docs/architecture/schema/` updated if the target changed.
