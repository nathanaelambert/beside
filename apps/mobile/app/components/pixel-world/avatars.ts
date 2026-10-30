import type { PixelArt } from "@beside/rewards"

// Hand-placed 16 × 20 chibi avatars. Same format as reward artifacts; "o" is the warm outline.
const outline = "#3b2a2e"

const you: PixelArt = {
  format: "pixel-art",
  palette: {
    o: outline,
    d: "#6b3a2a",
    h: "#91512f",
    H: "#b8703f",
    L: "#dc9d5c",
    s: "#f8d3b0",
    S: "#e2a684",
    e: "#2b1f26",
    b: "#f29a8c",
    m: "#b85a55",
    k: "#9c4a5a",
    c: "#c96b79",
    C: "#e8979c",
    p: "#52698c",
    P: "#3b4d6c",
    f: "#5a4038",
    F: "#8c6c5a",
  },
  pixels: [
    ".....oooooo.....",
    "...ooHLLHhhoo...",
    "..oHLLHhhhhhdo..",
    ".ohHHhhhhhhhhdo.",
    ".ohhhhhhhhhhhdo.",
    ".ohhhsshsssshdo.",
    ".ohhssssssssddo.",
    ".ohhsessssesddo.",
    ".ohhsessssesddo.",
    ".ohdbssmmssbddo.",
    ".ohdoSSSSSSoddo.",
    "..oooooSSooooo..",
    "...oCCcccccko...",
    ".oCoCCcccckkoko.",
    ".oCoCcccccckoko.",
    ".osoccccccckoSo.",
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
    b: "#d87a6c",
    m: "#86443c",
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
    ".ohhsshhhsshhdo.",
    ".ohssssssssssdo.",
    ".oSssessssessSo.",
    ".oSssessssessSo.",
    ".ossbssmmssbsso.",
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
