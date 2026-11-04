import { timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { createScheduleSchema } from "@beside/domain/schedules";
import { AuthGuard, type AuthenticatedRequest } from "./auth.ts";
import { list, ref } from "./openapi.ts";
import { SchedulingService } from "./scheduling.service.ts";

@ApiExcludeController()
@Controller("api/cron")
export class CronController {
  constructor(
    @Inject(SchedulingService) private readonly scheduling: SchedulingService,
  ) {}
  @Get("milestones")
  run(@Req() request: Request) {
    const secret = process.env.CRON_SECRET;
    const supplied = Buffer.from(request.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (
      !secret ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new UnauthorizedException("Cron authorization required.");
    return this.scheduling.run();
  }
}

@ApiTags("Beside")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1")
export class SchedulingController {
  constructor(
    @Inject(SchedulingService) private readonly scheduling: SchedulingService,
  ) {}
  @Get("activities/:activityId/schedules")
  @ApiParam({ name: "activityId", type: String })
  @ApiOkResponse({ schema: list("MilestoneSchedule") })
  list(
    @Req() request: AuthenticatedRequest,
    @Param("activityId") activityId: string,
  ) {
    return this.scheduling.list(request.actor.id, activityId);
  }
  @Post("activities/:activityId/schedules")
  @ApiParam({ name: "activityId", type: String })
  @ApiBody({ schema: ref("CreateSchedule") })
  @ApiCreatedResponse({ schema: ref("MilestoneSchedule") })
  @ApiOperation({
    summary: "Plan recurring milestone windows",
    description:
      "Daily, weekly, monthly by date or monthly by weekday in an IANA timezone. Generates through 35 days ahead. Invalid monthly dates and nonexistent daylight-saving times are skipped. End dates are inclusive; count limits actual generated occurrences.",
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Param("activityId") activityId: string,
    @Body() body: unknown,
  ) {
    return this.scheduling.create(
      request.actor.id,
      activityId,
      createScheduleSchema.parse(body),
    );
  }
  @Delete("schedules/:scheduleId")
  @ApiParam({ name: "scheduleId", type: String })
  @ApiOkResponse({ schema: ref("Mutation") })
  @ApiOperation({
    summary: "Stop a recurring schedule",
    description:
      "Cancels future unlogged occurrences and their rewards. Current and past milestones and recorded outcomes remain.",
  })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param("scheduleId") scheduleId: string,
  ) {
    return this.scheduling.remove(request.actor.id, scheduleId);
  }
}
