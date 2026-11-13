import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  HomebaseGarden,
  PlaceRewardInput,
  PlantStarterOakInput,
  RewardPlacement,
} from "@beside/domain/api";
import {
  checkMeadowPlacement,
  starterOakItemId,
  type MeadowPoint,
  type PlacementRejection,
} from "@beside/domain/garden";
import type { PoolClient } from "pg";
import { DatabaseService } from "./db/database.service.ts";

function rejectPlacement(rejection: PlacementRejection | null) {
  if (rejection)
    throw new BadRequestException(
      rejection === "occupied"
        ? "That spot is occupied."
        : "Choose a clear patch of lawn.",
    );
}

/** Everything saved in a home base's meadow: the starter oak and earned rewards. */
@Injectable()
export class GardenService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  get(userId: string, homebaseId: string) {
    return this.database.transaction(false, (client) =>
      this.read(client, userId, homebaseId),
    );
  }

  plant(userId: string, homebaseId: string, position: PlantStarterOakInput) {
    const { x, y } = position;
    return this.database.transaction(true, async (client) => {
      const garden = await this.read(client, userId, homebaseId);
      if (garden.oak?.x === x && garden.oak.y === y) return garden;
      if (garden.oak)
        throw new ConflictException(
          "This home base already has its starter oak.",
        );
      rejectPlacement(checkMeadowPlacement(position, garden.rewards));
      await client.query(
        "INSERT INTO homebase_starter_oak (homebase_id, x, y) VALUES ($1, $2, $3)",
        [homebaseId, x, y],
      );
      return {
        ...garden,
        oak: { x, y, itemId: starterOakItemId },
      } satisfies HomebaseGarden;
    });
  }

  /**
   * Place an earned reward, or move one that already stands in the meadow.
   * Retrying the same position is a no-op, so a lost response can be replayed.
   */
  placeReward(
    userId: string,
    homebaseId: string,
    rewardId: string,
    position: PlaceRewardInput,
  ) {
    const { x, y } = position;
    return this.database.transaction(true, async (client) => {
      const garden = await this.read(client, userId, homebaseId);
      const { rows } = await client.query<{ obtained_at: Date | null }>(
        "SELECT obtained_at FROM reward WHERE id = $1 AND homebase_id = $2",
        [rewardId, homebaseId],
      );
      if (!rows.length) throw new NotFoundException("Reward not found.");
      if (!rows[0]!.obtained_at)
        throw new ConflictException(
          "This reward lands once everyone completes its milestone.",
        );
      const current = garden.rewards.find((row) => row.rewardId === rewardId);
      if (current?.x === x && current.y === y) return garden;
      const others: MeadowPoint[] = [
        ...(garden.oak ? [garden.oak] : []),
        ...garden.rewards.filter((row) => row.rewardId !== rewardId),
      ];
      rejectPlacement(checkMeadowPlacement(position, others));
      await client.query(
        `INSERT INTO reward_placement (reward_id, x, y, placed_by, placed_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (reward_id) DO UPDATE
         SET x = EXCLUDED.x, y = EXCLUDED.y, placed_by = EXCLUDED.placed_by, placed_at = EXCLUDED.placed_at`,
        [rewardId, x, y, userId],
      );
      return this.read(client, userId, homebaseId);
    });
  }

  private async read(
    client: PoolClient,
    userId: string,
    homebaseId: string,
  ): Promise<HomebaseGarden> {
    const { rows } = await client.query<{ x: number | null; y: number | null }>(
      `SELECT oak.x, oak.y
       FROM homebase_member AS member
       LEFT JOIN homebase_starter_oak AS oak ON oak.homebase_id = member.connection_id
       WHERE member.connection_id = $1 AND member.user_id = $2`,
      [homebaseId, userId],
    );
    if (!rows.length) throw new NotFoundException("Home base not found.");
    const { x, y } = rows[0]!;
    const placed = await client.query<{
      rewardId: string;
      itemId: string;
      x: number;
      y: number;
      placedByUserId: string | null;
      placedAt: Date;
    }>(
      `SELECT p.reward_id AS "rewardId", r.item_id AS "itemId", p.x, p.y,
         p.placed_by AS "placedByUserId", p.placed_at AS "placedAt"
       FROM reward_placement AS p JOIN reward AS r ON r.id = p.reward_id
       WHERE r.homebase_id = $1 AND r.obtained_at IS NOT NULL
       ORDER BY p.placed_at, p.reward_id`,
      [homebaseId],
    );
    return {
      oak: x === null || y === null ? null : { x, y, itemId: starterOakItemId },
      rewards: placed.rows.map((row): RewardPlacement => ({
        ...row,
        placedAt: row.placedAt.toISOString(),
      })),
    };
  }
}
