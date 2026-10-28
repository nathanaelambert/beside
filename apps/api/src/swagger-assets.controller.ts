import { readFileSync } from "node:fs";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

// Vercel's backend runtime ignores express.static. Explicit file reads both
// trace these build-time assets into the function and serve them on that host.
@ApiExcludeController()
@Controller("docs")
export class SwaggerAssetsController {
  @Get("swagger-ui.css")
  @Header("Content-Type", "text/css; charset=utf-8")
  css() {
    return readFileSync(
      new URL("../public/docs/swagger-ui.css", import.meta.url),
      "utf8",
    );
  }
  @Get("swagger-ui-bundle.js")
  @Header("Content-Type", "application/javascript; charset=utf-8")
  bundle() {
    return readFileSync(
      new URL("../public/docs/swagger-ui-bundle.js", import.meta.url),
      "utf8",
    );
  }
  @Get("swagger-ui-standalone-preset.js")
  @Header("Content-Type", "application/javascript; charset=utf-8")
  preset() {
    return readFileSync(
      new URL(
        "../public/docs/swagger-ui-standalone-preset.js",
        import.meta.url,
      ),
      "utf8",
    );
  }
  @Get("favicon-16x16.png")
  @Header("Content-Type", "image/png")
  favicon16() {
    return readFileSync(
      new URL("../public/docs/favicon-16x16.png", import.meta.url),
    );
  }
  @Get("favicon-32x32.png")
  @Header("Content-Type", "image/png")
  favicon32() {
    return readFileSync(
      new URL("../public/docs/favicon-32x32.png", import.meta.url),
    );
  }
}
