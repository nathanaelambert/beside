import { randomBytes } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { execute, id } from "@beside/domain/model";
import { loadDatabase, persistChanges } from "./db/storage.ts";

// The caller supplies one locked transaction, including during registration.
export async function createHomebase(
  client: PoolClient,
  userId: string,
  name: string,
) {
  const homebaseId = id("homebase");
  const inviteCode = randomBytes(24).toString("base64url");
  await client.query("INSERT INTO homebase(id, name) VALUES ($1, $2)", [
    homebaseId,
    name,
  ]);
  await client.query(
    "INSERT INTO homebase_member(id, connection_id, user_id) VALUES ($1, $2, $3)",
    [id("member"), homebaseId, userId],
  );
  await client.query(
    "INSERT INTO homebase_invite(homebase_id, code) VALUES ($1, $2)",
    [homebaseId, inviteCode],
  );
  return { id: homebaseId, name, inviteCode, memberIds: [userId] };
}

export async function joinHomebase(
  client: PoolClient,
  userId: string,
  inviteCode: string,
) {
  const invite = await client.query(
    "SELECT homebase_id FROM homebase_invite WHERE code = $1",
    [inviteCode],
  );
  if (!invite.rows[0])
    throw new NotFoundException(
      "Invitation code was not found. Check the code and try again.",
    );
  const homebaseId = invite.rows[0].homebase_id as string;
  const before = await loadDatabase(client);
  if (
    before.memberships.some(
      (member) =>
        member.connectionId === homebaseId && member.userId === userId,
    )
  )
    return { entityId: homebaseId, duplicate: true };
  let after = structuredClone(before);
  after.memberships.push({
    id: id("member"),
    connectionId: homebaseId,
    userId,
  });
  const now = new Date().toISOString();
  for (const activity of after.activities.filter(
    (activity) => activity.connectionId === homebaseId,
  )) {
    const root = after.milestones.find(
      (milestone) =>
        milestone.activityId === activity.id && milestone.kind === "join",
    )!;
    after.participations.push({
      id: id("participation"),
      activityId: activity.id,
      userId,
      target: after.activityTemplates.find(
        (template) => template.id === activity.templateId,
      )!.target,
      status: "invited",
    });
    after = execute(
      after,
      {
        type: "recordLog",
        actorId: userId,
        input: {
          authorUserId: userId,
          milestoneId: root.id,
          isSuccess: true,
          title: "Joined activity with home-base membership",
          durationMinutes: 0,
          occurredAt: now,
          origin: "automation",
        },
      },
      now,
    ).db;
  }
  await persistChanges(client, before, after);
  return { entityId: homebaseId, duplicate: false };
}
