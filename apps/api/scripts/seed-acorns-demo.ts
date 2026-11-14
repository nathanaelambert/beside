// Seeds a showcase home base for the rewards-currency experiment through the
// public API, so every acorn in it was earned by the real rules.
//
//   API_URL=http://localhost:3093 node --experimental-strip-types scripts/seed-acorns-demo.ts
//
// Use a disposable local database. Accounts use synthetic example addresses.

const api = process.env.API_URL ?? "http://localhost:3093";
const password = process.env.DEMO_PASSWORD ?? "beside-demo-password";
const suffix = process.env.DEMO_SUFFIX ?? "";
const minute = 60_000;

async function call<T>(
  path: string,
  token: string | null,
  method = "GET",
  body?: object,
): Promise<T> {
  const response = await fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json)}`);
  return json as T;
}

type Session = { token: string; user: { id: string } };
const people = [
  { key: "mosaab", name: "Mosaab" },
  { key: "nathanael", name: "Nathanael Lambert" },
  { key: "vaibhav", name: "Vaibhav Kapoor" },
  { key: "pritesh", name: "Pritesh Parmar" },
];
const email = (key: string) => `${key}${suffix}@demo.beside.test`;

const first = await call<Session>("/auth/register", null, "POST", {
  name: people[0]!.name,
  email: email(people[0]!.key),
  password,
});
const [base] = await call<{ id: string; inviteCode: string }[]>(
  "/homebases",
  first.token,
);
await call(`/homebases/${base!.id}`, first.token, "PATCH", {
  name: "Project Beside",
});
const sessions: Record<string, Session> = { mosaab: first };
for (const person of people.slice(1))
  sessions[person.key] = await call<Session>("/auth/register", null, "POST", {
    name: person.name,
    email: email(person.key),
    password,
    inviteCode: base!.inviteCode,
  });

const activity = await call<{ entityId: string }>(
  "/activities",
  first.token,
  "POST",
  {
    templateId: "read-book",
    name: "Read together",
    description: "One chapter of The Overstory, then we talk about it.",
    target: 12,
    connectionId: base!.id,
  },
);
const milestone = async (name: string, startAt: number, endAt: number) =>
  (
    await call<{ entityId: string }>("/milestones", first.token, "POST", {
      activityId: activity.entityId,
      parentId: null,
      name,
      quantity: 1,
      policy: "paced",
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      itemId: null,
    })
  ).entityId;
const checkIn = (who: string, milestoneId: string) =>
  call("/logs", sessions[who]!.token, "POST", {
    milestoneId,
    isSuccess: true,
    title: "I was there",
    durationMinutes: 30,
    origin: "manual",
    externalKey: `demo:${who}:${milestoneId}`,
  });

const now = Date.now();
// Earlier chapters close a couple of minutes after seeding.
const closesSoon = now + 2 * minute;
const one = await milestone("Chapter 1", now - 7 * 24 * 60 * minute, closesSoon);
for (const person of people) await checkIn(person.key, one); // 4 × 2 + 32
const two = await milestone("Chapter 2", now - 2 * 24 * 60 * minute, closesSoon);
for (const who of ["nathanael", "vaibhav", "pritesh"]) await checkIn(who, two); // 6
await call("/decorations", sessions.nathanael!.token, "POST", {
  homebaseId: base!.id,
  itemId: "sunflower",
  x: 176,
  y: 112,
  externalKey: "demo:sunflower",
});
// Tonight's chapter: everyone but Mosaab has already checked in.
const three = await milestone("Chapter 3", now - 30 * minute, now + 6 * 60 * minute);
for (const who of ["nathanael", "vaibhav", "pritesh"]) await checkIn(who, three); // 6
await milestone(
  "Chapter 4",
  now + 7 * 24 * 60 * minute,
  now + 7 * 24 * 60 * minute + 3 * 60 * minute,
);

const state = await call<{ acornEntries: { amount: number }[] }>(
  "/state",
  first.token,
);
console.log(
  JSON.stringify(
    {
      homebaseId: base!.id,
      login: email("mosaab"),
      password,
      balance: state.acornEntries.reduce((sum, row) => sum + row.amount, 0),
    },
    null,
    2,
  ),
);
