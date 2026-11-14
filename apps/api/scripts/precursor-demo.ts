// Showcase helper for the precursor-rewards experiment. Talks to a running API
// over HTTP, so it exercises the same rules as the app. Never point it at a
// shared or production API: it registers demo accounts.
//
//   API_URL=http://localhost:3094 node --experimental-strip-types scripts/precursor-demo.ts setup
//   ... friend      # the friend checks in to every open milestone
//   ... cottage     # plan all four cottage stages as open milestones
import process from "node:process";

const api = (process.env.API_URL ?? "http://localhost:3094").replace(/\/$/, "");
const password = process.env.DEMO_PASSWORD ?? "precursor-demo-password";
const people = {
  you: { name: "Mosaab", email: "mosaab.precursors@example.test" },
  friend: {
    name: "Nathanael Lambert",
    email: "nathanael.precursors@example.test",
  },
};

async function call<T>(
  path: string,
  token: string | null,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${data?.message}`);
  return data as T;
}

type Session = { token: string; user: { id: string } };
const login = (who: keyof typeof people) =>
  call<Session>("/auth/login", null, "POST", {
    email: people[who].email,
    password,
  });

// One window, open from ten minutes ago for six hours.
const window = () => ({
  policy: "paced",
  startAt: new Date(Date.now() - 10 * 60000).toISOString(),
  endAt: new Date(Date.now() + 6 * 3600000).toISOString(),
});

async function state(session: Session) {
  return call<{
    activities: { id: string; name: string; connectionId: string }[];
    milestones: {
      id: string;
      activityId: string;
      kind: string;
      startAt: string | null;
      endAt: string | null;
    }[];
    logs: {
      milestoneId: string | null;
      authorUserId: string;
      isSuccess: boolean;
    }[];
  }>("/state", session.token);
}

async function gardenClub(session: Session) {
  const activity = (await state(session)).activities.find(
    (a) => a.name === "Garden club",
  );
  if (!activity) throw new Error("Run setup first.");
  return activity;
}

async function plan(
  session: Session,
  activityId: string,
  name: string,
  itemId: string,
) {
  await call("/milestones", session.token, "POST", {
    activityId,
    parentId: null,
    name,
    quantity: 1,
    itemId,
    ...window(),
  });
}

async function setup() {
  const you = await call<Session>("/auth/register", null, "POST", {
    ...people.you,
    password,
  });
  const [base] = await call<{ id: string; inviteCode: string }[]>(
    "/homebases",
    you.token,
  );
  await call(`/homebases/${base!.id}`, you.token, "PATCH", {
    name: "Project Beside",
  });
  await call<Session>("/auth/register", null, "POST", {
    ...people.friend,
    password,
    inviteCode: base!.inviteCode,
  });
  const { entityId: activityId } = await call<{ entityId: string }>(
    "/activities",
    you.token,
    "POST",
    {
      templateId: "custom-project",
      name: "Garden club",
      description: "Tend the meadow together, one evening at a time.",
      connectionId: base!.id,
      target: 10,
    },
  );
  await plan(you, activityId, "Plant our first tree", "oak-tree");
  await friend();
  console.log(`Sign in as ${people.you.email} / ${password}`);
}

async function friend() {
  const session = await login("friend");
  const snapshot = await state(session);
  const now = Date.now();
  for (const milestone of snapshot.milestones) {
    const open =
      milestone.kind === "achievement" &&
      milestone.startAt &&
      milestone.endAt &&
      Date.parse(milestone.startAt) <= now &&
      now <= Date.parse(milestone.endAt);
    const done = snapshot.logs.some(
      (l) =>
        l.milestoneId === milestone.id &&
        l.authorUserId === session.user.id &&
        l.isSuccess,
    );
    if (!open || done) continue;
    await call("/logs", session.token, "POST", {
      milestoneId: milestone.id,
      isSuccess: true,
      title: "I was there",
      durationMinutes: 0,
      origin: "manual",
      externalKey: `attendance:${milestone.id}`,
    });
    console.log(`${people.friend.name} checked in to ${milestone.id}.`);
  }
}

async function cottage() {
  const you = await login("you");
  const { id } = await gardenClub(you);
  // Each planned stage unlocks planning the next; they build in this order.
  await plan(you, id, "Lay the foundation", "cottage-foundation");
  await plan(you, id, "Raise the walls", "cottage-walls");
  await plan(you, id, "Put on the roof", "cottage-roof");
  await plan(you, id, "Move in", "cottage");
  await friend();
}

const command = process.argv[2];
const actions: Record<string, () => Promise<void>> = { setup, friend, cottage };
if (!command || !actions[command]) {
  console.error("Usage: precursor-demo.ts setup | friend | cottage");
  process.exitCode = 1;
} else await actions[command]();
