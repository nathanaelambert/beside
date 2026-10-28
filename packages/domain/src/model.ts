import type {
  Activity,
  Command,
  Database,
  DomainEvent,
  Log,
  LogInput,
  Milestone,
  Origin,
  Participation,
} from "./types.ts";
import { updateActivitySchema, updateMilestoneSchema } from "./api.ts";
import { logInputSchema, milestoneInputSchema } from "./validation.ts";

export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const requireValue = <T>(value: T | undefined | null, message: string): T => {
  if (value == null) throw new Error(message);
  return value;
};
const positive = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be greater than zero.`);
};
const nonempty = (value: string, label: string, max = 500) => {
  if (!value.trim() || value.length > max)
    throw new Error(`${label} must contain between 1 and ${max} characters.`);
};
export const members = (db: Database, connectionId: string) =>
  db.memberships
    .filter((m) => m.connectionId === connectionId)
    .map((m) => m.userId);
export const visibleActivities = (db: Database, userId: string) =>
  db.activities.filter((a) => members(db, a.connectionId).includes(userId));
export const canSeeActivity = (
  db: Database,
  userId: string,
  activity: Activity,
) => visibleActivities(db, userId).some((a) => a.id === activity.id);
export const visibleLogs = (db: Database, userId: string) =>
  db.logs.filter(
    (l) =>
      l.authorUserId === userId ||
      db.logShares.some(
        (s) => s.logId === l.id && members(db, s.connectionId).includes(userId),
      ),
  );
export const visibleSubjects = (db: Database, userId: string) =>
  db.subjects.filter(
    (s) =>
      s.ownerUserId === userId ||
      db.activitySubjects.some(
        (link) =>
          link.subjectId === s.id &&
          visibleActivities(db, userId).some((a) => a.id === link.activityId),
      ) ||
      visibleLogs(db, userId).some((l) => l.subjectId === s.id),
  );
export const participation = (
  db: Database,
  activityId: string,
  userId: string,
) =>
  db.participations.find(
    (p) => p.activityId === activityId && p.userId === userId,
  );
export function progress(db: Database, p: Participation) {
  const activity = requireValue(
    db.activities.find((a) => a.id === p.activityId),
    "Activity is missing.",
  );
  const amounts = db.contributions
    .filter((c) => c.participationId === p.id)
    .map((c) => c.amount);
  const value =
    activity.progressMode === "position"
      ? Math.max(0, ...amounts)
      : amounts.reduce((a, b) => a + b, 0);
  return {
    value,
    target: p.target,
    percent: Math.min(100, (value / p.target) * 100),
    met: value >= p.target,
  };
}
function emit(
  db: Database,
  actorUserId: string,
  type: string,
  entityType: DomainEvent["entityType"],
  entityId: string,
  message: string,
  recipients: string[],
  connectionId: string | null,
  kind: Database["deliveries"][number]["kind"],
  origin: Origin = "manual",
) {
  const event: DomainEvent = {
    id: id("evt"),
    actorUserId,
    type,
    entityType,
    entityId,
    message,
    origin,
    createdAt: new Date().toISOString(),
  };
  db.events.push(event);
  for (const recipientUserId of new Set(recipients))
    db.deliveries.push({
      id: id("delivery"),
      eventId: event.id,
      recipientUserId,
      connectionId,
      kind,
    });
}
function shareLog(
  db: Database,
  actorId: string,
  log: Log,
  connectionIds: string[],
) {
  if (log.authorUserId !== actorId)
    throw new Error("Only the log's author can change its distribution.");
  for (const connectionId of new Set(connectionIds)) {
    if (!members(db, connectionId).includes(actorId))
      throw new Error("You can only share with your own home bases.");
    if (
      db.logShares.some(
        (s) => s.logId === log.id && s.connectionId === connectionId,
      )
    )
      continue;
    db.logShares.push({
      id: id("share"),
      logId: log.id,
      connectionId,
      sharedByUserId: actorId,
    });
    emit(
      db,
      actorId,
      "log.shared",
      "log",
      log.id,
      `“${log.title}” shared with ${db.connections.find((c) => c.id === connectionId)?.name}.`,
      members(db, connectionId),
      connectionId,
      "update",
      log.origin,
    );
  }
}
export const homebaseForActivity = (db: Database, activity: Activity) =>
  db.connections.find((base) => base.id === activity.connectionId);
export const completedMilestone = (
  db: Database,
  milestoneId: string,
  userId: string,
) =>
  db.logs.some(
    (l) =>
      l.milestoneId === milestoneId && l.authorUserId === userId && l.isSuccess,
  );
export function scheduleStatus(
  milestone: Milestone,
  now: string,
): string | null {
  if (
    milestone.policy === "paced" &&
    milestone.startAt &&
    Date.parse(now) < Date.parse(milestone.startAt)
  )
    return "This milestone has not started yet.";
  if (
    milestone.policy !== "open" &&
    milestone.endAt &&
    Date.parse(now) > Date.parse(milestone.endAt)
  )
    return "This milestone's logging window has closed.";
  return null;
}
export function logRejection(
  db: Database,
  userId: string,
  milestone: Milestone,
  isSuccess: boolean,
  now: string,
): string | null {
  const activity = db.activities.find((a) => a.id === milestone.activityId);
  if (!activity || !canSeeActivity(db, userId, activity))
    return "Milestone is not accessible.";
  const person = participation(db, activity.id, userId);
  if (!person) return "Participation is missing.";
  if (milestone.kind === "join") {
    if (isSuccess && completedMilestone(db, milestone.id, userId))
      return "You have already joined this activity once.";
    if (!isSuccess && person.status === "left")
      return "You have already declined or left this activity.";
    return null;
  }
  if (person.status !== "active")
    return "Join the activity through milestone zero before logging achievements.";
  if (completedMilestone(db, milestone.id, userId))
    return "You have already completed this milestone.";
  return scheduleStatus(milestone, now);
}
function awardReward(
  db: Database,
  milestone: Milestone,
  actorId: string,
  now: string,
  origin: Origin,
) {
  const reward = db.rewards.find((r) => r.id === milestone.rewardId);
  if (
    !reward ||
    reward.obtainedAt ||
    !reward.requiredUserIds.every((userId) =>
      completedMilestone(db, milestone.id, userId),
    )
  )
    return;
  reward.obtainedAt = now;
  emit(
    db,
    actorId,
    "reward.obtained",
    "reward",
    reward.id,
    `${db.rewardItems.find((i) => i.id === reward.itemId)?.name} earned once for ${db.connections.find((b) => b.id === reward.homebaseId)?.name}.`,
    members(db, reward.homebaseId),
    reward.homebaseId,
    "progress",
    origin,
  );
}
// All management actions use the same home-base membership boundary.
function managedActivity(db: Database, actorId: string, activityId: string) {
  const activity = requireValue(
    db.activities.find((row) => row.id === activityId),
    "Activity is missing.",
  );
  if (!canSeeActivity(db, actorId, activity))
    throw new Error("Activity is not accessible.");
  return activity;
}
export function milestoneSubtree(
  db: Pick<Database, "milestones">,
  milestoneId: string,
): Set<string> {
  const ids = new Set([milestoneId]);
  for (let previous = 0; previous !== ids.size;) {
    previous = ids.size;
    for (const milestone of db.milestones)
      if (ids.has(milestone.parentId)) ids.add(milestone.id);
  }
  return ids;
}
function removeGraph(
  db: Database,
  milestoneIds: Set<string>,
  activityIds = new Set<string>(),
  homebaseIds = new Set<string>(),
) {
  const logIds = new Set(
    db.logs
      .filter((log) => log.milestoneId && milestoneIds.has(log.milestoneId))
      .map((log) => log.id),
  );
  const people = new Set(
    db.participations
      .filter((person) => activityIds.has(person.activityId))
      .map((person) => person.id),
  );
  const rewardIds = new Set(
    db.milestones
      .filter(
        (milestone) => milestoneIds.has(milestone.id) && milestone.rewardId,
      )
      .map((milestone) => milestone.rewardId!),
  );
  const removed = {
    log: logIds,
    milestone: milestoneIds,
    activity: activityIds,
    reward: rewardIds,
    homebase: homebaseIds,
    subject: new Set<string>(),
    user: new Set<string>(),
  };
  const eventIds = new Set(
    db.events
      .filter((event) => removed[event.entityType].has(event.entityId))
      .map((event) => event.id),
  );
  db.deliveries = db.deliveries.filter(
    (delivery) =>
      !eventIds.has(delivery.eventId) &&
      !homebaseIds.has(delivery.connectionId ?? ""),
  );
  db.events = db.events.filter((event) => !eventIds.has(event.id));
  db.contributions = db.contributions.filter(
    (credit) =>
      !logIds.has(credit.logId) && !people.has(credit.participationId),
  );
  db.logShares = db.logShares.filter(
    (share) => !logIds.has(share.logId) && !homebaseIds.has(share.connectionId),
  );
  db.logs = db.logs.filter((log) => !logIds.has(log.id));
  db.milestones = db.milestones.filter(
    (milestone) => !milestoneIds.has(milestone.id),
  );
  db.rewards = db.rewards.filter((reward) => !rewardIds.has(reward.id));
  db.participations = db.participations.filter(
    (person) => !people.has(person.id),
  );
  db.activitySubjects = db.activitySubjects.filter(
    (link) => !activityIds.has(link.activityId),
  );
  db.activities = db.activities.filter(
    (activity) => !activityIds.has(activity.id),
  );
  db.memberships = db.memberships.filter(
    (member) => !homebaseIds.has(member.connectionId),
  );
  db.connections = db.connections.filter((base) => !homebaseIds.has(base.id));
}

export function execute(
  database: Database,
  command: Command,
  now = new Date().toISOString(),
): { db: Database; entityId: string; duplicate: boolean } {
  const db = structuredClone(database);
  const firstNewEvent = db.events.length;
  requireValue(
    db.users.find((u) => u.id === command.actorId),
    "Unknown user.",
  );
  let entityId = "";
  switch (command.type) {
    case "createHomebase": {
      nonempty(command.name, "Home-base name", 200);
      entityId = id("homebase");
      db.connections.push({ id: entityId, name: command.name.trim() });
      db.memberships.push({
        id: id("member"),
        connectionId: entityId,
        userId: command.actorId,
      });
      emit(
        db,
        command.actorId,
        "homebase.created",
        "homebase",
        entityId,
        `Created home base “${command.name.trim()}”.`,
        [command.actorId],
        entityId,
        "activity",
      );
      break;
    }
    case "updateHomebase": {
      const base = requireValue(
        db.connections.find((row) => row.id === command.homebaseId),
        "Home base is missing.",
      );
      const people = members(db, base.id);
      if (!people.includes(command.actorId))
        throw new Error("Home base is not accessible.");
      nonempty(command.name, "Home-base name", 200);
      base.name = command.name.trim();
      entityId = base.id;
      emit(
        db,
        command.actorId,
        "homebase.updated",
        "homebase",
        base.id,
        `Renamed home base to “${base.name}”.`,
        people,
        base.id,
        "activity",
      );
      break;
    }
    case "deleteHomebase": {
      const base = requireValue(
        db.connections.find((row) => row.id === command.homebaseId),
        "Home base is missing.",
      );
      const people = members(db, base.id);
      if (!people.includes(command.actorId))
        throw new Error("Home base is not accessible.");
      const activities = new Set(
        db.activities
          .filter((activity) => activity.connectionId === base.id)
          .map((activity) => activity.id),
      );
      const milestones = new Set(
        db.milestones
          .filter((milestone) => activities.has(milestone.activityId))
          .map((milestone) => milestone.id),
      );
      entityId = base.id;
      removeGraph(db, milestones, activities, new Set([base.id]));
      emit(
        db,
        command.actorId,
        "homebase.deleted",
        "user",
        command.actorId,
        `Deleted home base “${base.name}” and its activities, milestones, logs and rewards.`,
        people,
        null,
        "activity",
      );
      break;
    }
    case "updateActivity": {
      const activity = managedActivity(db, command.actorId, command.activityId);
      const changes = updateActivitySchema.parse(command.changes);
      if (changes.name !== undefined) activity.name = changes.name;
      if (changes.description !== undefined)
        activity.description = changes.description;
      if (changes.target !== undefined)
        requireValue(
          participation(db, activity.id, command.actorId),
          "Participation is missing.",
        ).target = changes.target;
      entityId = activity.id;
      emit(
        db,
        command.actorId,
        "activity.updated",
        "activity",
        activity.id,
        `Updated “${activity.name}”. Personal target changes apply only to the editor.`,
        members(db, activity.connectionId),
        activity.connectionId,
        "activity",
      );
      break;
    }
    case "deleteActivity": {
      const activity = managedActivity(db, command.actorId, command.activityId);
      const milestones = new Set(
        db.milestones
          .filter((milestone) => milestone.activityId === activity.id)
          .map((milestone) => milestone.id),
      );
      entityId = activity.id;
      removeGraph(db, milestones, new Set([activity.id]));
      emit(
        db,
        command.actorId,
        "activity.deleted",
        "homebase",
        activity.connectionId,
        `Deleted activity “${activity.name}” and its milestones, logs, progress and rewards.`,
        members(db, activity.connectionId),
        activity.connectionId,
        "activity",
      );
      break;
    }
    case "updateMilestone": {
      const milestone = requireValue(
        db.milestones.find((row) => row.id === command.milestoneId),
        "Milestone is missing.",
      );
      const activity = managedActivity(
        db,
        command.actorId,
        milestone.activityId,
      );
      if (milestone.kind === "join")
        throw new Error(
          "Milestone zero is managed by the activity and cannot be edited.",
        );
      const changes = updateMilestoneSchema.parse(command.changes);
      const reward = db.rewards.find((row) => row.id === milestone.rewardId);
      const input = milestoneInputSchema.parse({
        ...milestone,
        itemId: reward?.itemId ?? null,
        ...changes,
      });
      const parent = requireValue(
        db.milestones.find(
          (row) =>
            row.id ===
            (input.parentId ??
              db.milestones.find(
                (root) =>
                  root.activityId === activity.id && root.kind === "join",
              )?.id),
        ),
        "Parent milestone is missing.",
      );
      if (
        parent.activityId !== activity.id ||
        milestoneSubtree(db, milestone.id).has(parent.id)
      )
        throw new Error(
          "Parent must be in the same activity and cannot be this milestone or its descendant.",
        );
      const rulesChanged =
        input.quantity !== milestone.quantity ||
        input.policy !== milestone.policy ||
        input.startAt !== milestone.startAt ||
        input.endAt !== milestone.endAt ||
        parent.id !== milestone.parentId ||
        input.itemId !== (reward?.itemId ?? null);
      if (
        rulesChanged &&
        db.logs.some((log) => log.milestoneId === milestone.id)
      )
        throw new Error(
          "This milestone has logs. Only its name can change; recorded quantities, schedules and reward rules are fixed.",
        );
      if (input.itemId !== (reward?.itemId ?? null)) {
        if (input.itemId) {
          requireValue(
            db.rewardItems.find((item) => item.id === input.itemId),
            "Reward item is missing.",
          );
          if (reward) reward.itemId = input.itemId;
          else {
            milestone.rewardId = id("reward");
            db.rewards.push({
              id: milestone.rewardId,
              homebaseId: activity.connectionId,
              itemId: input.itemId,
              obtainedAt: null,
              requiredUserIds: db.participations
                .filter(
                  (person) =>
                    person.activityId === activity.id &&
                    person.status === "active",
                )
                .map((person) => person.userId),
            });
            if (!db.rewards.at(-1)!.requiredUserIds.length)
              throw new Error(
                "A reward needs at least one active participant.",
              );
          }
        } else {
          db.rewards = db.rewards.filter(
            (row) => row.id !== milestone.rewardId,
          );
          // Reward events cannot exist before logs, but remove any obsolete references.
          const eventIds = new Set(
            db.events
              .filter(
                (event) =>
                  event.entityType === "reward" &&
                  event.entityId === milestone.rewardId,
              )
              .map((event) => event.id),
          );
          db.events = db.events.filter((event) => !eventIds.has(event.id));
          db.deliveries = db.deliveries.filter(
            (delivery) => !eventIds.has(delivery.eventId),
          );
          milestone.rewardId = null;
        }
      }
      Object.assign(milestone, {
        name: input.name,
        parentId: parent.id,
        quantity: input.quantity,
        policy: input.policy,
        startAt: input.startAt,
        endAt: input.endAt,
      });
      entityId = milestone.id;
      emit(
        db,
        command.actorId,
        "milestone.updated",
        "milestone",
        milestone.id,
        `Updated milestone “${milestone.name}”. Existing reward requirements stay fixed.`,
        members(db, activity.connectionId),
        activity.connectionId,
        "activity",
      );
      break;
    }
    case "deleteMilestone": {
      const milestone = requireValue(
        db.milestones.find((row) => row.id === command.milestoneId),
        "Milestone is missing.",
      );
      const activity = managedActivity(
        db,
        command.actorId,
        milestone.activityId,
      );
      if (milestone.kind === "join")
        throw new Error(
          "Milestone zero cannot be deleted separately. Delete the activity instead.",
        );
      entityId = milestone.id;
      const ids = milestoneSubtree(db, milestone.id);
      removeGraph(db, ids);
      emit(
        db,
        command.actorId,
        "milestone.deleted",
        "activity",
        activity.id,
        `Deleted milestone “${milestone.name}”, its descendants, logs, progress and attached rewards.`,
        members(db, activity.connectionId),
        activity.connectionId,
        "activity",
      );
      break;
    }

    case "createSubject": {
      const template = requireValue(
        db.subjectTemplates.find((t) => t.id === command.templateId),
        "Unknown subject template.",
      );
      nonempty(command.title, "Subject title", 200);
      for (const [field, value] of Object.entries(command.metadata)) {
        if (
          !template.fields.includes(field) ||
          typeof value !== "string" ||
          value.length > 2000
        )
          throw new Error("Invalid descriptive field.");
      }
      entityId = id("subject");
      db.subjects.push({
        id: entityId,
        templateId: template.id,
        ownerUserId: command.actorId,
        title: command.title.trim(),
        metadata: command.metadata,
        createdAt: now,
      });
      emit(
        db,
        command.actorId,
        "subject.created",
        "subject",
        entityId,
        `Created “${command.title.trim()}”. Owned by its creator; not shared until linked or logged to an audience.`,
        [command.actorId],
        null,
        "private",
      );
      break;
    }
    case "createActivity": {
      const template = requireValue(
        db.activityTemplates.find((t) => t.id === command.templateId),
        "Unknown activity template.",
      );
      nonempty(command.name, "Activity name", 200);
      positive(command.target, "Target");
      if (command.description.length > 2000)
        throw new Error("Description is too long.");
      if (!members(db, command.connectionId).includes(command.actorId))
        throw new Error("Choose a home base you belong to.");
      for (const subjectId of command.subjectIds) {
        const subject = requireValue(
          visibleSubjects(db, command.actorId).find((s) => s.id === subjectId),
          "Choose a subject you can access.",
        );
        if (
          db.subjectTemplates.find((t) => t.id === subject.templateId)
            ?.category !== template.category
        )
          throw new Error("The subject must match the activity's category.");
      }
      entityId = id("activity");
      db.activities.push({
        id: entityId,
        templateId: template.id,
        name: command.name.trim(),
        description: command.description,
        creatorUserId: command.actorId,
        connectionId: command.connectionId,
        category: template.category,
        progressMode: template.progressMode,
        unit: template.unit,
        createdAt: now,
      });
      for (const subjectId of new Set(command.subjectIds))
        db.activitySubjects.push({
          id: id("link"),
          activityId: entityId,
          subjectId,
        });
      const participants = members(db, command.connectionId);
      for (const userId of participants)
        db.participations.push({
          id: id("participation"),
          activityId: entityId,
          userId,
          target: command.target,
          status: "invited",
        });
      const rootId = id("milestone");
      db.milestones.push({
        id: rootId,
        activityId: entityId,
        parentId: rootId,
        kind: "join",
        name: "Join activity",
        quantity: 1,
        policy: "open",
        startAt: null,
        endAt: null,
        rewardId: null,
        createdAt: now,
      });
      // Milestone zero is the first log for every participant, in the same
      // transaction as activity creation. No manual acceptance is required.
      for (const userId of participants) {
        const joined = execute(
          db,
          {
            type: "recordLog",
            actorId: userId,
            input: {
              authorUserId: userId,
              milestoneId: rootId,
              isSuccess: true,
              title: "Activity started (automatic milestone zero)",
              durationMinutes: 0,
              occurredAt: now,
              origin: "automation",
            },
          },
          now,
        );
        Object.assign(db, joined.db);
      }
      emit(
        db,
        command.actorId,
        "activity.created",
        "activity",
        entityId,
        `Created “${command.name.trim()}” with ${participants.length} participation record(s). The home base owns the activity.`,
        participants,
        command.connectionId,
        "activity",
      );
      break;
    }
    case "linkSubject": {
      const a = requireValue(
        db.activities.find((a) => a.id === command.activityId),
        "Activity is missing.",
      );
      if (
        !canSeeActivity(db, command.actorId, a) ||
        participation(db, a.id, command.actorId)?.status !== "active"
      )
        throw new Error("Join the activity before adding subjects.");
      const s = requireValue(
        visibleSubjects(db, command.actorId).find(
          (s) => s.id === command.subjectId,
        ),
        "Subject is not accessible.",
      );
      if (
        db.subjectTemplates.find((t) => t.id === s.templateId)?.category !==
        a.category
      )
        throw new Error("The subject must match the activity's category.");
      if (
        db.activitySubjects.some(
          (l) => l.activityId === a.id && l.subjectId === s.id,
        )
      )
        throw new Error("This subject is already linked.");
      db.activitySubjects.push({
        id: id("link"),
        activityId: a.id,
        subjectId: s.id,
      });
      entityId = a.id;
      emit(
        db,
        command.actorId,
        "subject.linked",
        "activity",
        a.id,
        `“${s.title}” linked to ${a.name}. Subject ownership stays with its creator.`,
        db.participations
          .filter((p) => p.activityId === a.id && p.status !== "left")
          .map((p) => p.userId),
        a.connectionId,
        "activity",
      );
      break;
    }
    case "participate": {
      const activity = requireValue(
        db.activities.find((a) => a.id === command.activityId),
        "Activity is missing.",
      );
      if (!canSeeActivity(db, command.actorId, activity))
        throw new Error("Activity is not accessible.");
      const person = requireValue(
        participation(db, activity.id, command.actorId),
        "Participation is missing.",
      );
      positive(command.target, "Target");
      person.target = command.target;
      entityId = activity.id;
      emit(
        db,
        command.actorId,
        "participation.target_changed",
        "activity",
        activity.id,
        `Personal target changed to ${person.target} ${activity.unit}. Joining and leaving use milestone zero.`,
        [command.actorId],
        null,
        "private",
      );
      break;
    }
    case "createMilestone": {
      const input = milestoneInputSchema.parse(command);
      const activity = requireValue(
        db.activities.find((a) => a.id === input.activityId),
        "Activity is missing.",
      );
      if (
        !canSeeActivity(db, command.actorId, activity) ||
        participation(db, activity.id, command.actorId)?.status !== "active"
      )
        throw new Error("Join the activity before planning milestones.");
      const root = requireValue(
        db.milestones.find(
          (m) => m.activityId === activity.id && m.kind === "join",
        ),
        "Milestone zero is missing.",
      );
      const parent = requireValue(
        db.milestones.find((m) => m.id === (input.parentId ?? root.id)),
        "Parent milestone is missing.",
      );
      if (parent.activityId !== activity.id)
        throw new Error("Parent must belong to the same activity.");
      const homebase = requireValue(
        homebaseForActivity(db, activity),
        "Home base is missing.",
      );
      let rewardId: string | null = null;
      if (input.itemId) {
        requireValue(
          db.rewardItems.find((item) => item.id === input.itemId),
          "Reward item is missing.",
        );
        rewardId = id("reward");
        db.rewards.push({
          id: rewardId,
          homebaseId: homebase.id,
          itemId: input.itemId,
          obtainedAt: null,
          requiredUserIds: db.participations
            .filter(
              (p) => p.activityId === activity.id && p.status === "active",
            )
            .map((p) => p.userId),
        });
      }
      entityId = id("milestone");
      db.milestones.push({
        id: entityId,
        activityId: activity.id,
        parentId: parent.id,
        kind: "achievement",
        name: input.name,
        quantity: input.quantity,
        policy: input.policy,
        startAt: input.startAt,
        endAt: input.endAt,
        rewardId,
        createdAt: now,
      });
      emit(
        db,
        command.actorId,
        "milestone.created",
        "milestone",
        entityId,
        `Planned “${input.name}” with ${input.policy} logging${rewardId ? " and a shared home-base reward" : ""}.`,
        members(db, homebase.id),
        homebase.id,
        "activity",
      );
      break;
    }
    case "recordLog": {
      const input: LogInput = logInputSchema.parse(command.input);
      input.externalKey = input.externalKey?.trim() || null;
      if (input.authorUserId !== command.actorId)
        throw new Error("A trigger must act on behalf of the selected author.");
      if (
        input.externalKey &&
        db.logs.some(
          (l) =>
            l.authorUserId === command.actorId &&
            l.origin === input.origin &&
            l.externalKey === input.externalKey,
        )
      ) {
        return {
          db: database,
          entityId: db.logs.find(
            (l) =>
              l.authorUserId === command.actorId &&
              l.origin === input.origin &&
              l.externalKey === input.externalKey,
          )!.id,
          duplicate: true,
        };
      }
      const milestone = requireValue(
        db.milestones.find((m) => m.id === input.milestoneId),
        "Milestone is missing.",
      );
      const activity = requireValue(
        db.activities.find((a) => a.id === milestone.activityId),
        "Activity is missing.",
      );
      const rejection = logRejection(
        db,
        command.actorId,
        milestone,
        input.isSuccess,
        now,
      );
      if (rejection) throw new Error(rejection);
      if (Date.parse(input.occurredAt) > Date.parse(now))
        throw new Error("Occurrence time cannot be in the future.");
      entityId = id("log");
      const log: Log = {
        id: entityId,
        milestoneId: milestone.id,
        isSuccess: input.isSuccess,
        authorUserId: command.actorId,
        subjectId:
          milestone.kind === "join"
            ? null
            : (db.activitySubjects.find(
                (link) => link.activityId === activity.id,
              )?.subjectId ?? null),
        category: activity.category,
        title: input.title.trim(),
        quantity: milestone.quantity,
        unit: activity.unit,
        durationMinutes: input.durationMinutes,
        occurredAt: input.occurredAt,
        origin: input.origin,
        externalKey: input.externalKey || null,
        createdAt: now,
      };
      db.logs.push(log);
      emit(
        db,
        command.actorId,
        "log.created",
        "log",
        log.id,
        `Recorded ${input.isSuccess ? "success" : "failure"} on “${milestone.name}” via ${log.origin}.`,
        [command.actorId],
        null,
        "private",
        log.origin,
      );
      shareLog(db, command.actorId, log, [activity.connectionId]);
      const person = requireValue(
        participation(db, activity.id, command.actorId),
        "Participation is missing.",
      );
      if (milestone.kind === "join") {
        person.status = input.isSuccess ? "active" : "left";
        const homebase = requireValue(
          homebaseForActivity(db, activity),
          "Home base is missing.",
        );
        emit(
          db,
          command.actorId,
          "participation.changed",
          "milestone",
          milestone.id,
          `${db.users.find((u) => u.id === command.actorId)?.name} ${input.isSuccess ? "joined" : "declined or left"} ${activity.name} through milestone zero.`,
          members(db, homebase.id),
          homebase.id,
          "activity",
          log.origin,
        );
      } else if (input.isSuccess) {
        const before = progress(db, person);
        db.contributions.push({
          id: id("credit"),
          logId: log.id,
          participationId: person.id,
          amount: activity.progressMode === "sessions" ? 1 : milestone.quantity,
        });
        const after = progress(db, person);
        const homebase = requireValue(
          homebaseForActivity(db, activity),
          "Home base is missing.",
        );
        emit(
          db,
          command.actorId,
          "milestone.completed",
          "milestone",
          milestone.id,
          `${milestone.name}: ${before.value} → ${after.value} / ${person.target} ${activity.unit}. No other milestones were completed automatically.`,
          members(db, homebase.id),
          homebase.id,
          "progress",
          log.origin,
        );
        if (!before.met && after.met)
          emit(
            db,
            command.actorId,
            "target.reached",
            "activity",
            activity.id,
            `Personal target reached in ${activity.name}.`,
            members(db, homebase.id),
            homebase.id,
            "progress",
            log.origin,
          );
        awardReward(db, milestone, command.actorId, now, log.origin);
      }
      break;
    }
    case "distributeLog": {
      const log = requireValue(
        db.logs.find((l) => l.id === command.logId),
        "Log is missing.",
      );
      entityId = log.id;
      shareLog(db, command.actorId, log, command.connectionIds);
      break;
    }
  }
  for (const event of db.events.slice(firstNewEvent)) event.createdAt = now;
  return { db, entityId, duplicate: false };
}
