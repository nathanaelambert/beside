import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { canSeeActivity, execute, id } from "@beside/domain/model";
import { settleExpiredMilestones } from "@beside/domain/expiry";
import {
  addDays,
  createScheduleSchema,
  localDateAt,
  occurrenceWindow,
  occursOn,
  type MilestoneSchedule,
  type ScheduleInput,
} from "@beside/domain/schedules";
import type { Database } from "@beside/domain/types";
import type { PoolClient } from "pg";
import { DatabaseService } from "./db/database.service.ts";
import { loadDatabase, persistChanges } from "./db/storage.ts";

const scheduleColumns = `id, activity_id AS "activityId", creator_user_id AS "creatorUserId",
  configuration, next_date AS "nextDate", generated_count AS "generatedCount", enabled,
  created_at AS "createdAt"`;
const serialize = (
  row: Omit<MilestoneSchedule, "createdAt"> & { createdAt: Date | string },
): MilestoneSchedule => ({
  ...row,
  createdAt: new Date(row.createdAt).toISOString(),
});

@Injectable()
export class SchedulingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  private requireActivity(db: Database, userId: string, activityId: string) {
    const activity = db.activities.find((a) => a.id === activityId);
    if (!activity || !canSeeActivity(db, userId, activity))
      throw new NotFoundException("Activity not found.");
    return activity;
  }

  list(userId: string, activityId: string) {
    return this.database.transaction(false, async (client) => {
      this.requireActivity(await loadDatabase(client), userId, activityId);
      const result = await client.query(
        `SELECT ${scheduleColumns} FROM milestone_schedule WHERE activity_id = $1 ORDER BY created_at, id`,
        [activityId],
      );
      return result.rows.map(serialize);
    });
  }

  create(userId: string, activityId: string, configuration: ScheduleInput) {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      this.requireActivity(before, userId, activityId);
      if (
        !before.participations.some(
          (p) =>
            p.activityId === activityId &&
            p.userId === userId &&
            p.status === "active",
        )
      )
        throw new BadRequestException(
          "Join the activity before planning milestones.",
        );
      const now = new Date().toISOString();
      if (configuration.startDate < localDateAt(now, configuration.timeZone))
        throw new BadRequestException(
          "Recurring schedules must start today or later.",
        );
      if (
        configuration.itemId &&
        !before.rewardItems.some((item) => item.id === configuration.itemId)
      )
        throw new BadRequestException("Reward item is missing.");
      const schedule: MilestoneSchedule = {
        id: id("schedule"),
        activityId,
        creatorUserId: userId,
        configuration,
        nextDate: configuration.startDate,
        generatedCount: 0,
        enabled: true,
        createdAt: now,
      };
      await client.query(
        `INSERT INTO milestone_schedule (id, activity_id, creator_user_id, configuration, next_date, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          schedule.id,
          activityId,
          userId,
          JSON.stringify(configuration),
          schedule.nextDate,
          now,
        ],
      );
      const generated = await this.generate(client, before, schedule, now);
      await persistChanges(client, before, generated.db);
      await this.saveOccurrences(client, generated.occurrences);
      return schedule;
    });
  }

  remove(userId: string, scheduleId: string) {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      const result = await client.query(
        `SELECT ${scheduleColumns} FROM milestone_schedule WHERE id = $1`,
        [scheduleId],
      );
      const schedule = result.rows[0] as MilestoneSchedule | undefined;
      if (!schedule) throw new NotFoundException("Schedule not found.");
      this.requireActivity(before, userId, schedule.activityId);
      const now = new Date().toISOString();
      const occurrences = await client.query(
        "SELECT milestone_id FROM milestone_occurrence WHERE schedule_id = $1",
        [scheduleId],
      );
      let db = before;
      for (const row of occurrences.rows) {
        const milestone = db.milestones.find((m) => m.id === row.milestone_id);
        if (
          !milestone?.startAt ||
          milestone.startAt <= now ||
          db.logs.some((l) => l.milestoneId === milestone.id)
        )
          continue;
        db = execute(
          db,
          {
            type: "deleteMilestone",
            actorId: userId,
            milestoneId: milestone.id,
          },
          now,
        ).db;
      }
      await persistChanges(client, before, db);
      await client.query("DELETE FROM milestone_schedule WHERE id = $1", [
        scheduleId,
      ]);
      return { entityId: scheduleId, duplicate: false };
    });
  }

  private async saveOccurrences(
    client: PoolClient,
    occurrences: { scheduleId: string; date: string; milestoneId: string }[],
  ) {
    for (const o of occurrences)
      await client.query(
        "INSERT INTO milestone_occurrence(schedule_id, local_date, milestone_id) VALUES ($1, $2, $3)",
        [o.scheduleId, o.date, o.milestoneId],
      );
  }

  private async generate(
    client: PoolClient,
    before: Database,
    schedule: MilestoneSchedule,
    now: string,
  ) {
    let db = before;
    const occurrences: {
      scheduleId: string;
      date: string;
      milestoneId: string;
    }[] = [];
    const s = createScheduleSchema.parse(schedule.configuration);
    const horizon = addDays(localDateAt(now, s.timeZone), 35);
    // Bound catch-up work per invocation. The persisted cursor resumes after
    // outages rather than silently dropping missed occurrences.
    let scanned = 0;
    while (
      schedule.enabled &&
      schedule.nextDate <= horizon &&
      scanned++ < 366
    ) {
      const date = schedule.nextDate;
      if (
        (s.until && date > s.until) ||
        (s.count && schedule.generatedCount >= s.count)
      ) {
        schedule.enabled = false;
        break;
      }
      if (occursOn(s, date)) {
        const window = occurrenceWindow(s, date);
        if (window) {
          const active = db.participations.filter(
            (p) =>
              p.activityId === schedule.activityId && p.status === "active",
          );
          const actor =
            active.find((p) => p.userId === schedule.creatorUserId) ??
            active[0];
          if (!actor) break; // Resume if participation becomes active again.
          const result = execute(
            db,
            {
              type: "createMilestone",
              actorId: actor.userId,
              activityId: schedule.activityId,
              parentId: null,
              name: s.name,
              quantity: s.quantity,
              itemId: s.itemId,
              policy: "paced",
              ...window,
            },
            now,
          );
          for (const event of result.db.events.slice(db.events.length))
            event.origin = "automation";
          db = result.db;
          occurrences.push({
            scheduleId: schedule.id,
            date,
            milestoneId: result.entityId,
          });
          schedule.generatedCount++;
        }
      }
      schedule.nextDate = addDays(date, 1);
    }
    if (s.count && schedule.generatedCount >= s.count) schedule.enabled = false;
    await client.query(
      "UPDATE milestone_schedule SET next_date = $2, generated_count = $3, enabled = $4 WHERE id = $1",
      [
        schedule.id,
        schedule.nextDate,
        schedule.generatedCount,
        schedule.enabled,
      ],
    );
    return { db, occurrences };
  }

  run() {
    return this.database.transaction(true, async (client) => {
      const before = await loadDatabase(client);
      const now = new Date().toISOString(); // Captured after acquiring the write lock.
      let db = before;
      const schedules = await client.query(
        `SELECT ${scheduleColumns} FROM milestone_schedule WHERE enabled ORDER BY created_at, id`,
      );
      const occurrences: {
        scheduleId: string;
        date: string;
        milestoneId: string;
      }[] = [];
      for (const row of schedules.rows) {
        const generated = await this.generate(client, db, serialize(row), now);
        db = generated.db;
        occurrences.push(...generated.occurrences);
      }
      const settled = settleExpiredMilestones(db, now);
      await persistChanges(client, before, settled.db);
      await this.saveOccurrences(client, occurrences);
      return {
        processedAt: now,
        milestonesCreated: occurrences.length,
        failuresRecorded: settled.failuresRecorded,
      };
    });
  }
}
