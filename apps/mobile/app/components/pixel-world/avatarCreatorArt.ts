import type { AvatarAppearance } from "@beside/api-client"

import type { Avatar } from "./avatars"
import { portraitFrames } from "./detailedAvatarArt"

const skin: Record<AvatarAppearance["skin"], string> = {
  porcelain: "d #865f53 s #ecc3a7 S #cc9a80 L #f8d7ba j #b67e6c",
  sand: "d #805546 s #cc936b S #aa7056 L #e4af88 j #98604b",
  bronze: "d #674335 s #a9704f S #855239 L #c98962 j #774935",
  deep: "d #51332f s #79503e S #603b30 L #9d6650 j #56352d",
}

const hairColors: Record<AvatarAppearance["hairColor"], string> = {
  espresso: "h #392b31 H #564149 a #725a5a",
  chestnut: "h #4a302b H #724a37 a #946744",
  copper: "h #693a31 H #9b573a a #c48051",
}

const outfitColors: Record<AvatarAppearance["outfit"], string> = {
  "moss-jacket": "k #405742 c #647f52 C #90a86f",
  "indigo-jacket": "k #303d55 c #485f7b C #7891a3",
  "clay-sweater": "k #713d45 c #a95854 C #cf846e",
  "ochre-sweater": "k #795132 c #aa7743 C #d3ab64",
}

const baseBody = `
  o 12,53 22,51 25,56 23,60 11,60 10,58
  o 26,52 34,52 37,56 37,59 26,60 24,57
  B 13,56 21,55 22,57 20,58 12,58
  B 28,55 34,55 35,57 30,58 27,57
  P 13,41 33,41 35,46 33,55 29,57 26,55 24,50 22,56 17,57 13,55
  p 15,44 23,44 22,51 18,55 15,54
  p 26,44 31,44 32,50 30,54 28,54
  k 8,34 13,29 21,27 29,27 36,29 40,34 41,41 37,45 33,42 31,47 25,45 19,47 14,44 11,43 8,45 6,42
  c 9,34 15,30 21,29 27,29 34,30 38,34 39,39 36,42 32,40 30,45 24,44 20,45 15,42 12,40 9,43 8,39
  C 10,35 15,32 19,31 17,35 13,36 11,39 9,39
  C 32,31 35,32 38,36 38,39 35,38 33,35
  j 8,43 12,42 14,46 12,50 9,50 7,47
  s 9,44 12,44 12,47 10,48 9,47
  S 36,41 39,42 38,46 35,48 33,46
  s 36,42 38,42 37,45 35,46 35,44
  S 19,24 30,24 30,30 27,33 21,32 18,30
  s 21,26 28,26 28,30 25,31 22,30
`

const jacket = `
  t 19,28 28,28 30,32 27,38 25,44 19,43
  l 20,30 28,31 27,36 24,41 21,40
  k 15,30 18,29 21,32 19,38 16,43 14,41
  k 29,29 33,30 33,36 31,42 28,44 28,39 30,34
  C 14,38 17,38 17,40 14,40
  C 30,39 33,38 33,40 30,41
`

const sweater = `
  k 17,29 21,28 25,30 30,28 32,29 28,33 22,33
  C 14,40 30,40 30,42 15,42
  C 15,43 28,43 28,44 15,44
  k 15,45 30,45 29,46 15,46
`

const head = `
  d 10,13 10,10 13,7 17,5 22,4 28,4 33,6 36,9 37,13 39,16 39,21 36,23 33,27 29,29 23,30 18,28 14,26 12,23 9,22 8,18
  S 11,13 13,9 18,7 23,5 28,5 33,7 36,10 36,15 38,17 38,21 35,22 33,26 29,28 23,29 18,27 15,25 13,22 10,21 9,18
  s 12,13 14,9 19,7 24,6 28,6 33,8 35,11 35,16 35,21 33,24 30,26 24,27 20,26 16,24 14,21 12,19
  L 15,12 19,9 24,8 28,8 30,10 27,12 23,12 20,14 16,15
  s 10,18 12,17 14,19 13,21 11,21
  L 24,19 26,19 27,22 25,23 23,22
  j 22,24 28,24 28,25 25,26 22,25
`

const hair: Record<AvatarAppearance["hair"], string> = {
  bald: "",
  cropped: `
    h 10,15 9,11 11,8 13,8 14,6 18,5 20,4 26,4 30,5 33,5 36,8 37,12 36,16 34,16 33,12 29,10 23,11 18,11 15,13 13,16
    H 12,10 16,7 20,6 26,5 31,6 34,8 35,11 32,10 28,8 21,9 17,9 14,11
    a 15,9 18,7 23,6 26,6 23,8 18,8
  `,
  swept: `
    h 9,14 9,10 12,8 16,7 19,4 23,3 27,1 32,3 35,6 38,10 38,15 36,18 34,16 32,12 29,11 27,8 22,10 18,12 15,13 13,17 11,17
    H 11,11 16,9 19,6 23,5 27,3 31,4 33,6 30,7 27,6 24,7 21,9 16,11 13,14 11,14
    H 30,8 33,7 36,10 37,14 35,15 33,12
    a 16,9 20,6 23,6 27,4 29,5 25,6 22,8 18,9
  `,
  curly: `
    h 8,15 7,12 9,10 9,7 12,5 15,5 16,3 20,2 23,3 26,1 30,2 32,4 35,4 38,6 38,9 41,11 40,15 37,18 35,17 33,14 30,13 27,11 22,12 19,11 16,14 13,15 12,18 10,18
    H 9,12 12,10 11,8 15,7 17,8 17,5 20,4 23,5 26,3 29,4 30,6 33,6 36,7 36,10 39,12 37,15 35,13 31,12 29,9 24,9 21,8 18,10 15,11 13,14 10,15
    a 13,7 16,6 17,8 15,9 13,9
    a 19,5 22,4 24,6 22,7 19,7
    a 27,4 30,5 30,7 27,8 25,6
    a 33,7 35,7 36,10 34,11 32,9
  `,
}

const glasses: Record<AvatarAppearance["glasses"], string> = {
  none: "",
  round: `
    g 15,16 22,16 24,18 24,20 22,22 16,22 14,20 14,18
    g 27,16 33,16 35,18 35,20 33,22 27,22 25,20 25,18
    G 23,17 27,17 27,18 23,18
    w 16,17 22,17 23,18 23,20 22,21 16,21 15,20 15,18
    w 27,17 33,17 34,18 34,20 33,21 27,21 26,20 26,18
  `,
  square: `
    g 14,16 24,16 24,22 14,22
    g 26,16 35,16 35,22 26,22
    G 23,17 27,17 27,18 23,18
    w 15,17 23,17 23,21 15,21
    w 27,17 34,17 34,21 27,21
  `,
}

const cache = new Map<string, Avatar["frames"]>()

/** Preview and world use the same 48×60 composite, sampled into the existing 16×20 footprint. */
export function customAvatarFrames(appearance: AvatarAppearance): Avatar["frames"] {
  const { version, skin: tone, hair: cut, hairColor, glasses: frames, outfit } = appearance
  const key = [version, tone, cut, hairColor, frames, outfit].join(":")
  const cached = cache.get(key)
  if (cached) return cached
  const art = portraitFrames({
    palette: [
      "e #332b2e g #473a3c G #967453 w #dba985 t #bea782 l #e7d9b7",
      "P #42404b p #63606b o #3a302f B #80664f",
      skin[tone],
      hairColors[hairColor],
      outfitColors[outfit],
    ].join(" "),
    body: `${baseBody}\n${outfit.endsWith("jacket") ? jacket : sweater}`,
    head: `${head}\n${hair[cut]}\n${glasses[frames]}`,
    eyesOpen: "e 18,17 20,17 20,20 18,20\ne 29,17 31,17 31,20 29,20",
    eyesClosed: "e 17,18 21,18 21,19 17,19\ne 28,18 32,18 32,19 28,19",
  })
  const first = cache.keys().next().value
  if (cache.size >= 64 && first !== undefined) cache.delete(first)
  cache.set(key, art)
  return art
}
