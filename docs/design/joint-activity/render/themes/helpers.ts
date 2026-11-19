const P = process.env.ISO_ROOT + "/apps/mobile/app/components/iso-world/"
const bm = await import(P + "bitmap.ts")
const proj = await import(P + "projection.ts")
const tm = await import(P + "tilemap.ts")
export const { createBitmap, put, hash, outline } = bm
const rw = await import(process.env.ISO_ROOT + "/packages/rewards/src/catalog.ts")
export const oakArt = rw.rewardItems.find((r: any) => r.id === "oak-tree").artifact
export function pad(b: Bmp) { const o = createBitmap(b.width + 2, b.height + 2); for (let y = 0; y < b.height; y++) o.rgba.set(b.rgba.subarray(y * b.width * 4, (y + 1) * b.width * 4), ((y + 1) * o.width + 1) * 4); return o }
export type Bmp = { width: number; height: number; rgba: Uint8Array }

export function shade(hex: string, f: number) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))).toString(16).padStart(2, "0")).join("")
}

/** An isometric box of footprint s tiles and height h, optionally with a window grid. */
export function isoBox(s: number, h: number, top: string, left: string, right: string, win?: { lit: string; dark: string; seed: number }) {
  const hw = Math.round(s * 16), hh = Math.round(s * 8)
  const b = createBitmap(hw * 2, hh * 2 + h)
  for (let x = 0; x < hw * 2; x++) {
    const dx = x - hw + 0.5, ad = Math.abs(dx)
    const y0 = Math.ceil(ad / 2), y1 = Math.floor(2 * hh - ad / 2)
    for (let y = y0; y <= y1; y++) put(b, x, y, y === y0 ? shade(top, 0.25) : top)
    for (let y = y1 + 1; y <= y1 + h; y++) {
      const lx = dx < 0 ? x : x - hw, ly = y - y1
      let c = dx < 0 ? left : right
      if (win && ly > 3 && ly < h - 2 && lx % 4 >= 1 && lx % 4 <= 2 && ly % 5 >= 2 && ly % 5 <= 3)
        c = hash(x, Math.floor(ly / 5), win.seed) > 0.62 ? win.lit : win.dark
      if (ad < 1) c = shade(right, 0.18)
      put(b, x, y, c)
    }
  }
  return { bitmap: b, anchorX: hw, anchorY: hh + h }
}

/** Sprite from character rows. */
export function fromRows(rows: string[], pal: Record<string, string>) {
  const b = createBitmap(rows[0].length, rows.length)
  rows.forEach((r, y) => [...r].forEach((k, x) => { if (k !== "." && pal[k]) put(b, x, y, pal[k]) }))
  return b
}

/** Stack sprites (bottom first) into one, centred on a common axis. */
export function stack(parts: { bitmap: Bmp; anchorX: number; anchorY: number; rise: number }[]) {
  const W = Math.max(...parts.map((p) => p.bitmap.width)) + 2
  const H = Math.max(...parts.map((p) => p.rise + p.anchorY)) + Math.max(...parts.map((p) => p.bitmap.height - p.anchorY)) + 2
  const baseY = H - Math.max(...parts.map((p) => p.bitmap.height - p.anchorY)) - 1
  const b = createBitmap(W, H)
  const cx = Math.floor(W / 2)
  for (const p of parts) {
    const ox = cx - p.anchorX, oy = baseY - p.rise - p.anchorY
    for (let y = 0; y < p.bitmap.height; y++) for (let x = 0; x < p.bitmap.width; x++) {
      const i = (y * p.bitmap.width + x) * 4
      if (p.bitmap.rgba[i + 3]) { const o = ((oy + y) * W + ox + x) * 4; b.rgba.set(p.bitmap.rgba.subarray(i, i + 4), o) }
    }
  }
  return { bitmap: b, anchorX: cx, anchorY: baseY }
}

export function drawableAt(frame: any, map: any, key: string, sp: { bitmap: Bmp; anchorX: number; anchorY: number }, u: number, v: number, shadow?: number) {
  const lift = Math.max(0, tm.tileAt(map, Math.floor(u), Math.floor(v))?.lift ?? 0)
  const p = proj.isoToScreen(frame, u, v, lift)
  const x = Math.round(p.x - sp.anchorX), y = Math.round(p.y - sp.anchorY)
  return { key, source: { type: "bitmap", bitmap: sp.bitmap }, depth: u + v, x, y, width: sp.bitmap.width, height: sp.bitmap.height, baseX: Math.round(p.x), baseY: Math.round(p.y), top: y, shadow }
}

/** Remove trees/bushes/rocks near (u,v) so a landmark can stand there. */
export function clearAround(ds: any[], u: number, v: number, r: number) {
  return ds.filter((d) => {
    const m = /^prop-(\d+)-(\d+)$/.exec(d.key)
    if (!m) return true
    return Math.hypot(+m[1] + 0.5 - u, +m[2] + 0.5 - v) > r
  })
}

/** Recolour an art palette by mapping each hex through f. */
export const recolor = (art: any, f: (hex: string, key: string) => string) => ({ ...art, palette: Object.fromEntries(Object.entries(art.palette).map(([k, h]: any) => [k, f(h, k)])) })

export function isGreen(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return g > r + 8 && g > b
}

/** Tint a hex towards a target hue, keeping its lightness. */
export function toHue(hex: string, target: string, keep = 0.35) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const t = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16))
  const l = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255
  const tl = (t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11) / 255
  return "#" + t.map((v, i) => Math.max(0, Math.min(255, Math.round((v * (l / tl)) * (1 - keep) + c[i] * keep)))).map((v) => v.toString(16).padStart(2, "0")).join("")
}

/** Snow caps: whiten the top 1–2 opaque pixels of every column of a bitmap. */
export function snowBitmap(b: Bmp, depth = 2) {
  const o = { width: b.width, height: b.height, rgba: b.rgba.slice() }
  for (let x = 0; x < b.width; x++) {
    let run = 0
    for (let y = 0; y < b.height; y++) {
      const a = b.rgba[(y * b.width + x) * 4 + 3]
      if (a && (y === 0 || !b.rgba[((y - 1) * b.width + x) * 4 + 3])) run = depth
      if (a && run > 0) { const i = (y * b.width + x) * 4; o.rgba.set(run === depth ? [255, 255, 255, 255] : [226, 236, 246, 255], i); run-- }
    }
  }
  return o
}
export function snowArt(art: any) {
  const rows = art.pixels.map((r: string) => [...r])
  const H = rows.length, Wd = rows[0].length
  for (let x = 0; x < Wd; x++) for (let y = 0; y < H; y++)
    if (rows[y][x] !== "." && (y === 0 || art.pixels[y - 1][x] === ".")) { rows[y][x] = "~"; if (y + 1 < H && art.pixels[y + 1][x] !== "." && hash(x, y, 7) > 0.4) rows[y + 1][x] = "^" }
  return { ...art, pixels: rows.map((r: string[]) => r.join("")), palette: { ...art.palette, "~": "#ffffff", "^": "#dde9f3" } }
}

export function seaFrom(base: string, crest: string, light: string, extra?: (b: Bmp) => void) {
  const b = createBitmap(64, 32)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) put(b, x, y, (x + y * 2) % 7 === 0 && hash(x >> 3, y, 61) > 0.93 ? shade(base, 0.06) : base)
  for (const [x, y] of [[6, 5], [38, 9], [22, 19], [52, 25], [10, 27]]) {
    for (let i = 0; i < 5; i++) put(b, (x + i) % 64, y, i === 0 || i === 4 ? crest : light)
    put(b, (x + 1) % 64, y - 1, crest)
  }
  extra?.(b)
  return b
}
