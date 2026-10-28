import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import * as input from "@beside/domain/api";
import { AuthGuard, AuthService, type AuthenticatedRequest } from "./auth.ts";
import { DatabaseService } from "./db/database.service.ts";
import { DomainService } from "./domain.service.ts";
import { list, ref } from "./openapi.ts";

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  @Get("health")
  @ApiOkResponse({ schema: ref("Health") })
  health() {
    return { status: "ok" };
  }
  @Get("health/ready")
  @ApiOkResponse({ schema: ref("Readiness") })
  ready() {
    return this.database.ready();
  }
}

@ApiTags("Authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("register")
  @ApiBody({ schema: ref("Register") })
  @ApiCreatedResponse({ schema: ref("Session") })
  @ApiNotFoundResponse({
    description: "Invitation code not found; no account created",
    schema: ref("Error"),
  })
  @ApiOperation({
    summary: "Create an account and join or initialize a home base",
    description:
      "An optional inviteCode joins that existing home base. Without a code, creates an inviteable home base. Invalid codes roll back registration. Returns a 30-day bearer session. Passwords must contain 12–128 characters. No email verification or password recovery in this first pass.",
  })
  async register(@Body() body: unknown, @Req() request: Request) {
    const data = input.registerSchema.parse(body);
    await this.auth.throttle(request.ip ?? "unknown");
    return this.auth.register(data);
  }
  @Post("login")
  @HttpCode(200)
  @ApiBody({ schema: ref("Login") })
  @ApiOkResponse({ schema: ref("Session") })
  async login(@Body() body: unknown, @Req() request: Request) {
    const data = input.loginSchema.parse(body);
    await this.auth.throttle(request.ip ?? "unknown");
    return this.auth.login(data);
  }
  @Get("me")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ schema: ref("User") })
  me(@Req() request: AuthenticatedRequest) {
    return request.actor;
  }
  @Post("logout")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  logout(@Req() request: AuthenticatedRequest) {
    return this.auth.logout(request.sessionHash);
  }
}

@ApiTags("Beside")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1")
export class DomainController {
  constructor(@Inject(DomainService) private readonly domain: DomainService) {}
  @Get("state")
  @ApiOkResponse({ schema: ref("State") })
  @ApiOperation({
    summary: "Read the current user's visible model",
    description:
      "An audience-filtered projection, not an importable database backup. Profiles omit email. Data belonging exclusively to unrelated users and home bases is excluded.",
  })
  state(@Req() request: AuthenticatedRequest) {
    return this.domain.state(request.actor.id);
  }
  @Get("homebases")
  @ApiOkResponse({ schema: list("Homebase") })
  homebases(@Req() request: AuthenticatedRequest) {
    return this.domain.homebases(request.actor.id);
  }
  @Post("homebases")
  @ApiBody({ schema: ref("CreateHomebase") })
  @ApiCreatedResponse({ schema: ref("Homebase") })
  createHomebase(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.createHomebase(
      request.actor.id,
      input.createHomebaseSchema.parse(body).name,
    );
  }
  @Post("homebases/join")
  @HttpCode(200)
  @ApiBody({ schema: ref("JoinHomebase") })
  @ApiOkResponse({ schema: ref("Mutation") })
  @ApiOperation({
    summary: "Join a home base with its invitation code",
    description:
      "Initializes participation in existing activities. Existing reward rosters do not change. Treat the invitation code as a shared secret.",
  })
  @ApiNotFoundResponse({
    description: "Invitation code not found",
    schema: ref("Error"),
  })
  joinHomebase(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.joinHomebase(
      request.actor.id,
      input.joinHomebaseSchema.parse(body).inviteCode,
    );
  }
  @Get("templates")
  @ApiOkResponse({ schema: ref("Templates") })
  async templates(@Req() request: AuthenticatedRequest) {
    const db = await this.domain.state(request.actor.id);
    return {
      subjectTemplates: db.subjectTemplates,
      activityTemplates: db.activityTemplates,
    };
  }
  @Get("catalog")
  @ApiOkResponse({ schema: list("RewardItem") })
  async catalog(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).rewardItems;
  }
  @Get("subjects")
  @ApiOkResponse({ schema: list("Subject") })
  async subjects(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).subjects;
  }
  @Get("activities")
  @ApiOkResponse({ schema: list("Activity") })
  async activities(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).activities;
  }
  @Get("milestones")
  @ApiOkResponse({ schema: list("Milestone") })
  async milestones(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).milestones;
  }
  @Get("logs")
  @ApiOkResponse({ schema: list("Log") })
  async logs(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).logs;
  }
  @Get("rewards")
  @ApiOkResponse({ schema: list("Reward") })
  async rewards(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).rewards;
  }
  @Get("events")
  @ApiOkResponse({ schema: list("Event") })
  async events(@Req() request: AuthenticatedRequest) {
    return (await this.domain.state(request.actor.id)).events;
  }
  @Post("subjects")
  @ApiBody({ schema: ref("CreateSubject") })
  @ApiCreatedResponse({ schema: ref("Mutation") })
  createSubject(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.command({
      type: "createSubject",
      actorId: request.actor.id,
      ...input.createSubjectSchema.parse(body),
    });
  }
  @Post("activities")
  @ApiBody({ schema: ref("CreateActivity") })
  @ApiCreatedResponse({ schema: ref("Mutation") })
  createActivity(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.command({
      type: "createActivity",
      actorId: request.actor.id,
      ...input.createActivitySchema.parse(body),
    });
  }
  @Post("activities/:activityId/subjects")
  @ApiBody({ schema: ref("LinkSubject") })
  @ApiCreatedResponse({ schema: ref("Mutation") })
  @ApiParam({ name: "activityId", type: String })
  linkSubject(
    @Req() request: AuthenticatedRequest,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    return this.domain.command({
      type: "linkSubject",
      actorId: request.actor.id,
      activityId,
      ...input.linkSubjectSchema.parse(body),
    });
  }
  @Patch("activities/:activityId/participation")
  @ApiBody({ schema: ref("UpdateParticipation") })
  @ApiOkResponse({ schema: ref("Mutation") })
  @ApiParam({ name: "activityId", type: String })
  updateTarget(
    @Req() request: AuthenticatedRequest,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    return this.domain.command({
      type: "participate",
      actorId: request.actor.id,
      activityId,
      ...input.participationSchema.parse(body),
    });
  }
  @Post("milestones")
  @ApiBody({ schema: ref("CreateMilestone") })
  @ApiCreatedResponse({ schema: ref("Mutation") })
  createMilestone(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.command({
      type: "createMilestone",
      actorId: request.actor.id,
      ...input.createMilestoneSchema.parse(body),
    });
  }
  @Post("logs")
  @HttpCode(200)
  @ApiBody({ schema: ref("CreateLog") })
  @ApiOkResponse({ schema: ref("Mutation") })
  @ApiOperation({
    summary: "Record success or failure on one milestone",
    description:
      "The session determines the author. Reuse externalKey with the same origin when retrying a log; the original log is returned without duplicate credit, events, or rewards. Schedule eligibility uses server time.",
  })
  createLog(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domain.command({
      type: "recordLog",
      actorId: request.actor.id,
      input: {
        ...input.createLogSchema.parse(body),
        authorUserId: request.actor.id,
      },
    });
  }
  @Post("logs/:logId/shares")
  @HttpCode(200)
  @ApiBody({ schema: ref("ShareLog") })
  @ApiOkResponse({ schema: ref("Mutation") })
  @ApiParam({ name: "logId", type: String })
  shareLog(
    @Req() request: AuthenticatedRequest,
    @Param("logId") logId: string,
    @Body() body: unknown,
  ) {
    return this.domain.command({
      type: "distributeLog",
      actorId: request.actor.id,
      logId,
      ...input.shareLogSchema.parse(body),
    });
  }
}
