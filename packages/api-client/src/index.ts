import type {
  ApiHomebase,
  ApiState,
  CreateActivityInput,
  CreateLogInput,
  CreateMilestoneInput,
  CreateSubjectInput,
  LoginInput,
  MutationResult,
  RegisterInput,
  Session,
  UpdateActivityInput,
  UpdateMilestoneInput,
} from "@beside/domain/api";
import type { User } from "@beside/domain/types";
export type * from "@beside/domain/api";

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: { path: string; message: string }[];
  constructor(
    status: number,
    message: string,
    issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}
export class BesideClient {
  private token: string | null = null;
  readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  constructor(
    baseUrl: string,
    fetcher: typeof fetch = globalThis.fetch,
    timeoutMs = 15000,
  ) {
    const url = new URL(baseUrl);
    if (!/^https?:$/.test(url.protocol))
      throw new Error("The API URL must use HTTP or HTTPS.");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetcher = fetcher.bind(globalThis);
    this.timeoutMs = timeoutMs;
  }
  setToken(token: string | null) {
    this.token = token;
  }
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v1${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new ApiError(
          response.status,
          data?.message ?? `API request failed (${response.status}).`,
          data?.issues,
        );
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }
  async register(input: RegisterInput) {
    const session = await this.request<Session>(
      "/auth/register",
      "POST",
      input,
    );
    this.setToken(session.token);
    return session;
  }
  async login(input: LoginInput) {
    const session = await this.request<Session>("/auth/login", "POST", input);
    this.setToken(session.token);
    return session;
  }
  async logout() {
    await this.request<void>("/auth/logout", "POST");
    this.setToken(null);
  }
  me() {
    return this.request<User>("/auth/me");
  }
  state() {
    return this.request<ApiState>("/state");
  }
  homebases() {
    return this.request<ApiHomebase[]>("/homebases");
  }
  createHomebase(name: string) {
    return this.request<ApiHomebase>("/homebases", "POST", { name });
  }
  joinHomebase(inviteCode: string) {
    return this.request<MutationResult>("/homebases/join", "POST", {
      inviteCode,
    });
  }
  updateHomebase(homebaseId: string, name: string) {
    return this.request<MutationResult>(
      `/homebases/${encodeURIComponent(homebaseId)}`,
      "PATCH",
      { name },
    );
  }
  deleteHomebase(homebaseId: string) {
    return this.request<MutationResult>(
      `/homebases/${encodeURIComponent(homebaseId)}`,
      "DELETE",
    );
  }
  updateActivity(activityId: string, input: UpdateActivityInput) {
    return this.request<MutationResult>(
      `/activities/${encodeURIComponent(activityId)}`,
      "PATCH",
      input,
    );
  }
  deleteActivity(activityId: string) {
    return this.request<MutationResult>(
      `/activities/${encodeURIComponent(activityId)}`,
      "DELETE",
    );
  }
  updateMilestone(milestoneId: string, input: UpdateMilestoneInput) {
    return this.request<MutationResult>(
      `/milestones/${encodeURIComponent(milestoneId)}`,
      "PATCH",
      input,
    );
  }
  deleteMilestone(milestoneId: string) {
    return this.request<MutationResult>(
      `/milestones/${encodeURIComponent(milestoneId)}`,
      "DELETE",
    );
  }
  createSubject(input: CreateSubjectInput) {
    return this.request<MutationResult>("/subjects", "POST", input);
  }
  createActivity(input: CreateActivityInput) {
    return this.request<MutationResult>("/activities", "POST", input);
  }
  linkSubject(activityId: string, subjectId: string) {
    return this.request<MutationResult>(
      `/activities/${encodeURIComponent(activityId)}/subjects`,
      "POST",
      { subjectId },
    );
  }
  updateTarget(activityId: string, target: number) {
    return this.request<MutationResult>(
      `/activities/${encodeURIComponent(activityId)}/participation`,
      "PATCH",
      { target },
    );
  }
  createMilestone(input: CreateMilestoneInput) {
    return this.request<MutationResult>("/milestones", "POST", input);
  }
  recordLog(input: CreateLogInput) {
    return this.request<MutationResult>("/logs", "POST", input);
  }
  shareLog(logId: string, connectionIds: string[]) {
    return this.request<MutationResult>(
      `/logs/${encodeURIComponent(logId)}/shares`,
      "POST",
      { connectionIds },
    );
  }
}
