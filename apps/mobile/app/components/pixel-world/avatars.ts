import type { PixelArt } from "@beside/rewards"

import { GROUP_BLANKET } from "./terrain"

// Hand-placed 16 × 20 chibi avatars. Same format as reward artifacts; "o" is the warm outline.
const outline = "#3b2a2e"

// Mosaab: a big round black afro, wire glasses and a full beard above a navy suit and tie.
const you: PixelArt = {
  format: "pixel-art",
  palette: {
    o: outline,
    h: "#1d1b21",
    H: "#35323b",
    d: "#121014",
    s: "#8a5636",
    S: "#653b24",
    e: "#0f0c0f",
    g: "#4b4650",
    b: "#18161a",
    m: "#a0604a",
    k: "#1c2639",
    c: "#26324a",
    C: "#33415c",
    l: "#3f4d69",
    w: "#efebe2",
    t: "#bbb4a6",
    T: "#958f84",
    p: "#2b313c",
    P: "#1f242e",
    f: "#22252d",
    F: "#40444e",
  },
  pixels: [
    "...oooooooooo...",
    "..oHHhhhhhhHHo..",
    ".oHhhhhhhhhhhhdo",
    "oHhhhhhhhhhhhhdo",
    "ohhhsssssssshhdo",
    "ohhggggssgggghdo",
    "ohhgseggggesghdo",
    "ohhgsegssgesghdo",
    "ohbggggssggggbdo",
    "ohbssbbbbbbssbdo",
    ".obbbbbmmbbbbbo.",
    "..obbbbbbbbbbo..",
    "...owbbbbbbwo...",
    "...oClwttwlko...",
    ".oCoCcltTlkcoko.",
    ".osocccTTcckoSo.",
    "..ooppppPPPPoo..",
    "...opppooPPPo...",
    "..oFfffooFfffo..",
    "...oooo..oooo...",
  ],
}

const nathaniel: PixelArt = {
  format: "pixel-art",
  palette: {
    o: outline,
    d: "#2a1f26",
    h: "#3f2f37",
    H: "#5c4850",
    L: "#7f686e",
    s: "#c98d66",
    S: "#a86f50",
    e: "#24191e",
    m: "#7f4e3d",
    g: "#5a3b2f",
    k: "#4b664b",
    c: "#6d8d61",
    C: "#93b07f",
    w: "#f2e7cd",
    W: "#d3c4a3",
    p: "#6b5444",
    P: "#4f3d33",
    f: "#3a3434",
    F: "#605654",
  },
  pixels: [
    "....oo.ooooo....",
    "...oLHoHHhhho...",
    "..oHLLHHhhhhdo..",
    ".ohHHhhhhhhhhdo.",
    ".ohhhhhhhhhhhdo.",
    ".ohggggssggggdo.",
    ".ohgseggggesgdo.",
    ".oSgsegssgesgSo.",
    ".oSggggssggggSo.",
    ".osssssmmssssso.",
    "..oSssssssssSo..",
    "...ooooSSoooo...",
    "...oCCwwwwcko...",
    ".oCoCcwwWwckoko.",
    ".oCoCcwWWwckoko.",
    ".osoccwwWwckoSo.",
    "..ooppppPPPPoo..",
    "...opppooPPPo...",
    "..oFfffooFfffo..",
    "...oooo..oooo...",
  ],
}

// Vaibhav: a smooth bald head, bold dark glasses and a full beard, in a red plaid shirt.
const vaibhav: PixelArt = {
  format: "pixel-art",
  palette: {
    o: outline,
    L: "#dca878",
    s: "#bf8a5c",
    S: "#a26c46",
    e: "#0a080b",
    g: "#2b2830",
    b: "#1f1c21",
    m: "#9a5b45",
    k: "#6e292c",
    c: "#b3463e",
    C: "#d26150",
    w: "#e8dbbe",
    q: "#482e35",
    p: "#374252",
    P: "#28313f",
    f: "#272932",
    F: "#454852",
  },
  pixels: [
    ".....oooooo.....",
    "...ooSsLLssSoo..",
    "..oSssLLsssssSo.",
    ".oSssssssssssSSo",
    ".oSssssssssssSSo",
    ".oSggggssggggSSo",
    ".oSgseggggesgSSo",
    ".oSgsegssgesgSSo",
    ".oSggggssggggSSo",
    ".obssbbbbbbssbo.",
    ".obbbbbmmbbbbbo.",
    "..obbbbbbbbbbo..",
    "...oCqcwqccko...",
    ".oCoqqqwqqqkoqo.",
    ".oqoCwqqCwqkoCo.",
    ".oSocqcwqcckoSo.",
    "..ooPPppppPPoo..",
    "...oPPpooPPpo...",
    "..oFfffooFfffo..",
    "...oooo..oooo...",
  ],
}

// Pritesh: a neat side part, close beard, open blue camp-collar shirt with
// short sleeves, light trousers and dark shoes. A different face and silhouette.
const pritesh: PixelArt = {
  format: "pixel-art",
  palette: {
    o: outline,
    d: "#302b31",
    h: "#3c343c",
    H: "#5d535c",
    L: "#81717a",
    s: "#b77f58",
    S: "#925e43",
    e: "#251e25",
    m: "#734139",
    g: "#2c2a33",
    k: "#3f6577",
    c: "#648a9b",
    C: "#91aebe",
    w: "#efe0bd",
    W: "#d3c197",
    p: "#b5a17b",
    P: "#8d795c",
    f: "#343847",
    F: "#66687a",
  },
  pixels: [
    "....ooooooo.....",
    "...oHHHhhhoo....",
    "..oHLHHhhhhhho..",
    ".oHHHhhhhhhddo..",
    ".ohhhssssssddo..",
    ".odggggssggggo..",
    ".oSgseggggesgo..",
    ".oSgsegssgesgo..",
    ".oSggggssggggo..",
    "..odssmmsssdo...",
    "..oddSSSSdddo...",
    "...ooooSSoooo...",
    "...oCCwWwCcko...",
    ".oCCoCwwWWcokCo.",
    ".osSoCcwWWckSso.",
    ".oSSocccWWckoSo.",
    "..ooppppPPPPoo..",
    "...opPpoopPPo...",
    "..oFfffooFfffo..",
    "...oooo..oooo...",
  ],
}

// Eyes close to a single line of lashes.
function blink(art: PixelArt): PixelArt {
  const eyes = art.pixels.findIndex((row) => row.includes("e"))
  return {
    ...art,
    pixels: art.pixels.map((row, y) => (y === eyes ? row.replaceAll("e", "s") : row)),
  }
}

// The head settles a pixel onto the shoulders, as if breathing out. Row 11 is the neck.
function breathe(art: PixelArt, neck = 11): PixelArt {
  const empty = ".".repeat(art.pixels[0].length)
  return { ...art, pixels: [empty, ...art.pixels.slice(0, neck), ...art.pixels.slice(neck + 1)] }
}

export interface Avatar {
  key: string
  name: string
  // Bottom-center anchor, in world pixels.
  x: number
  y: number
  frames: { idle: PixelArt; blink: PixelArt; breathe: PixelArt }
  // Offsets the idle cycle so the two never move in lockstep.
  phase: number
}

function frames(art: PixelArt) {
  return { idle: art, blink: blink(art), breathe: breathe(art) }
}

// Thirteen pixels apart, their hands meet on one shared outline pixel.
export const avatars: Avatar[] = [
  { key: "you", name: "You", x: 145, y: 147, frames: frames(you), phase: 0 },
  { key: "nathaniel", name: "Nathaniel", x: 158, y: 147, frames: frames(nathaniel), phase: 5 },
]

export const AVATAR_WIDTH = 16
export const AVATAR_HEIGHT = 20

// The prototype keeps its original two-person roster. Home bases opt into these four.
export const memberAvatarStyles: Avatar[] = [
  ...avatars,
  { key: "vaibhav", name: "Vaibhav Kapoor", x: 160, y: 147, frames: frames(vaibhav), phase: 11 },
  { key: "pritesh", name: "Pritesh Parmar", x: 177, y: 147, frames: frames(pritesh), phase: 17 },
]

const memberArtNames = ["mosaab", "nathanael lambert", "vaibhav kapoor", "pritesh parmar"]

/** Shared member-to-art mapping for the meadow and activity participant rows. */
export function avatarForMember(name: string, index: number): Avatar {
  const normalized = name.trim().replace(/\s+/g, " ").toLowerCase()
  const known = memberArtNames.findIndex((candidate) =>
    candidate === "mosaab"
      ? normalized === candidate || normalized.startsWith("mosaab ")
      : normalized === candidate,
  )
  const fallback =
    ((index % memberAvatarStyles.length) + memberAvatarStyles.length) % memberAvatarStyles.length
  const art = memberAvatarStyles[known === -1 ? fallback : known]
  return { ...art, name, phase: index * 5 + 1 }
}

export function avatarsForMembers(members: { id: string; name: string }[]): Avatar[] {
  return members.map((member, index) => ({
    ...avatarForMember(member.name, index),
    key: member.id,
    x:
      (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2 -
      ((Math.min(4, members.length - Math.floor(index / 4) * 4) - 1) * 17) / 2 +
      (index % 4) * 17,
    y: 147 + Math.floor(index / 4) * 24,
  }))
}

export function firstNamesLabel(members: { name: string }[]): string {
  const names = members.map((member) => member.name.trim().split(/\s+/)[0])
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
}
