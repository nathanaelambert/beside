import {
  COTTAGE_BUILD_STAGES,
  DEFAULT_COTTAGE_BUILD_SECONDS,
  MAX_COTTAGE_BUILD_SECONDS,
  type CottageBuildSeconds,
} from "@beside/domain/cottage";
import { cottageBuildSecondsSchema } from "@beside/domain/validation";

export const COTTAGE_BUILD_DURATIONS = Symbol("COTTAGE_BUILD_DURATIONS");

const variables = {
  base: "COTTAGE_BUILD_BASE_SECONDS",
  entrance: "COTTAGE_BUILD_ENTRANCE_SECONDS",
  finished: "COTTAGE_BUILD_FINISHED_SECONDS",
} as const;

export function readCottageBuildDurations(
  env: NodeJS.ProcessEnv = process.env,
) {
  const durations: CottageBuildSeconds = { ...DEFAULT_COTTAGE_BUILD_SECONDS };
  for (const stage of COTTAGE_BUILD_STAGES) {
    const variable = variables[stage];
    const raw = env[variable]?.trim();
    if (raw === undefined) continue;
    const parsed = cottageBuildSecondsSchema.shape[stage].safeParse(
      Number(raw),
    );
    if (!/^\d+$/.test(raw) || !parsed.success)
      throw new Error(
        `${variable} must be a whole number from 1 to ${MAX_COTTAGE_BUILD_SECONDS}.`,
      );
    durations[stage] = parsed.data;
  }
  return Object.freeze(durations);
}
