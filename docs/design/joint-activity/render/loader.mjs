import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
const ROOT = process.env.ISO_ROOT
const alias = {
  "@beside/rewards": ROOT + "/packages/rewards/src/catalog.ts",
  "@beside/api-client/garden": ROOT + "/packages/api-client/src/garden.ts",
  "@beside/domain/garden": ROOT + "/packages/domain/src/garden.ts",
  "@beside/domain/meadow-terrain": ROOT + "/packages/domain/src/meadow-terrain.ts",
}
export async function resolve(spec, ctx, next) {
  if (alias[spec]) return next(pathToFileURL(alias[spec]).href, ctx)
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\.[mc]?[jt]s$/.test(spec) && ctx.parentURL) {
    const base = new URL(spec, ctx.parentURL)
    const p = fileURLToPath(base)
    for (const c of [p + ".ts", p + "/index.ts"]) if (existsSync(c)) return next(pathToFileURL(c).href, ctx)
  }
  return next(spec, ctx)
}
