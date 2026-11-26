import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { execute } from "@beside/domain/model";
import { settleExpiredMilestones } from "@beside/domain/expiry";
import { stateForUser } from "@beside/domain/view";
import type { Command } from "@beside/domain/types";
import { DatabaseService } from "./db/database.service.ts";
import { loadDatabase, persistChanges } from "./db/storage.ts";
import { createHomebase, joinHomebase } from "./homebases.ts";
import { recordRewardProposals } from "./rewards.service.ts";
import { rewardBuildReadyAt } from "./reward-construction.ts";

@Injectable()
export class DomainService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  state(userId: string) {
    // Hobby cron runs daily. Settle on reads too so an opened workspace reflects
    // expired windows immediately, even between scheduled invocations.
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      const serverTime = new Date().toISOString();
      const settled = settleExpiredMilestones(before, serverTime);
      if (settled.failuresRecorded)
        await persistChanges(client, before, settled.db);
      return { ...stateForUser(settled.db, userId), serverTime };
    });
  }
  command(command: Command) {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      const now = new Date().toISOString();
      let result: ReturnType<typeof execute>;
      try {
        result = execute(before, command, now);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid command.",
        );
      }
      if (!result.duplicate) {
        if (command.type === "recordLog") {
          const milestone = result.db.milestones.find(
            (row) => row.id === command.input.milestoneId,
          );
          const previous = before.milestones.find(
            (row) => row.id === command.input.milestoneId,
          );
          if (milestone?.upgradeCreditedAt && !previous?.upgradeCreditedAt) {
            const reward = result.db.rewards.find(
              (row) => row.id === milestone.upgradeRewardId,
            )!;
            reward.buildReadyAt = rewardBuildReadyAt(now);
          }
        }
        await persistChanges(client, before, result.db);
        await recordRewardProposals(
          client,
          before,
          result.db,
          () => command.actorId,
        );
      }
      return { entityId: result.entityId, duplicate: result.duplicate };
    });
  }
  homebases(userId: string) {
    return this.database.transaction(false, async (client) => {
      const result = await client.query(
        `SELECT h.id, h.name, i.code AS "inviteCode",
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
    return this.database.transaction(true, (client) =>
      createHomebase(client, userId, name),
    );
  }
  joinHomebase(userId: string, inviteCode: string) {
    return this.database.transaction(true, (client) =>
      joinHomebase(client, userId, inviteCode),
    );
  }
}
