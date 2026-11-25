import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AvatarAppearance } from "@beside/domain/avatar";
import type { CottageBuildSeconds } from "@beside/domain/cottage";
import { execute } from "@beside/domain/model";
import { settleExpiredMilestones } from "@beside/domain/expiry";
import { stateForUser } from "@beside/domain/view";
import type { Command } from "@beside/domain/types";
import { COTTAGE_BUILD_DURATIONS } from "./cottage-build.config.ts";
import { DatabaseService } from "./db/database.service.ts";
import { loadDatabase, persistChanges } from "./db/storage.ts";
import { createHomebase, joinHomebase } from "./homebases.ts";
import { recordRewardProposals } from "./rewards.service.ts";

@Injectable()
export class DomainService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(COTTAGE_BUILD_DURATIONS)
    readonly cottageBuildDurations: Readonly<CottageBuildSeconds>,
  ) {}
  state(userId: string, guest = false) {
    // Hobby cron runs daily. Settle on account reads too so a workspace reflects
    // expired windows between runs. Guest exploration always stays read-only.
    return this.database.transaction(!guest, async (client) => {
      let visible = await loadDatabase(client);
      const serverTime = new Date().toISOString();
      if (!guest) {
        const settled = settleExpiredMilestones(visible, serverTime);
        if (settled.failuresRecorded)
          await persistChanges(client, visible, settled.db);
        visible = settled.db;
      }
      const guests = visible.users.filter((user) => user.email === null);
      if (guests.length) {
        const active = await client.query<{ user_id: string }>(
          `SELECT DISTINCT s.user_id FROM auth_session s
           JOIN app_user u ON u.id = s.user_id
           WHERE u.email IS NULL AND s.expires_at > now()`,
        );
        const activeGuestIds = new Set(active.rows.map((row) => row.user_id));
        const inactiveGuestIds = new Set(
          guests
            .filter((visitor) => !activeGuestIds.has(visitor.id))
            .map((visitor) => visitor.id),
        );
        // Session expiry hides guest avatars without rewriting saved memberships/art.
        visible = {
          ...visible,
          memberships: visible.memberships.filter(
            (member) => !inactiveGuestIds.has(member.userId),
          ),
        };
      }
      return { ...stateForUser(visible, userId), serverTime };
    });
  }
  command(command: Command) {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      let result: ReturnType<typeof execute>;
      try {
        result = execute(
          before,
          command,
          undefined,
          this.cottageBuildDurations,
        );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid command.",
        );
      }
      if (!result.duplicate) {
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
          (SELECT json_agg(m.user_id ORDER BY m.row_order)
           FROM homebase_member m JOIN app_user u ON u.id = m.user_id
           WHERE m.connection_id = h.id AND (
             u.email IS NOT NULL OR EXISTS (
               SELECT 1 FROM auth_session s WHERE s.user_id = u.id AND s.expires_at > now()
             )
           )) AS "memberIds"
         FROM homebase h JOIN app_user viewer ON viewer.id = $1
         LEFT JOIN homebase_invite i ON i.homebase_id = h.id AND viewer.email IS NOT NULL
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
  saveAvatar(userId: string, homebaseId: string, appearance: AvatarAppearance) {
    return this.database.transaction(true, async (client) => {
      const { rows } = await client.query<{ avatar_appearance: AvatarAppearance }>(
        `UPDATE homebase_member SET avatar_appearance = $3
          WHERE connection_id = $1 AND user_id = $2
          RETURNING avatar_appearance`,
        [homebaseId, userId, appearance],
      );
      if (!rows.length) throw new NotFoundException("Home base not found.");
      return rows[0]!.avatar_appearance;
    });
  }
  joinHomebase(userId: string, inviteCode: string) {
    return this.database.transaction(true, (client) =>
      joinHomebase(client, userId, inviteCode),
    );
  }
}
