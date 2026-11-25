import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ApiHomebase,
  ApiState,
  MutationResult,
  Session,
  HomebaseGarden,
} from "@beside/domain/api";
import { checkMeadowPlacement } from "@beside/domain/garden";

// Always loopback. A separate port lets throwaway verification avoid a running demo API.
const port = Number(process.env.ARCHIPELAGO_DEMO_PORT ?? 3096);
assert.ok(
  Number.isInteger(port) && port > 0 && port <= 65535,
  "Invalid demo API port",
);
const origin = `http://localhost:${port}/api/v1`;
const password = "beside-demo-1";
const cachePath =
  process.env.ARCHIPELAGO_DEMO_SESSION_CACHE ??
  join(tmpdir(), "beside-archipelago-demo-sessions.json");
const sessions: Record<string, Session> = JSON.parse(
  await readFile(cachePath, "utf8").catch(() => "{}"),
);

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
async function api<T>(
  path: string,
  token?: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      `${method} ${path}: ${response.status} ${JSON.stringify(result)}`,
    );
  return result as T;
}
async function account(name: string, inviteCode?: string): Promise<Session> {
  const email = `${name.split(" ")[0]!.toLowerCase()}@archipelago.demo`;
  let session = sessions[email];
  if (session) {
    try {
      await api("/auth/me", session.token);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error;
      session = undefined;
    }
  }
  if (!session) {
    try {
      session = await api<Session>("/auth/register", undefined, {
        name,
        email,
        password,
        ...(inviteCode ? { inviteCode } : {}),
      });
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
      session = await api<Session>("/auth/login", undefined, {
        email,
        password,
      });
    }
    sessions[email] = session;
    await writeFile(cachePath, JSON.stringify(sessions), { mode: 0o600 });
  }
  if (inviteCode) await api("/homebases/join", session.token, { inviteCode });
  return session;
}

const mosaab = await account("Mosaab");
const token = mosaab.token;
const state = () => api<ApiState>("/state", token);
let bases = await api<ApiHomebase[]>("/homebases", token);
// Registration creates a base. Reuse it so Mosaab has exactly three islands.
const initial = bases.find((base) => base.name === "Mosaab's home base");
if (initial && !bases.some((base) => base.name === "Project Beside")) {
  await api(
    `/homebases/${initial.id}`,
    token,
    { name: "Project Beside" },
    "PATCH",
  );
  bases = await api<ApiHomebase[]>("/homebases", token);
}

const plans = [
  {
    name: "Project Beside",
    people: ["Nathanael Lambert", "Vaibhav Kapoor", "Pritesh Parmar"],
    oak: { x: 104, y: 104 },
    activities: [
      {
        name: "Read together",
        templateId: "read-book",
        target: 12,
        milestone: "Our first chapter",
        itemId: "pink-tulip",
      },
      {
        name: "Morning run",
        templateId: "workout",
        target: 8,
        milestone: "First run by the waterfront",
        itemId: "star-statue",
      },
      {
        name: "Build something lovely",
        templateId: "custom-project",
        target: 5,
        milestone: "A small idea for Beside",
        itemId: null,
      },
    ],
  },
  {
    name: "Family",
    people: ["Samira El-Emam", "Youssef El-Emam"],
    oak: null,
    activities: [
      {
        name: "Sunday cooking",
        templateId: "cook-habit",
        target: 4,
        milestone: "A meal from our family notebook",
        itemId: "sunflower",
      },
      {
        name: "Evening walk",
        templateId: "walk",
        target: 20,
        milestone: "Around the neighbourhood",
        itemId: null,
      },
    ],
  },
  {
    name: "Climbing crew",
    people: ["Lina Haddad", "Omar Farouk", "Jonas Berg"],
    oak: { x: 104, y: 104 },
    activities: [
      {
        name: "Bouldering together",
        templateId: "workout",
        target: 6,
        milestone: "Climbing session — come join us",
        itemId: null,
      },
    ],
  },
];

for (const plan of plans) {
  let base = bases.find((candidate) => candidate.name === plan.name);
  if (!base) {
    base = await api<ApiHomebase>("/homebases", token, { name: plan.name });
    bases.push(base);
  }
  if (!base.inviteCode) throw new Error(`Missing invite code for ${base.name}`);
  const people = [mosaab];
  for (const name of plan.people)
    people.push(await account(name, base.inviteCode));
  for (const activityPlan of plan.activities) {
    let snapshot = await state();
    let activity = snapshot.activities.find(
      (row) => row.connectionId === base.id && row.name === activityPlan.name,
    );
    if (!activity) {
      const created = await api<MutationResult>("/activities", token, {
        connectionId: base.id,
        templateId: activityPlan.templateId,
        name: activityPlan.name,
        target: activityPlan.target,
        description: `A little time together with ${plan.name}.`,
      });
      snapshot = await state();
      activity = snapshot.activities.find(
        (row) => row.id === created.entityId,
      )!;
    }
    let milestone = snapshot.milestones.find(
      (row) =>
        row.activityId === activity.id && row.name === activityPlan.milestone,
    );
    const live = plan.name === "Climbing crew";
    const window = {
      startAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      endAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    };
    if (
      milestone &&
      live &&
      milestone.endAt &&
      Date.parse(milestone.endAt) <= Date.now()
    ) {
      // Reads settle expired windows with failure logs. Replace that demo session
      // through the API because logged milestone schedules are immutable.
      await api(`/milestones/${milestone.id}`, token, undefined, "DELETE");
      milestone = undefined;
    }
    if (!milestone) {
      const created = await api<MutationResult>("/milestones", token, {
        activityId: activity.id,
        parentId: null,
        name: activityPlan.milestone,
        quantity: 1,
        policy: live ? "paced" : "open",
        startAt: live ? window.startAt : null,
        endAt: live ? window.endAt : null,
        itemId: activityPlan.itemId,
      });
      snapshot = await state();
      milestone = snapshot.milestones.find(
        (row) => row.id === created.entityId,
      )!;
    } else if (
      live &&
      (!milestone.endAt ||
        Date.parse(milestone.endAt) < Date.now() + 60 * 60_000)
    ) {
      // Refresh the same unlogged session on reruns; never duplicate a session.
      await api(
        `/milestones/${milestone.id}`,
        token,
        { policy: "paced", ...window },
        "PATCH",
      );
    }
    if (!live) {
      // Equal-value rewards require every saved roster member to endorse the
      // proposed item before completion. Earned rewards stay in the waiting dock.
      snapshot = await state();
      const reward = snapshot.rewards.find(
        (row) => row.id === milestone.rewardId,
      );
      if (reward && !reward.obtainedAt)
        for (const person of people)
          await api(
            `/rewards/${reward.id}/agreement`,
            person.token,
            undefined,
            "PUT",
          );
      for (const person of people) {
        await api("/logs", person.token, {
          milestoneId: milestone.id,
          isSuccess: true,
          title: `${person.user.name}: ${activityPlan.milestone}`,
          durationMinutes: 25,
          origin: "manual",
          externalKey: `archipelago:${milestone.id}:${person.user.id}`,
        });
      }
    }
  }
  if (plan.oak) {
    const garden = await api<HomebaseGarden>(
      `/homebases/${base.id}/garden`,
      token,
    );
    if (!garden.oak) {
      assert.equal(
        checkMeadowPlacement(plan.oak, garden.rewards),
        null,
        "Starter oak must satisfy the shared placement rule with saved rewards",
      );
      await api(`/homebases/${base.id}/garden/starter-oak`, token, plan.oak);
    }
  }
}

// Verify the visible workspace as Mosaab, including real reward ownership/rosters.
bases = await api<ApiHomebase[]>("/homebases", token);
const snapshot = await state();
assert.equal(bases.length, 3);
for (const plan of plans) {
  const base = bases.find((row) => row.name === plan.name)!;
  assert.ok(base);
  const names = base.memberIds
    .map((id) => snapshot.users.find((user) => user.id === id)!.name)
    .sort();
  assert.deepEqual(names, ["Mosaab", ...plan.people].sort());
  const activities = snapshot.activities.filter(
    (row) => row.connectionId === base.id,
  );
  assert.equal(activities.length, plan.activities.length);
  const rewards = snapshot.rewards.filter((row) => row.homebaseId === base.id);
  const expectedRewards = plan.activities.filter((row) => row.itemId).length;
  assert.equal(rewards.length, expectedRewards);
  assert.equal(rewards.filter((row) => row.obtainedAt).length, expectedRewards);
  for (const reward of rewards)
    assert.deepEqual(
      [...reward.requiredUserIds].sort(),
      [...base.memberIds].sort(),
    );
  const garden = await api<HomebaseGarden>(
    `/homebases/${base.id}/garden`,
    token,
  );
  assert.deepEqual(
    garden.oak,
    plan.oak ? { itemId: "oak-tree", ...plan.oak } : null,
  );
  if (plan.name === "Climbing crew")
    assert.ok(
      snapshot.milestones.some(
        (row) =>
          row.activityId === activities[0]!.id &&
          row.policy === "paced" &&
          Date.parse(row.startAt!) <= Date.now() &&
          Date.parse(row.endAt!) > Date.now(),
      ),
    );
  console.log(
    JSON.stringify({
      homebase: base.name,
      members: names,
      activities: activities.map((row) => row.name),
      earnedRewards: rewards.map((row) => row.itemId),
      oak: garden.oak,
    }),
  );
}
console.log(
  "Verified all three islands as Mosaab. Demo password: beside-demo-1",
);
