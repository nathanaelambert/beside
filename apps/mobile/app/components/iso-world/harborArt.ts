import { hash } from "./bitmap"

export const harborTimber = {
  dark: "#493226",
  shade: "#674832",
  mid: "#896140",
  light: "#a87d51",
  pale: "#bc9460",
  edge: "#dbc090",
  wet: "#424e41",
}

export const harborLamp = {
  metal: "#49372c",
  ember: "#a95e33",
  amber: "#e5a44d",
  flame: "#ffe8a2",
}

/** Grade the existing 3× jetty illustration to honeyed timber, without changing its alpha. */
export const jettyTimberGrade = [
  0.88, 0.1, 0.025, 0, 0, 0.07, 0.91, 0.04, 0, 0, 0.09, 0.1, 0.84, 0, 0, 0, 0, 0, 1, 0,
]

/** Shared grain for the tile deck and the procedural jetty. Both inputs are within one board. */
export function harborBoardColor(board: number, lengthwise: number, crosswise: number) {
  if (crosswise < 0.13) return harborTimber.shade
  if (crosswise < 0.27) return harborTimber.edge
  const grain = Math.floor(crosswise * 8)
  const knots = hash(board, grain, 69)
  if (grain === 4 && knots > 0.4 && lengthwise > 0.34 && lengthwise < 0.57) return harborTimber.mid
  if ((lengthwise < 0.11 || lengthwise > 0.89) && crosswise > 0.49 && crosswise < 0.64)
    return harborTimber.dark
  if (crosswise > 0.8) return harborTimber.light
  return hash(board, 3, 81) > 0.32 ? harborTimber.pale : harborTimber.light
}

/** A small deck-only accent; the shared pond-deck palette and jetty hardware stay put. */
export function harborJettyBoardColor(board: number, lengthwise: number, crosswise: number) {
  const timber = harborBoardColor(board, lengthwise, crosswise)
  if (lengthwise < 0.19 || lengthwise > 0.81) return timber
  if (timber === harborTimber.pale) return board % 3 === 1 ? "#c19a68" : "#b99264"
  if (timber === harborTimber.light) return "#ac8157"
  return timber
}
