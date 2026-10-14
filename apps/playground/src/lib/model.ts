import type {
  Activity,
  Command,
  Database,
  DomainEvent,
  Log,
  LogInput,
  Origin,
  Participation,
} from "./types.ts";
import { logInputSchema } from "./validation.ts";

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
  db.activities.filter(
    (a) =>
      a.personalOwnerId === userId ||
      (a.connectionId && members(db, a.connectionId).includes(userId)),
  );
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
export function compatible(
  db: Database,
  userId: string,
  activity: Activity,
  log: Pick<Log, "category" | "subjectId" | "unit">,
) {
  const p = participation(db, activity.id, userId);
  const subjects = db.activitySubjects
    .filter((s) => s.activityId === activity.id)
    .map((s) => s.subjectId);
  return (
    !!p &&
    p.status === "active" &&
    canSeeActivity(db, userId, activity) &&
    activity.category === log.category &&
    (!subjects.length ||
      (log.subjectId !== null && subjects.includes(log.subjectId))) &&
    (activity.progressMode === "sessions" || activity.unit === log.unit)
  );
}
function emit(
  db: Database,
  actorUserId: string,
  type: string,
  entityType: string,
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
function distribute(
  db: Database,
  actorId: string,
  log: Log,
  activityIds: string[],
  connectionIds: string[],
) {
  if (log.authorUserId !== actorId)
    throw new Error("Only the log's author can change its distribution.");
  // Validate the entire command before creating any records. The caller mutates a cloned transaction.
  for (const connectionId of connectionIds)
    if (!members(db, connectionId).includes(actorId))
      throw new Error("You can only share with your own connections.");
  const activities = [...new Set(activityIds)].map((activityId) => {
    const activity = requireValue(
      db.activities.find((a) => a.id === activityId),
      "Activity is missing.",
    );
    if (!compatible(db, actorId, activity, log))
      throw new Error(
        `This log cannot contribute to ${activity.name}. Check participation, subject, category, and unit.`,
      );
    return activity;
  });
  const audience = new Set([
    ...connectionIds,
    ...activities.flatMap((a) => (a.connectionId ? [a.connectionId] : [])),
  ]);
  for (const connectionId of audience) {
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
    const name = db.connections.find((c) => c.id === connectionId)?.name;
    emit(
      db,
      actorId,
      "log.shared",
      "log",
      log.id,
      `“${log.title}” shared with ${name}. Sharing alone does not award progress.`,
      members(db, connectionId),
      connectionId,
      "update",
      log.origin,
    );
  }
  for (const activity of activities) {
    const p = requireValue(
      participation(db, activity.id, actorId),
      "Participation is missing.",
    );
    if (
      db.contributions.some(
        (c) => c.logId === log.id && c.participationId === p.id,
      )
    )
      continue;
    const before = progress(db, p);
    const amount = activity.progressMode === "sessions" ? 1 : log.quantity;
    db.contributions.push({
      id: id("credit"),
      logId: log.id,
      participationId: p.id,
      amount,
    });
    const after = progress(db, p);
    const recipients = db.participations
      .filter((p) => p.activityId === activity.id && p.status !== "left")
      .map((p) => p.userId);
    emit(
      db,
      actorId,
      "contribution.created",
      "activity",
      activity.id,
      `${activity.name}: ${before.value} → ${after.value} / ${p.target} ${activity.unit}. ${activity.progressMode === "position" ? "Furthest position wins." : activity.progressMode === "sessions" ? "One log counts as one session." : "Quantities are added."}`,
      recipients,
      activity.connectionId,
      "progress",
      log.origin,
    );
    if (!before.met && after.met)
      emit(
        db,
        actorId,
        "target.reached",
        "activity",
        activity.id,
        `Personal target reached in ${activity.name}. Other participants keep their own progress.`,
        recipients,
        activity.connectionId,
        "progress",
        log.origin,
      );
  }
}
export function execute(
  database: Database,
  command: Command,
): { db: Database; entityId: string; duplicate: boolean } {
  const db = structuredClone(database);
  requireValue(
    db.users.find((u) => u.id === command.actorId),
    "Unknown user.",
  );
  let entityId = "";
  switch (command.type) {
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
        createdAt: new Date().toISOString(),
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
      if (
        command.connectionId &&
        !members(db, command.connectionId).includes(command.actorId)
      )
        throw new Error("Choose a connection you belong to.");
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
        personalOwnerId: command.connectionId ? null : command.actorId,
        category: template.category,
        progressMode: template.progressMode,
        unit: template.unit,
        createdAt: new Date().toISOString(),
      });
      for (const subjectId of new Set(command.subjectIds))
        db.activitySubjects.push({
          id: id("link"),
          activityId: entityId,
          subjectId,
        });
      const participants = command.connectionId
        ? members(db, command.connectionId)
        : [command.actorId];
      for (const userId of participants)
        db.participations.push({
          id: id("participation"),
          activityId: entityId,
          userId,
          target: command.target,
          status:
            userId === command.actorId || !command.inviteOthers
              ? "active"
              : "invited",
        });
      emit(
        db,
        command.actorId,
        "activity.created",
        "activity",
        entityId,
        `Created “${command.name.trim()}” with ${participants.length} participation record(s). ${command.connectionId ? "The connection owns the activity." : "The creator owns this personal activity."}`,
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
      const a = requireValue(
        db.activities.find((a) => a.id === command.activityId),
        "Activity is missing.",
      );
      if (!canSeeActivity(db, command.actorId, a))
        throw new Error("Activity is not accessible.");
      const p = requireValue(
        participation(db, a.id, command.actorId),
        "Participation is missing.",
      );
      if (command.target !== undefined) {
        positive(command.target, "Target");
        p.target = command.target;
      }
      p.status = command.status;
      entityId = a.id;
      emit(
        db,
        command.actorId,
        "participation.changed",
        "activity",
        a.id,
        `${db.users.find((u) => u.id === command.actorId)?.name}: ${p.status}, personal target ${p.target} ${a.unit}. Existing contributions remain.`,
        db.participations
          .filter(
            (other) =>
              other.activityId === a.id &&
              (other.status !== "left" || other.id === p.id),
          )
          .map((p) => p.userId),
        a.connectionId,
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
      nonempty(input.title, "Log title");
      nonempty(input.unit, "Unit");
      positive(input.quantity, "Quantity");
      if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0)
        throw new Error("Duration must be zero or greater.");
      if (!Number.isFinite(Date.parse(input.occurredAt)))
        throw new Error("Choose a valid occurrence time.");
      if (input.subjectId) {
        const s = requireValue(
          visibleSubjects(db, command.actorId).find(
            (s) => s.id === input.subjectId,
          ),
          "Subject is not accessible.",
        );
        if (
          db.subjectTemplates.find((t) => t.id === s.templateId)?.category !==
          input.category
        )
          throw new Error("Subject and log categories must match.");
      }
      entityId = id("log");
      const log: Log = {
        id: entityId,
        authorUserId: command.actorId,
        subjectId: input.subjectId,
        category: input.category,
        title: input.title.trim(),
        quantity: input.quantity,
        unit: input.unit,
        durationMinutes: input.durationMinutes,
        occurredAt: input.occurredAt,
        origin: input.origin,
        externalKey: input.externalKey?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      db.logs.push(log);
      emit(
        db,
        command.actorId,
        "log.created",
        "log",
        log.id,
        `Recorded “${log.title}” via ${log.origin}. One author, one original log.`,
        [command.actorId],
        null,
        "private",
        log.origin,
      );
      distribute(
        db,
        command.actorId,
        log,
        input.activityIds,
        input.connectionIds,
      );
      break;
    }
    case "distributeLog": {
      const log = requireValue(
        db.logs.find((l) => l.id === command.logId),
        "Log is missing.",
      );
      entityId = log.id;
      distribute(
        db,
        command.actorId,
        log,
        command.activityIds,
        command.connectionIds,
      );
      break;
    }
  }
  return { db, entityId, duplicate: false };
}
