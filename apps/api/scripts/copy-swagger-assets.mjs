import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Vercel backends serve static files from public through the CDN. Package-local
// express.static middleware isn't used for these requests in that environment.
const source = dirname(
  createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"),
);
for (const folder of ["../public/docs/", "../dist/apps/api/public/docs/"]) {
  const destination = fileURLToPath(new URL(folder, import.meta.url));
  await mkdir(destination, { recursive: true });
  for (const name of [
    "swagger-ui.css",
    "swagger-ui-bundle.js",
    "swagger-ui-standalone-preset.js",
    "favicon-16x16.png",
    "favicon-32x32.png",
  ]) {
    await copyFile(join(source, name), join(destination, name));
  }
}
console.log("Prepared Swagger UI assets for Vercel's public directory.");
