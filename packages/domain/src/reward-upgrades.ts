/** A joint upgrade needs at least two active participants, including its remaining co-earners. */
export function hasCooperativeUpgradeRoster(
  coEarners: readonly string[],
  homebaseMembers: readonly string[],
  activeRoster: readonly string[],
) {
  return (
    coEarners.length <= 1 ||
    (activeRoster.length >= 2 &&
      coEarners.every(
        (id) => !homebaseMembers.includes(id) || activeRoster.includes(id),
      ))
  );
}
