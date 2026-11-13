import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { execute } from "@beside/domain/model";
import { settleExpiredMilestones } from "@beside/domain/expiry";
import { stateForUser } from "@beside/domain/view";
import { homebaseRewards } from "@beside/domain/precursors";
import type { Command } from "@beside/domain/types";
import { DatabaseService } from "./db/database.service.ts";
import { loadDatabase, persistChanges } from "./db/storage.ts";
import { createHomebase, joinHomebase } from "./homebases.ts";

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
  // Read-only: closed, unearned rewards stop counting without being settled.
  rewards(userId: string, homebaseId: string) {
    return this.database.transaction(false, async (client) => {
      const db = await loadDatabase(client);
      if (
        !db.memberships.some(
          (m) => m.connectionId === homebaseId && m.userId === userId,
        )
      )
        throw new NotFoundException("Home base not found.");
      return homebaseRewards(db, homebaseId, new Date().toISOString());
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
