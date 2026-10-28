import "reflect-metadata";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import {
  Catch,
  HttpException,
  Module,
  type ArgumentsHost,
  type ExceptionFilter,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AuthGuard, AuthService } from "./auth.ts";
import {
  AuthController,
  DomainController,
  HealthController,
} from "./controllers.ts";
import { DatabaseService } from "./db/database.service.ts";
import { DomainService } from "./domain.service.ts";
import { openApiSchema, ref, schemas } from "./openapi.ts";

@Catch()
class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      response.status(400).json({
        statusCode: 400,
        message: "Request validation failed.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    if (error instanceof HttpException) {
      response
        .status(error.getStatus())
        .json({ statusCode: error.getStatus(), message: error.message });
      return;
    }
    const code = (error as { code?: string })?.code;
    const status =
      code === "23505"
        ? 409
        : code === "23503" || code === "23514"
          ? 400
          : code === "42P01" ||
              code?.startsWith("08") ||
              code === "ECONNREFUSED" ||
              code === "ENOTFOUND" ||
              code === "ETIMEDOUT"
            ? 503
            : 500;
    const message =
      status === 409
        ? "This record already exists."
        : status === 400
          ? "The requested change violates a data constraint."
          : status === 503
            ? "Database is unavailable or migrations are pending."
            : "The request could not be completed.";
    console.error("API request failed", { code: code ?? "unknown", status });
    response.status(status).json({ statusCode: status, message });
  }
}

@Module({
  controllers: [HealthController, AuthController, DomainController],
  providers: [DatabaseService, DomainService, AuthService, AuthGuard],
})
export class AppModule {}

export async function createApp(logger: false | undefined = undefined) {
  const app = await NestFactory.create(AppModule, { logger, bodyParser: true });
  configureApp(app);
  return app;
}

export function configureApp(app: INestApplication) {
  const server = app.getHttpAdapter().getInstance();
  server.disable("x-powered-by");
  if (process.env.VERCEL) server.set("trust proxy", 1);
  app.use((_: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.enableCors({
    origin: (
      process.env.CORS_ORIGINS ?? "http://localhost:3002,http://127.0.0.1:3002"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  const builder = new DocumentBuilder()
    .setTitle("Beside API")
    .setDescription(
      "Shared mobile and web API. The v1 schema follows the current playground model and is disposable during this first pass. Register or sign in, then use the returned bearer token to authorize requests.",
    )
    .setVersion("0.1.0")
    .addBearerAuth();
  if (process.env.API_PUBLIC_URL) builder.addServer(process.env.API_PUBLIC_URL);
  const document = SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controller, method) =>
      `${controller.replace("Controller", "")}_${method}`,
  });
  document.components ??= {};
  document.components.schemas ??= {};
  for (const [name, schema] of Object.entries(schemas))
    document.components.schemas[name] = openApiSchema(schema);
  for (const path of Object.values(document.paths)) {
    for (const operation of Object.values(path)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      )
        continue;
      for (const status of [400, 401, 409, 429, 503])
        operation.responses[status] ??= {
          description: {
            400: "Invalid request",
            401: "Session required or expired",
            409: "Conflict",
            429: "Too many requests",
            503: "Database unavailable",
          }[status as 400],
          content: { "application/json": { schema: ref("Error") } },
        };
    }
  }
  SwaggerModule.setup("docs", app, document, {
    customSwaggerUiPath: dirname(
      createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"),
    ),
    jsonDocumentUrl: "/openapi.json",
    yamlDocumentUrl: "/openapi.yaml",
    swaggerOptions: { persistAuthorization: false },
    customSiteTitle: "Beside API",
  });
  server.get("/", (_: Request, response: Response) =>
    response.redirect("/docs"),
  );
  app.enableShutdownHooks();
}
