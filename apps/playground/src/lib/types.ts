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
  color: string;
}
export interface Connection {
  id: string;
  name: string;
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
  personalOwnerId: string | null;
  connectionId: string | null;
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
  entityType: string;
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
export interface PixelArt {
  // A dot is transparent; every other character refers to a palette color.
  format: "pixel-art";
  palette: Record<string, string>;
  pixels: string[];
}
export interface RewardItem {
  id: string;
  name: string;
  // Independent of activity categories; new catalog groups need no new model.
  category: string;
  artifact: PixelArt;
}
export interface Database {
  version: 1;
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
}
export interface LogInput {
  authorUserId: string;
  subjectId: string | null;
  category: Category;
  title: string;
  quantity: number;
  unit: string;
  durationMinutes: number;
  occurredAt: string;
  origin: Origin;
  externalKey?: string | null;
  activityIds: string[];
  connectionIds: string[];
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
      connectionId: string | null;
      subjectIds: string[];
      target: number;
      inviteOthers: boolean;
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
      status: "active" | "finished" | "left";
      target?: number;
    }
  | { type: "recordLog"; actorId: string; input: LogInput }
  | {
      type: "distributeLog";
      actorId: string;
      logId: string;
      activityIds: string[];
      connectionIds: string[];
    };
