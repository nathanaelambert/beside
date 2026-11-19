// Isometric (2:1 dimetric) projection shared by the home base world and the activity vignette.
//
// The world keeps its existing data model: everything is stored in "meadow" pixels on the
// original 288 × 240 top-down map (see @beside/domain/meadow-terrain). This module is only a
// new camera on that data. One iso tile covers a 16 × 16 meadow cell, so the meadow becomes an
// 18 × 15 tile island, and PR #14's 8-pixel placement grid lands on tile centres and edges.

/** Width and height of a tile's top face, in art pixels. Classic 2:1 pixel-art iso. */
export const TILE_W = 32
export const TILE_H = 16
export const HALF_W = TILE_W / 2
export const HALF_H = TILE_H / 2
/** Meadow pixels per tile side. */
export const CELL = 16
/** Art pixels per height level (raised forest blocks are one level). */
export const LEVEL = 8

export interface IsoPoint {
  /** Tile-space coordinate along the meadow's x axis (screen down-right). */
  u: number
  /** Tile-space coordinate along the meadow's y axis (screen down-left). */
  v: number
}

export interface ScreenPoint {
  x: number
  y: number
}

/** The bitmap frame a map is drawn into: where tile-space (0, 0) lands, and the canvas size. */
export interface MapFrame {
  originX: number
  originY: number
  width: number
  height: number
}

export function mapFrame(
  cols: number,
  rows: number,
  { top = 56, side = 12, bottom = 28 }: { top?: number; side?: number; bottom?: number } = {},
): MapFrame {
  return {
    originX: rows * HALF_W + side,
    originY: top,
    width: (cols + rows) * HALF_W + side * 2,
    height: (cols + rows) * HALF_H + top + bottom,
  }
}

/** Tile space to bitmap pixels. `lift` raises the point by that many art pixels. */
export function isoToScreen(frame: MapFrame, u: number, v: number, lift = 0): ScreenPoint {
  return {
    x: frame.originX + (u - v) * HALF_W,
    y: frame.originY + (u + v) * HALF_H - lift,
  }
}

/** Bitmap pixels back to tile space on a plane `lift` pixels above the ground. */
export function screenToIso(frame: MapFrame, x: number, y: number, lift = 0): IsoPoint {
  const a = (x - frame.originX) / HALF_W
  const b = (y + lift - frame.originY) / HALF_H
  return { u: (a + b) / 2, v: (b - a) / 2 }
}

export const meadowToIso = (x: number, y: number): IsoPoint => ({ u: x / CELL, v: y / CELL })
export const isoToMeadow = (u: number, v: number) => ({ x: u * CELL, y: v * CELL })

/** Painter's-order key: larger is nearer the viewer. */
export const depthOf = (u: number, v: number) => u + v
