export const COTTAGE_MILESTONE_CAP = 3;
export const MAX_COTTAGE_BUILD_SECONDS = 3600;
export const DEFAULT_COTTAGE_BUILD_SECONDS = {
  base: 10,
  entrance: 15,
  finished: 20,
};
export const COTTAGE_BUILD_STAGES = ["base", "entrance", "finished"] as const;

type BuildStage = (typeof COTTAGE_BUILD_STAGES)[number];
export type CottageLevel = 1 | 2 | 3;
export type CottageSpriteLevel = 0 | CottageLevel;
export type CottageBuildSeconds = Record<BuildStage, number>;
export interface CottageBuild {
  seconds: CottageBuildSeconds;
  readyAt: Record<BuildStage, string | null>;
}

type CottageRecord = {
  cottageMilestones?: number;
  cottageBuild?: CottageBuild | null;
};

export function cottageLevel(milestones = 0): CottageLevel {
  return milestones >= COTTAGE_MILESTONE_CAP ? 3 : milestones >= 1 ? 2 : 1;
}

export function cottageBuildSettings(
  seconds = DEFAULT_COTTAGE_BUILD_SECONDS,
): CottageBuild {
  return {
    seconds: { ...seconds },
    readyAt: { base: null, entrance: null, finished: null },
  };
}

/** Fix the deadline once, and queue rapid unlocks behind the preceding build. */
export function queueCottageLevel(
  build: CottageBuild,
  level: CottageLevel,
  now: string,
  durations: CottageBuildSeconds,
) {
  const stage = COTTAGE_BUILD_STAGES[level - 1]!;
  if (build.readyAt[stage]) return;
  const previous = COTTAGE_BUILD_STAGES[level - 2];
  const previousReady = previous ? build.readyAt[previous] : null;
  const start = Math.max(
    Date.parse(now),
    previousReady ? Date.parse(previousReady) : 0,
  );
  const seconds = durations[stage];
  build.seconds[stage] = seconds;
  build.readyAt[stage] = new Date(start + seconds * 1000).toISOString();
}

/** The snapshot determines construction; no writes, device timer or cron settle it. */
export function cottageConstruction(activity: CottageRecord, now: number) {
  const unlocked = cottageLevel(activity.cottageMilestones);
  for (const [index, stage] of COTTAGE_BUILD_STAGES.entries()) {
    const ready = activity.cottageBuild?.readyAt[stage];
    const level = (index + 1) as CottageLevel;
    if (level <= unlocked && ready && Date.parse(ready) > now)
      return {
        level: index as CottageSpriteLevel,
        building: level,
        seconds: Math.ceil((Date.parse(ready) - now) / 1000),
      };
  }
  return { level: unlocked, building: null, seconds: 0 };
}
