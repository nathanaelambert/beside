import {
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { Pool, PoolClient } from "pg";
import { createPool } from "./storage.ts";
import { latestMigration } from "./migrations.ts";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: Pool;
  getPool() {
    const url = process.env.DATABASE_URL;
    if (!url)
      throw new ServiceUnavailableException(
        "Database is not configured. Set DATABASE_URL and run db:migrate.",
      );
    return (this.pool ??= createPool(url));
  }
  async transaction<T>(
    write: boolean,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query(
        write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      // A deliberately simple first-pass write boundary. Serializes commands
      // across Vercel instances, including final cooperative reward completion.
      if (write) await client.query("SELECT pg_advisory_xact_lock(724390821)");
      const value = await action(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  async ready() {
    const result = await this.getPool().query(
      "SELECT EXISTS (SELECT 1 FROM beside_migration WHERE name = $1) AS ready",
      [latestMigration],
    );
    if (!result.rows[0]?.ready)
      throw new ServiceUnavailableException("Database migration is pending.");
    return { status: "ok", database: "connected" };
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
}
