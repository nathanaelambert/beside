import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { HomebaseGarden, PlantStarterOakInput } from "@beside/domain/api";
import {
  checkStarterOakPlacement,
  starterOakItemId,
} from "@beside/domain/garden";
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
      const rejection = checkStarterOakPlacement(position);
      if (rejection)
        throw new BadRequestException(
          rejection === "occupied"
            ? "That spot is occupied."
            : "Choose a clear patch of lawn.",
        );
      await client.query(
        "INSERT INTO homebase_starter_oak (homebase_id, x, y) VALUES ($1, $2, $3)",
        [homebaseId, x, y],
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
    const { rows } = await client.query<{ x: number | null; y: number | null }>(
      `SELECT oak.x, oak.y
       FROM homebase_member AS member
       LEFT JOIN homebase_starter_oak AS oak ON oak.homebase_id = member.connection_id
       WHERE member.connection_id = $1 AND member.user_id = $2`,
      [homebaseId, userId],
    );
    if (!rows.length) throw new NotFoundException("Home base not found.");
    const { x, y } = rows[0]!;
    return {
      oak: x === null || y === null ? null : { x, y, itemId: starterOakItemId },
    };
  }
}
