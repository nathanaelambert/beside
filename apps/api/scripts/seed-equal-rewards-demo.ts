// Demo data for the equal-value rewards showcase (docs/experiments/rewards-equal-value.md).
//
// WIPES every account, home base and activity in DATABASE_URL, then seeds through the
// running API at API_URL. Refuses anything but a local database.
//
//   DATABASE_URL=postgresql://localhost:5432/beside_exp_equal API_URL=http://localhost:3095 \
//     node --conditions=source --experimental-strip-types scripts/seed-equal-rewards-demo.ts
import { Pool } from "pg";
import { meadowPlacements, type MeadowPoint } from "@beside/domain/garden";
import { rewardItems } from "@beside/domain/catalog";

const databaseUrl = process.env.DATABASE_URL ?? "";
const api = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
if (
  !/^postgres(ql)?:\/\/(?:[^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(
    databaseUrl,
  )
)
  throw new Error(
    "Refusing to wipe a non-local database. Set a localhost DATABASE_URL.",
  );

const password = "beside-demo-password";
const hasItem = (id: string) => rewardItems.some((item) => item.id === id);
const pick = (preferred: string, fallback: string) =>
  hasItem(preferred) ? preferred : fallback;

type Session = { token: string; user: { id: string; name: string } };
async function call<T>(
  path: string,
  method = "GET",
  body?: unknown,
  session?: Session,
): Promise<T> {
  const response = await fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${data?.message}`);
  return data as T;
}

// 1. Reset (keeps the catalog, templates and migrations).
const pool = new Pool({ connectionString: databaseUrl });
const { rows } = await pool.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
   AND tablename NOT IN ('reward_item', 'subject_template', 'activity_template', 'beside_migration')`,
);
await pool.query(
  `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`,
);
await pool.end();

// 2. Four members in one home base. Mosaab signs in to the app.
const register = (name: string, email: string, inviteCode?: string) =>
  call<Session>("/auth/register", "POST", {
    name,
    email,
    password,
    inviteCode,
  });
const mosaab = await register("Mosaab", "mosaab@beside.test");
const [base] = await call<{ id: string; inviteCode: string }[]>(
  "/homebases",
  "GET",
  undefined,
  mosaab,
);
await call(
  `/homebases/${base!.id}`,
  "PATCH",
  { name: "Project Beside" },
  mosaab,
);
const nathanael = await register(
  "Nathanael Lambert",
  "nathanael@beside.test",
  base!.inviteCode,
);
const vaibhav = await register(
  "Vaibhav Kapoor",
  "vaibhav@beside.test",
  base!.inviteCode,
);
const pritesh = await register(
  "Pritesh Parmar",
  "pritesh@beside.test",
  base!.inviteCode,
);
const everyone = [mosaab, nathanael, vaibhav, pritesh];

const activity = (
  session: Session,
  templateId: string,
  name: string,
  description = "",
) =>
  call<{ entityId: string }>(
    "/activities",
    "POST",
    { templateId, name, description, connectionId: base!.id, target: 1 },
    session,
  ).then((r) => r.entityId);
const milestone = (
  session: Session,
  activityId: string,
  name: string,
  itemId: string,
  window?: { startAt: string; endAt: string },
) =>
  call<{ entityId: string }>(
    "/milestones",
    "POST",
    {
      activityId,
      parentId: null,
      name,
      quantity: 1,
      policy: window ? "paced" : "open",
      startAt: window?.startAt ?? null,
      endAt: window?.endAt ?? null,
      itemId,
    },
    session,
  ).then((r) => r.entityId);
const checkIn = (session: Session, milestoneId: string) =>
  call(
    "/logs",
    "POST",
    {
      milestoneId,
      isSuccess: true,
      title: "I was there",
      durationMinutes: 0,
      origin: "manual",
      externalKey: `seed:${milestoneId}:${session.user.id}`,
    },
    session,
  );
const rewardOf = async (milestoneId: string) =>
  (
    await call<{ milestones: { id: string; rewardId: string | null }[] }>(
      "/state",
      "GET",
      undefined,
      mosaab,
    )
  ).milestones.find((m) => m.id === milestoneId)!.rewardId!;
const agree = async (session: Session, milestoneId: string) =>
  call(
    `/rewards/${await rewardOf(milestoneId)}/agreement`,
    "PUT",
    undefined,
    session,
  );

// 3. History: a lived-in meadow where every reward remembers what earned it.
const placed: MeadowPoint[] = [{ x: 184, y: 104 }]; // The starter oak.
await call(
  `/homebases/${base!.id}/garden/starter-oak`,
  "POST",
  placed[0],
  mosaab,
);
async function earnAndPlace(milestoneId: string, near: MeadowPoint) {
  for (const session of everyone) await checkIn(session, milestoneId);
  const spot = meadowPlacements(placed).sort(
    (a, b) =>
      Math.hypot(a.x - near.x, a.y - near.y) -
      Math.hypot(b.x - near.x, b.y - near.y),
  )[0]!;
  placed.push(spot);
  await call(
    `/homebases/${base!.id}/garden/rewards/${await rewardOf(milestoneId)}`,
    "PUT",
    spot,
    nathanael,
  );
}
const bookClub = await activity(
  mosaab,
  "read-book",
  "Book club",
  "One book a month, at our own pace.",
);
await earnAndPlace(
  await milestone(
    mosaab,
    bookClub,
    "Finished Project Hail Mary",
    "star-statue",
  ),
  { x: 112, y: 112 },
);
const run = await activity(
  vaibhav,
  "custom-project",
  "Wednesday run",
  "5 km, wherever we are.",
);
// A small flower bed above the pond: one tulip per week, a collection by design.
for (const [week, x] of [
  ["Week 1", 136],
  ["Week 2", 160],
  ["Week 3", 184],
] as const)
  await earnAndPlace(await milestone(vaibhav, run, week, "pink-tulip"), {
    x,
    y: 128,
  });

// 4. Live: Mosaab is the last check-in for tonight's movie, so his tap lands the reward.
const now = Date.now();
const movie = await activity(
  nathanael,
  "movie-night",
  "Movie night",
  "Watch together, apart.",
);
const tonight = await milestone(
  nathanael,
  movie,
  "Dune: Part Two",
  "blue-banner",
  {
    startAt: new Date(now - 60 * 60_000).toISOString(),
    endAt: new Date(now + 6 * 60 * 60_000).toISOString(),
  },
);
for (const session of [vaibhav, pritesh, mosaab]) await agree(session, tonight);
for (const session of [nathanael, vaibhav, pritesh])
  await checkIn(session, tonight);

// 5. Pending: Nathanael proposed a reward, Vaibhav agreed, Mosaab and Pritesh haven't yet.
const dune = await activity(
  nathanael,
  "read-book",
  "Read Dune together",
  "Book one, a part a week.",
);
const partOne = await milestone(
  nathanael,
  dune,
  "Part one: Dune",
  pick("cherry-tree", "oak-tree"),
  {
    startAt: new Date(now - 30 * 60_000).toISOString(),
    endAt: new Date(now + 6 * 60 * 60_000).toISOString(),
  },
);
await agree(vaibhav, partOne);

console.log(
  `Seeded "Project Beside". Sign in as mosaab@beside.test / ${password}`,
);
