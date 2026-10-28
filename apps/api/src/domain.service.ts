import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { execute, id } from "@beside/domain/model";
import { stateForUser } from "@beside/domain/view";
import type { Command } from "@beside/domain/types";
import { DatabaseService } from "./db/database.service.ts";
import { loadDatabase, persistChanges } from "./db/storage.ts";

@Injectable()
export class DomainService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  state(userId: string) {
    return this.database.transaction(false, async (client) =>
      stateForUser(await loadDatabase(client), userId),
    );
  }
  command(command: Command) {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      let result: ReturnType<typeof execute>;
      try {
        result = execute(before, command);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid command.",
        );
      }
      if (!result.duplicate) await persistChanges(client, before, result.db);
      return { entityId: result.entityId, duplicate: result.duplicate };
    });
  }
  homebases(userId: string) {
    return this.database.transaction(false, async (client) => {
      const result = await client.query(
        `SELECT h.id, h.name, h.personal_owner_id AS "personalOwnerId", i.code AS "inviteCode",
          (SELECT json_agg(m.user_id ORDER BY m.row_order) FROM homebase_member m WHERE m.connection_id = h.id) AS "memberIds"
         FROM homebase h LEFT JOIN homebase_invite i ON i.homebase_id = h.id
         WHERE EXISTS (SELECT 1 FROM homebase_member m WHERE m.connection_id = h.id AND m.user_id = $1)
         ORDER BY h.row_order`,
        [userId],
      );
      return result.rows;
    });
  }
  createHomebase(userId: string, name: string) {
    return this.database.transaction(true, async (client) => {
      const homebaseId = id("homebase");
      const inviteCode = randomBytes(24).toString("base64url");
      await client.query(
        "INSERT INTO homebase(id, name, personal_owner_id) VALUES ($1, $2, NULL)",
        [homebaseId, name],
      );
      await client.query(
        "INSERT INTO homebase_member(id, connection_id, user_id) VALUES ($1, $2, $3)",
        [id("member"), homebaseId, userId],
      );
      await client.query(
        "INSERT INTO homebase_invite(homebase_id, code) VALUES ($1, $2)",
        [homebaseId, inviteCode],
      );
      return {
        id: homebaseId,
        name,
        personalOwnerId: null,
        inviteCode,
        memberIds: [userId],
      };
    });
  }
  joinHomebase(userId: string, inviteCode: string) {
    return this.database.transaction(true, async (client) => {
      const invite = await client.query(
        "SELECT homebase_id FROM homebase_invite WHERE code = $1",
        [inviteCode],
      );
      if (!invite.rows[0])
        throw new NotFoundException("Invitation was not found.");
      const homebaseId = invite.rows[0].homebase_id as string;
      const before = await loadDatabase(client);
      if (
        before.memberships.some(
          (m) => m.connectionId === homebaseId && m.userId === userId,
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
      // New members initialize participation without rewriting saved reward rosters.
      for (const activity of after.activities.filter(
        (a) => a.connectionId === homebaseId,
      )) {
        const root = after.milestones.find(
          (m) => m.activityId === activity.id && m.kind === "join",
        )!;
        after.participations.push({
          id: id("participation"),
          activityId: activity.id,
          userId,
          target: after.activityTemplates.find(
            (t) => t.id === activity.templateId,
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
    });
  }
}
