import type { PixelArt } from "@beside/rewards"

/** Dark binding, hem, stitch, dyed checks, mixed checks, and unbleached linen. */
export const picnicClothRamp = [
  "#8c5a4f",
  "#c6a282",
  "#d0b393",
  "#a46659",
  "#bf8773",
  "#c48b74",
  "#d6b894",
  "#d9b997",
] as const

/** Three checks per world tile, so the warp carries across even and odd tiles. */
export function wovenBlanketColor(u: number, v: number, edgeU: number, edgeV: number, hem: number) {
  const [binding, edge, stitch, dyed, mixed, , , linen] = picnicClothRamp
  const nearest = Math.min(edgeU, edgeV)
  if (nearest < hem) {
    if (nearest < hem * 0.47) return binding
    const along = edgeU < edgeV ? v : u
    // Two adjacent steps read as a short stitch, not a second continuous border.
    const step = Math.floor(along * 16) % 5
    return step === 2 || step === 3 ? stitch : edge
  }

  const dyedThreads = (Math.floor(u * 3) % 2) + (Math.floor(v * 3) % 2)
  // Keep the broad checks flat; the native finish adds the smaller weave.
  return dyedThreads === 2 ? dyed : dyedThreads === 1 ? mixed : linen
}

/** Short crossed strands, aligned to the cloth's isometric axes rather than the viewport. */
export function linenGrain(u: number, v: number, hem: boolean) {
  if (hem) return 0 // Give the existing inner stitches their own space.
  const across = Math.floor(v * 32)
  const band = Math.floor(across / 16) % 2
  const warp = (Math.floor(u * 32) + band * 7) % 18
  const weft = across % 16
  if (warp >= 3 && warp <= 8 && (weft === 5 || weft === 6)) return 12
  if (warp >= 4 && warp <= 8 && weft === 7) return -8
  if (band === 0 && (warp === 12 || warp === 13) && weft >= 10 && weft <= 13) return 8
  return 0
}

// Render the 3× finish only in the world; lists, fallback and all hits use the same logical art.
export const readingBenchTexture =
  require("../../../assets/images/bay-art/reading-bench.png") as number

// The support gap, posts and stone feet follow the original catalog mask.
// Within it, the rake of the seat and the dark right side turn the bench in space.
export const readingBenchArt: PixelArt = {
  format: "pixel-art",
  palette: {
    d: "#523b33", // cast wood shadow
    s: "#694c38",
    t: "#7e5b40",
    m: "#9f704a",
    n: "#af8154",
    p: "#c39664",
    h: "#ddb785",
    k: "#575646",
    r: "#7a755e",
    q: "#958768",
    l: "#b6a17c",
    L: "#cbbb97",
    b: "#324958",
    B: "#597f91",
    v: "#88a7aa",
    w: "#d4c9ad",
    o: "#566447",
    g: "#74805d",
  },
  pixels: [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "......hppd............nmsd......",
    "......pttd............mtsd......",
    "...hhhhhpppppppppppppppnttsdd...",
    "...pnnnnnnnnnnnnnnnnnmmttsddd...",
    "...tmmmmmmmmmmmmmmmmmtttssddd...",
    "...ddddddddddddddddddsssddddd...",
    "......mstd............tsdd......",
    "......mstd............ssdd......",
    "...mmnnnnnnnnnnnnnnnnmmttssdd...",
    "...ttttttttttttttttttttsssddd...",
    "...dddsssssssssssbbbbssdddddd...",
    "..phhhhhppppppppppbvvBbbpnmtts..",
    "..ppppppppppppppppBBBBbbpmmtts..",
    "..nnnnnnnnnnnnnnnnbwwwwbtnntsd..",
    "..stttmmmmmmmmmmmmbbbbbttstsdd..",
    "..sttttttttttttttttttsstssdddd..",
    "..dddddddddddddddddddddddddddd..",
    ".....tssd..............tsdd.....",
    ".....mtsd..............ssdd.....",
    "....kllqrk............kqrrkk....",
    "...oLLlqrko..........ollqrrko...",
    "..oglqlrrkgo........oglqrrkkgo..",
    "...okkkkkoo..........okkkkkko...",
    "................................",
    "................................",
  ],
}
