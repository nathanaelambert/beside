import { execute } from "./model.ts";
import type { Database } from "./types.ts";

// Run under the same database write lock as submissions. A submitted failure is
// already an outcome; automatic settlement only fills genuinely missing ones.
export function settleExpiredMilestones(database: Database, now: string) {
  let db = database;
  let failuresRecorded = 0;
  for (const milestone of database.milestones) {
    if (
      milestone.kind !== "achievement" ||
      milestone.policy === "open" ||
      !milestone.endAt ||
      Date.parse(milestone.endAt) >= Date.parse(now)
    )
      continue;
    const deadline = milestone.endAt;
    const root = database.milestones.find(
      (m) => m.activityId === milestone.activityId && m.kind === "join",
    )!;
    for (const person of database.participations) {
      if (
        person.activityId !== milestone.activityId ||
        person.status !== "active"
      )
        continue;
      // People who joined after this occurrence closed did not miss it.
      if (
        !database.logs.some(
          (l) =>
            l.milestoneId === root.id &&
            l.authorUserId === person.userId &&
            l.isSuccess &&
            Date.parse(l.createdAt) <= Date.parse(deadline),
        )
      )
        continue;
      if (
        db.logs.some(
          (l) =>
            l.milestoneId === milestone.id && l.authorUserId === person.userId,
        )
      )
        continue;
      db = execute(
        db,
        {
          type: "recordLog",
          actorId: person.userId,
          input: {
            authorUserId: person.userId,
            milestoneId: milestone.id,
            isSuccess: false,
            title: `Missed deadline: ${milestone.name}`,
            durationMinutes: 0,
            occurredAt: milestone.endAt,
            origin: "automation",
            // The locked missing-outcome check provides idempotency without
            // colliding with caller-controlled log retry keys.
            externalKey: null,
          },
        },
        now,
      ).db;
      failuresRecorded++;
    }
  }
  return { db, failuresRecorded };
}
