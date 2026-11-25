import { WORLD_HEIGHT } from "./meadow-terrain.ts";

export interface HomeCoastTile {
  col: number;
  row: number;
}

export interface HomebaseExpansion {
  additions: HomeCoastTile[];
}

/** One bounded apron directly outside the immutable 18 × 15 meadow. */
export const homeExpansionRow = WORLD_HEIGHT / 16;
export const homeExpansionFirstColumn = 7;
export const homeExpansionLastColumn = 14;

export const sameHomeCoastTile = (a: HomeCoastTile, b: HomeCoastTile) =>
  a.col === b.col && a.row === b.row;

/**
 * Each allowed tile shares a full side with the original southwest shoreline.
 * The ends, corner channel, rest of the sea, and east pier approach stay open.
 */
export function isHomeExpansionTile({ col, row }: HomeCoastTile) {
  return (
    row === homeExpansionRow &&
    Number.isInteger(col) &&
    col >= homeExpansionFirstColumn &&
    col <= homeExpansionLastColumn
  );
}

const coastOrder = [10, 11, 9, 12, 8, 13, 7, 14] as const;
export function homeExpansionCandidates(additions: readonly HomeCoastTile[]) {
  return coastOrder
    .map((col) => ({ col, row: homeExpansionRow }))
    .filter(
      (tile) => !additions.some((added) => sameHomeCoastTile(tile, added)),
    );
}
