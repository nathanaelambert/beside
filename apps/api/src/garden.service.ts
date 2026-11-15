import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { HomebaseGarden, PlantStarterOakInput } from "@beside/domain/api";
import { checkGardenPlacement, starterOakItemId } from "@beside/domain/garden";
import type { PoolClient } from "pg";
import { DatabaseService } from "./db/database.service.ts";

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
      // The starter oak keeps clear of everything already in the garden.
      const { rows: others } = await client.query<{ x: number; y: number }>(
        "SELECT x, y FROM garden_object WHERE homebase_id = $1 AND x IS NOT NULL",
        [homebaseId],
      );
      const rejection = checkGardenPlacement(position, others);
      if (rejection)
        throw new BadRequestException(
          rejection === "occupied"
            ? "That spot is occupied."
            : "Choose a clear patch of lawn.",
        );
      // The starter oak is the base's first garden object (migration 007), so a
      // Christmas tree can decorate it and members can move it.
      await client.query(
        `INSERT INTO garden_object (id, homebase_id, item_id, origin, x, y, created_at, updated_at)
         VALUES ($1, $2, $3, 'starter', $4, $5, now(), now())`,
        [`garden_starter_${homebaseId}`, homebaseId, starterOakItemId, x, y],
      );
      return {
        oak: { x, y, itemId: starterOakItemId },
      } satisfies HomebaseGarden;
    });
  }

  private async read(
    client: PoolClient,
    userId: string,
    homebaseId: string,
  ): Promise<HomebaseGarden> {
    const { rows } = await client.query<{
      x: number | null;
      y: number | null;
      itemId: string | null;
    }>(
      `SELECT oak.x, oak.y, oak.item_id AS "itemId"
       FROM homebase_member AS member
       LEFT JOIN garden_object AS oak
         ON oak.homebase_id = member.connection_id AND oak.origin = 'starter'
       WHERE member.connection_id = $1 AND member.user_id = $2`,
      [homebaseId, userId],
    );
    if (!rows.length) throw new NotFoundException("Home base not found.");
    const { x, y, itemId } = rows[0]!;
    // Its current stage: an oak, or the Christmas tree it became.
    return {
      oak: x === null || y === null || !itemId ? null : { x, y, itemId },
    };
  }
}
