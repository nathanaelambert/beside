import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule, configureApp } from "./application.ts";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}

void bootstrap();
