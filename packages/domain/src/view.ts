import type { Database } from "./types.ts";
import type { ApiState } from "./api.ts";
import { visibleActivities, visibleLogs, visibleSubjects } from "./model.ts";

// API reads use this same boundary for every collection. Never return the
// database-wide command snapshot to a client.
export function stateForUser(db: Database, userId: string): ApiState {
  const bases = new Set(
    db.memberships
      .filter((m) => m.userId === userId)
      .map((m) => m.connectionId),
  );
  const activities = visibleActivities(db, userId);
  const activityIds = new Set(activities.map((a) => a.id));
  const logs = visibleLogs(db, userId);
  const logIds = new Set(logs.map((log) => log.id));
  const subjects = visibleSubjects(db, userId);
  const subjectIds = new Set(subjects.map((s) => s.id));
  const participations = db.participations.filter((p) =>
    activityIds.has(p.activityId),
  );
  const participationIds = new Set(participations.map((p) => p.id));
  const memberships = db.memberships.filter((m) => bases.has(m.connectionId));
  const deliveries = db.deliveries.filter((d) => d.recipientUserId === userId);
  const eventIds = new Set(deliveries.map((d) => d.eventId));
  const events = db.events.filter((event) => eventIds.has(event.id));
  const rewards = db.rewards.filter((reward) => bases.has(reward.homebaseId));
  const users = new Set([
    userId,
    ...memberships.map((m) => m.userId),
    ...activities.map((a) => a.creatorUserId),
    ...subjects.map((s) => s.ownerUserId),
    ...logs.map((log) => log.authorUserId),
    ...events.map((event) => event.actorUserId),
    ...rewards.flatMap((reward) => reward.requiredUserIds),
  ]);
  return {
    version: 3,
    users: db.users
      .filter((user) => users.has(user.id))
      .map(({ email: _email, ...user }) => user),
    connections: db.connections.filter((base) => bases.has(base.id)),
    memberships,
    subjects,
    activities,
    participations,
    logs,
    events,
    deliveries,
    rewards,
    subjectTemplates: db.subjectTemplates,
    activityTemplates: db.activityTemplates,
    rewardItems: db.rewardItems,
    activitySubjects: db.activitySubjects.filter(
      (link) =>
        activityIds.has(link.activityId) && subjectIds.has(link.subjectId),
    ),
    milestones: db.milestones.filter((milestone) =>
      activityIds.has(milestone.activityId),
    ),
    logShares: db.logShares.filter(
      (share) => logIds.has(share.logId) && bases.has(share.connectionId),
    ),
    contributions: db.contributions.filter(
      (credit) =>
        logIds.has(credit.logId) &&
        participationIds.has(credit.participationId),
    ),
  };
}
