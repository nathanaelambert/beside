import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { RewardAgreement } from "@beside/domain/api";
import type { Database, Reward } from "@beside/domain/types";
import type { PoolClient } from "pg";
import { DatabaseService } from "./db/database.service.ts";

const agreementColumns = `a.reward_id AS "rewardId", a.user_id AS "userId",
  a.item_id AS "itemId", a.agreed_at AS "agreedAt"`;
type AgreementRow = Omit<RewardAgreement, "agreedAt"> & { agreedAt: Date };
const serialize = (row: AgreementRow): RewardAgreement => ({
  ...row,
  agreedAt: row.agreedAt.toISOString(),
});

/**
 * Whoever picks or changes a reward's item proposes it, so they agree to it
 * automatically. Call after persisting a command's changes, in the same transaction.
 */
export async function recordRewardProposals(
  client: PoolClient,
  before: Database,
  after: Database,
  proposerFor: (reward: Reward) => string | undefined,
) {
  const previous = new Map(before.rewards.map((r) => [r.id, r.itemId]));
  for (const reward of after.rewards) {
    if (reward.obtainedAt || previous.get(reward.id) === reward.itemId)
      continue;
    const userId = proposerFor(reward);
    if (!userId || !reward.requiredUserIds.includes(userId)) continue;
    await upsertAgreement(client, reward.id, userId, reward.itemId);
  }
}

async function upsertAgreement(
  client: PoolClient,
  rewardId: string,
  userId: string,
  itemId: string,
) {
  await client.query(
    `INSERT INTO reward_agreement (reward_id, user_id, item_id, agreed_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (reward_id, user_id) DO UPDATE
     SET item_id = EXCLUDED.item_id,
         agreed_at = CASE WHEN reward_agreement.item_id = EXCLUDED.item_id
           THEN reward_agreement.agreed_at ELSE EXCLUDED.agreed_at END`,
    [rewardId, userId, itemId],
  );
}

/**
 * Equal-value rewards have no price. The light check on a choice is that the
 * people a reward waits on can see it and agree that it fits the milestone.
 */
@Injectable()
export class RewardsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  agreements(userId: string, homebaseId: string) {
    return this.database.transaction(false, async (client) => {
      const member = await client.query(
        "SELECT 1 FROM homebase_member WHERE connection_id = $1 AND user_id = $2",
        [homebaseId, userId],
      );
      if (!member.rowCount) throw new NotFoundException("Home base not found.");
      const { rows } = await client.query<AgreementRow>(
        `SELECT ${agreementColumns}
         FROM reward_agreement AS a JOIN reward AS r ON r.id = a.reward_id
         WHERE r.homebase_id = $1 AND a.item_id = r.item_id
         ORDER BY a.agreed_at, a.user_id`,
        [homebaseId],
      );
      return rows.map(serialize);
    });
  }

  /** Agree that the reward's current item fits. Repeating it is harmless. */
  agree(userId: string, rewardId: string) {
    return this.database.transaction(true, async (client) => {
      const { rows } = await client.query<{
        item_id: string;
        obtained_at: Date | null;
        required_user_ids: string[];
      }>(
        `SELECT r.item_id, r.obtained_at, r.required_user_ids
         FROM reward AS r JOIN homebase_member AS m ON m.connection_id = r.homebase_id
         WHERE r.id = $1 AND m.user_id = $2`,
        [rewardId, userId],
      );
      const reward = rows[0];
      if (!reward) throw new NotFoundException("Reward not found.");
      if (!reward.required_user_ids.includes(userId))
        throw new ForbiddenException(
          "Only the people this reward waits on can agree to it.",
        );
      if (reward.obtained_at)
        throw new ConflictException("This reward has already been earned.");
      await upsertAgreement(client, rewardId, userId, reward.item_id);
      return this.forReward(client, rewardId);
    });
  }

  private async forReward(client: PoolClient, rewardId: string) {
    const { rows } = await client.query<AgreementRow>(
      `SELECT ${agreementColumns}
       FROM reward_agreement AS a JOIN reward AS r ON r.id = a.reward_id
       WHERE a.reward_id = $1 AND a.item_id = r.item_id
       ORDER BY a.agreed_at, a.user_id`,
      [rewardId],
    );
    return rows.map(serialize);
  }
}
