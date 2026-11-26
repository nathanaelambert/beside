export function rewardBuildReadyAt(now: string) {
  const configured = Number(process.env.REWARD_BUILD_SECONDS?.trim() || "10");
  const seconds =
    Number.isSafeInteger(configured) && configured >= 0 && configured <= 86_400
      ? configured
      : 10;
  return seconds
    ? new Date(Date.parse(now) + seconds * 1000).toISOString()
    : null;
}
