import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  homeExpansionFirstColumn,
  homeExpansionLastColumn,
  homeExpansionRow,
} from "@beside/domain/homebase-expansion";
import { z } from "zod";
import { AuthGuard, GuestAccess, type AuthenticatedRequest } from "./auth.ts";
import { HomebaseExpansionService } from "./homebase-expansion.service.ts";
import { openApiSchema, ref } from "./openapi.ts";

const coastTileSchema = z.strictObject({
  col: z.int().min(homeExpansionFirstColumn).max(homeExpansionLastColumn),
  row: z.literal(homeExpansionRow),
});
const expansionSchema = z.strictObject({ additions: z.array(coastTileSchema) });

@ApiTags("Beside")
@ApiBearerAuth()
@ApiParam({ name: "homebaseId", type: String })
@ApiOkResponse({ schema: openApiSchema(expansionSchema) })
@ApiNotFoundResponse({
  description: "Home base not found or not visible to the signed-in user",
  schema: ref("Error"),
})
@UseGuards(AuthGuard)
@Controller("api/v1/homebases/:homebaseId/expansion")
export class HomebaseExpansionController {
  constructor(
    @Inject(HomebaseExpansionService)
    private readonly expansion: HomebaseExpansionService,
  ) {}

  @Get()
  @GuestAccess()
  @ApiOperation({ summary: "Read a home base's saved coastline tiles" })
  get(
    @Req() request: AuthenticatedRequest,
    @Param("homebaseId") homebaseId: string,
  ) {
    return this.expansion.get(request.actor.id, homebaseId);
  }

  @Put()
  @ApiBody({ schema: openApiSchema(coastTileSchema) })
  @ApiForbiddenResponse({
    description: "Guests may view but not expand a coastline",
    schema: ref("Error"),
  })
  @ApiOperation({
    summary: "Add exactly one eligible coastline tile to a home base",
    description:
      "Members can extend the southwest shoreline by one tile per request. Repeating an existing tile is a no-op and returns the current shared coastline.",
  })
  add(
    @Req() request: AuthenticatedRequest,
    @Param("homebaseId") homebaseId: string,
    @Body() body: unknown,
  ) {
    return this.expansion.add(
      request.actor.id,
      homebaseId,
      coastTileSchema.parse(body),
    );
  }
}
