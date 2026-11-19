# Archipelago demo

Run from this worktree root with Node 24 after `pnpm install`, migrations, and
starting the isolated API on port 3096:

```sh
pnpm --filter @beside/api exec node --conditions=source --experimental-strip-types scripts/seed-archipelago-demo.ts
```

The seed defaults to `http://localhost:3096/api/v1`. Configure the API's `.env`
with database `beside_exp_archipelago` before starting it. It creates all accounts,
memberships, activities, milestones, logs, earned rewards and starter oaks through
HTTP. It checks oak positions using the shared domain placement helper. Each
reward is agreed to and earned by successful logs from every member in its saved
roster, then waits in that island’s dock for manual placement. The seed uses the
current API and migrations 001–005 and 008; it never inserts garden or reward rows
directly.

Sign in as `mosaab@archipelago.demo` with password `beside-demo-1`. Other accounts
use their lowercase first name at `archipelago.demo`, with the same password:
Nathanael, Vaibhav, Pritesh, Samira, Youssef, Lina, Omar, Jonas.

Reruns reuse named entities and deterministic log retry keys. The unlogged climbing
session stays open for 24 hours and is refreshed on rerun. If it has already
expired, the seed replaces that demo session through the API, since automatic
failure logs make expired milestone schedules immutable. The final verification
reads `/homebases`, `/state`, and every garden as Mosaab and asserts the members,
activity counts, obtained rewards/rosters, oak positions, and open climbing window.
No database rows are edited directly. Run one seed process at a time: entity
creation endpoints do not support concurrent seed runs.

Session tokens are cached in a mode-0600 file named
`beside-archipelago-demo-sessions.json` in the OS temporary directory, avoiding
unnecessary sign-ins against the API's 30-attempt/15-minute IP limit. Do not share
this file. Delete it after recreating the database; expired sessions automatically
sign in again. A missing cache may require waiting for the sign-in limit to reset
after many repeated runs.

For a throwaway database, pass a unique `ARCHIPELAGO_DEMO_SESSION_CACHE` file path
to the seed command so its sessions do not replace the regular demo cache. Start
the API with `DATABASE_URL` pointing at that database and an unused `PORT`
(default 3096). Pass the same port as `ARCHIPELAGO_DEMO_PORT` to the seed; its
HTTP origin is always localhost. Remove the temporary cache after dropping the
database.
