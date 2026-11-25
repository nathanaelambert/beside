import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isHomeExpansionTile,
  type HomebaseExpansion,
  type HomeCoastTile,
} from "@beside/domain/homebase-expansion";
import type { PoolClient } from "pg";
import { DatabaseService } from "./db/database.service.ts";

@Injectable()
export class HomebaseExpansionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  get(userId: string, homebaseId: string) {
    return this.database.transaction(false, async (client) => {
      await this.requireMember(client, userId, homebaseId);
      return this.read(client, homebaseId);
    });
  }

  add(userId: string, homebaseId: string, tile: HomeCoastTile) {
    return this.database.transaction(true, async (client) => {
      await this.requireMember(client, userId, homebaseId);
      if (!isHomeExpansionTile(tile))
        throw new BadRequestException("Choose a marked coastal tile.");
      // A repeated or concurrent confirmation of the same tile adds nothing.
      await client.query(
        `INSERT INTO homebase_expansion_tile (homebase_id, tile_col, tile_row)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [homebaseId, tile.col, tile.row],
      );
      return this.read(client, homebaseId);
    });
  }

  private async requireMember(
    client: PoolClient,
    userId: string,
    homebaseId: string,
  ) {
    const membership = await client.query(
      "SELECT 1 FROM homebase_member WHERE connection_id = $1 AND user_id = $2",
      [homebaseId, userId],
    );
    if (!membership.rows.length)
      throw new NotFoundException("Home base not found.");
  }

  private async read(
    client: PoolClient,
    homebaseId: string,
  ): Promise<HomebaseExpansion> {
    const { rows } = await client.query<HomeCoastTile>(
      `SELECT tile_col AS col, tile_row AS row
       FROM homebase_expansion_tile WHERE homebase_id = $1 ORDER BY tile_row, tile_col`,
      [homebaseId],
    );
    return { additions: rows };
  }
}
