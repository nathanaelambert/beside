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
  const [binding, edge, stitch, dyed, mixed, mixedThread, linenThread, linen] = picnicClothRamp
  const nearest = Math.min(edgeU, edgeV)
  if (nearest < hem) {
    if (nearest < hem * 0.47) return binding
    const along = edgeU < edgeV ? v : u
    return Math.floor(along * 24) % 3 === 1 ? stitch : edge
  }

  const dyedThreads = (Math.floor(u * 3) % 2) + (Math.floor(v * 3) % 2)
  // One short warp frequency, quieter than the hem at the edge of the cloth.
  const thread = Math.floor(u * 16) % 10 === 2 && Math.floor(v * 16) % 10 < 4
  if (dyedThreads === 2) return thread ? mixed : dyed
  if (dyedThreads === 1) return thread ? mixedThread : mixed
  return thread ? linenThread : linen
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
