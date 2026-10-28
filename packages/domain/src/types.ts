import type { RewardItem } from "@beside/rewards";
export type { PixelArt, RewardItem } from "@beside/rewards";

export type Category =
  | "reading"
  | "watching"
  | "movement"
  | "cooking"
  | "learning"
  | "habits"
  | "custom";
export type Origin = "manual" | "voice" | "mcp" | "automation";
export type ProgressMode = "position" | "sum" | "sessions";
export interface User {
  id: string;
  name: string;
  email: string;
  color: "blue" | "rose" | "moss";
}
// Connection rows are home bases. Membership is identical for every base.
export interface Homebase {
  id: string;
  name: string;
}
export type Connection = Homebase;
export type LoggingPolicy = "open" | "paced" | "deadline";
export interface Milestone {
  id: string;
  activityId: string;
  parentId: string;
  kind: "join" | "achievement";
  name: string;
  quantity: number;
  policy: LoggingPolicy;
  startAt: string | null;
  endAt: string | null;
  rewardId: string | null;
  createdAt: string;
}
export interface Reward {
  id: string;
  homebaseId: string;
  itemId: string;
  obtainedAt: string | null;
  // Snapshot the people whose cooperation this reward requires.
  requiredUserIds: string[];
}
export interface Membership {
  id: string;
  connectionId: string;
  userId: string;
}
export interface SubjectTemplate {
  id: string;
  name: string;
  category: Category;
  fields: string[];
  unit: string;
}
export interface ActivityTemplate {
  id: string;
  name: string;
  category: Category;
  description: string;
  progressMode: ProgressMode;
  unit: string;
  target: number;
}
export interface Subject {
  id: string;
  templateId: string;
  ownerUserId: string;
  title: string;
  metadata: Record<string, string>;
  createdAt: string;
}
export interface Activity {
  id: string;
  templateId: string;
  creatorUserId: string;
  connectionId: string;
  name: string;
  description: string;
  category: Category;
  progressMode: ProgressMode;
  unit: string;
  createdAt: string;
}
export interface ActivitySubject {
  id: string;
  activityId: string;
  subjectId: string;
}
export interface Participation {
  id: string;
  activityId: string;
  userId: string;
  target: number;
  status: "invited" | "active" | "finished" | "left";
}
export interface Log {
  id: string;
  // Null only for preserved logs from the original playground.
  milestoneId: string | null;
  isSuccess: boolean;
  authorUserId: string;
  subjectId: string | null;
  category: Category;
  title: string;
  quantity: number;
  unit: string;
  durationMinutes: number;
  occurredAt: string;
  origin: Origin;
  externalKey: string | null;
  createdAt: string;
}
export interface LogShare {
  id: string;
  logId: string;
  connectionId: string;
  sharedByUserId: string;
}
export interface Contribution {
  id: string;
  logId: string;
  participationId: string;
  amount: number;
}
export interface DomainEvent {
  id: string;
  actorUserId: string;
  type: string;
  entityType: "subject" | "activity" | "log" | "milestone" | "reward";
  entityId: string;
  message: string;
  origin: Origin;
  createdAt: string;
}
export interface Delivery {
  id: string;
  eventId: string;
  recipientUserId: string;
  connectionId: string | null;
  kind: "private" | "update" | "progress" | "activity";
}
export interface Database {
  version: 3;
  users: User[];
  connections: Connection[];
  memberships: Membership[];
  subjectTemplates: SubjectTemplate[];
  activityTemplates: ActivityTemplate[];
  subjects: Subject[];
  activities: Activity[];
  activitySubjects: ActivitySubject[];
  participations: Participation[];
  logs: Log[];
  logShares: LogShare[];
  contributions: Contribution[];
  events: DomainEvent[];
  deliveries: Delivery[];
  rewardItems: RewardItem[];
  milestones: Milestone[];
  rewards: Reward[];
}
export interface LogInput {
  authorUserId: string;
  milestoneId: string;
  isSuccess: boolean;
  title: string;
  durationMinutes: number;
  occurredAt: string;
  origin: Origin;
  externalKey?: string | null;
}
export type Command =
  | {
      type: "createSubject";
      actorId: string;
      templateId: string;
      title: string;
      metadata: Record<string, string>;
    }
  | {
      type: "createActivity";
      actorId: string;
      templateId: string;
      name: string;
      description: string;
      connectionId: string;
      subjectIds: string[];
      target: number;
    }
  | {
      type: "linkSubject";
      actorId: string;
      activityId: string;
      subjectId: string;
    }
  | {
      type: "participate";
      actorId: string;
      activityId: string;
      target: number;
    }
  | {
      type: "createMilestone";
      actorId: string;
      activityId: string;
      parentId: string | null;
      name: string;
      quantity: number;
      policy: LoggingPolicy;
      startAt: string | null;
      endAt: string | null;
      itemId: string | null;
    }
  | { type: "recordLog"; actorId: string; input: LogInput }
  | {
      type: "distributeLog";
      actorId: string;
      logId: string;
      connectionIds: string[];
    };
