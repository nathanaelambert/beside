import { writeFileSync } from "node:fs"
const W = process.env.ISO_ROOT + "/apps/mobile/app/components/iso-world/"
const paint = await import(W + "paint.ts")
const scene = await import(W + "scene.ts")
const proj = await import(W + "projection.ts")
const tm = await import(W + "tilemap.ts")
const av = await import(process.env.ISO_ROOT + "/apps/mobile/app/components/pixel-world/avatars.ts")
const garden = await import(process.env.ISO_ROOT + "/packages/domain/src/garden.ts")
const h = await import("./themes/helpers.ts")
const mode = process.argv[2] // "zone" | "islet"

const cousins = av.avatarsForMembers(["Maya", "Leo", "Pritesh Parmar", "Vaibhav Kapoor"].map((name, i) => ({ id: String(i), name })))
const grade5 = av.avatarsForMembers(["Ava", "Sam", "Noor"].map((name, i) => ({ id: "g" + i, name }))).map((a: any, i: number) => ({ ...a, frames: av.memberAvatarStyles[(i + 2) % 4].frames, key: "g5-" + i }))

const home = scene.buildHomeScene({
  avatars: cousins, items: garden.initialMeadowItems,
  rewards: [{ id: "r1", itemId: "sunflower" }, { id: "r2", itemId: "star-statue" }],
  activities: [{ id: "a1", name: "Saturday soccer" }, { id: "a2", name: "Book club" }],
})
const { map, frame } = home
let drawables: any[] = home.drawables

const ML = 24, MT = 24, MR = mode === "islet" ? 230 : 24, MB = 24
const OW = frame.width + ML + MR, OH = frame.height + MT + MB
const out = new Uint8Array(OW * OH * 4)
const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
function blend(x: number, y: number, c: number[], a = 1) {
  x += ML; y += MT
  if (x < 0 || y < 0 || x >= OW || y >= OH) return
  const i = (y * OW + x) * 4
  for (let k = 0; k < 3; k++) out[i + k] = Math.round(out[i + k] * (1 - a) + c[k] * a)
  out[i + 3] = 255
}
const bitmap = (b: any, ox: number, oy: number) => { for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) { const i = (y * b.width + x) * 4; if (b.rgba[i + 3]) blend(ox + x, oy + y, [b.rgba[i], b.rgba[i + 1], b.rgba[i + 2]]) } }
const art = (a: any, ox: number, oy: number) => a.pixels.forEach((r: string, y: number) => [...r].forEach((k, x) => { if (k !== ".") blend(ox + x, oy + y, hex(a.palette[k])) }))
function drawAll(ds: any[], dx = 0, dy = 0) {
  for (const d of ds) {
    if (d.shadow) { const rx = d.shadow / 2, ry = Math.max(1.5, d.shadow / 6)
      for (let y = 0; y < Math.ceil(ry * 2); y++) { const q = (y + 0.5 - ry) / ry, half = Math.round(rx * Math.sqrt(Math.max(0, 1 - q * q)))
        for (let x = -half; x < half; x++) blend(d.baseX + dx + x, d.baseY + dy + y - Math.floor(ry), hex("#1c301e"), 0.32) } }
    const s = d.source
    if (s.type === "bitmap") bitmap(s.bitmap, d.x + dx, d.y + dy)
    else if (s.type === "art") art(s.art, d.x + dx, d.y + dy)
    else art(s.avatar.frames.idle, d.x + dx, d.y + dy)
  }
}
function diamond(fr: any, col: number, row: number, c: number[], a: number, dx = 0, dy = 0, lift = 0) {
  const top = proj.isoToScreen(fr, col, row, lift)
  for (let y = 0; y <= 16; y++) { const w = y <= 8 ? y * 2 : (16 - y) * 2
    for (let x = -w; x < w; x++) blend(Math.round(top.x) + x + dx, Math.round(top.y) + y + dy, c, a) }
}
const sea = paint.seaTile()
for (let y = -MT; y < OH - MT; y++) for (let x = -ML; x < OW - ML; x++) { const i = (((y % 32) + 32) % 32 * 64 + (((x % 64) + 64) % 64)) * 4; blend(x, y, [sea.rgba[i], sea.rgba[i + 1], sea.rgba[i + 2]]) }
bitmap(paint.paintGround(map, frame), 0, 0)
for (const g of paint.waterGlints(map, frame)) for (let i = 0; i < 3; i++) blend(g.x + i, g.y, hex("#e9f6ec"), 0.8)

const signpost = h.fromRows([
  "kkkkkkkkkkkk.", "kyyyyyyyyyyk.", "kyrrrryybbyyk", "kyyyyyyyyyyk.", "kkkkkkkkkkkk.",
  ".....kk......", ".....kk......", ".....kk......", ".....kk......", "....kkkk.....",
], { k: "#4a3424", y: "#e8c98a", r: "#c4677b", b: "#43659a" })
const sp = (b: any) => ({ bitmap: b, anchorX: Math.floor(b.width / 2), anchorY: b.height - 1 })
const sharedReward = { id: "joint", itemId: "owl-statue" }

if (mode === "zone") {
  // East third (cols 12–16, rows 2–13) becomes the joint plot; tint + fence posts on the seam.
  for (const t of map.tiles) if (t.col >= 12 && t.col <= 16 && t.row >= 2 && t.row <= 6 && !tm.tileAt(map, t.col, t.row) .lift) diamond(frame, t.col, t.row, hex("#f2c96b"), 0.16)
  drawables = h.clearAround(drawables, 14.5, 4.5, 2.5).filter((d: any) => !(d.key === "pine-east"))
  const post = h.fromRows(["kk", "yy", "kk", "yy", "kk", "kk"], { k: "#6b4a33", y: "#d9b98a" })
  for (let v = 2.1; v <= 6.9; v += 0.6) drawables.push(h.drawableAt(frame, map, `fence-w-${v}`, sp(post), 12.05, v))
  for (let u = 12.1; u <= 16.9; u += 0.6) drawables.push(h.drawableAt(frame, map, `fence-s-${u}`, sp(post), u, 6.95))
  drawables.push(h.drawableAt(frame, map, "sign", sp(signpost), 12.3, 7.4, 8))
  // Joint activity cottage with a two-tone roof (one colour per home base) and the joint reward.
  drawables.push({ ...h.drawableAt(frame, map, "joint-house", { bitmap: scene.houseSprite("slate", true).bitmap, anchorX: scene.houseSprite("slate", true).anchorX, anchorY: scene.houseSprite("slate", true).anchorY }, 15.5, 3.2) })
  drawables.push(h.drawableAt(frame, map, "joint-owl", { bitmap: h.fromRows(["."], {}), anchorX: 0, anchorY: 0 }, 0, 0))
  const owl = scene.catalogue.get("owl-statue").artifact
  drawables = drawables.filter((d: any) => d.key !== "owl")
  const o = proj.isoToScreen(frame, 13.6, 3.0)
  drawables.push({ key: "j-owl", source: { type: "art", art: owl }, depth: 16.6, x: Math.round(o.x - 16), y: Math.round(o.y - 29), width: 32, height: 32, baseX: Math.round(o.x), baseY: Math.round(o.y), top: 0, shadow: 12 })
  // Visiting Grade 5 kids stand in the plot (half-opacity = visiting, not members).
  const spots = [[13.4, 4.9], [14.3, 5.3], [15.2, 5.6]]
  grade5.forEach((a: any, i: number) => { const [u, v] = spots[i]; const p = proj.isoToScreen(frame, u, v); drawables.push({ key: a.key, source: { type: "avatar", avatar: a }, depth: u + v, x: Math.round(p.x - 8), y: Math.round(p.y - 19), width: 16, height: 20, baseX: Math.round(p.x), baseY: Math.round(p.y), top: 0, shadow: 12 }) })
  drawAll(scene.sortDrawables(drawables))
} else {
  // A shared islet east of the island, reached by a plank bridge. Same iso grid: plot (0,0) sits at island (21, 4.5).
  const islet = scene.buildActivityScene({ roof: "slate", lit: true, attendees: [...cousins.slice(0, 2), ...grade5] })
  const ip = islet.frame
  const anchorMain = proj.isoToScreen(frame, 21, 4.5), anchorIslet = proj.isoToScreen(ip, 0, 0)
  const dx = Math.round(anchorMain.x - anchorIslet.x), dy = Math.round(anchorMain.y - anchorIslet.y)
  // Bridge planks from the island's east edge (col 17, row 6) to the islet.
  const plank = hex("#946a45"), dark = hex("#5b3e29")
  for (let u = 17.6; u < 21.2; u += 0.25) {
    for (let v = 6.25; v <= 6.85; v += 0.05) { const p = proj.isoToScreen(frame, u, v, 2); blend(Math.round(p.x), Math.round(p.y), Math.round(u * 4) % 2 ? plank : hex("#ab8155")) }
    const a = proj.isoToScreen(frame, u, 6.25, 2), b = proj.isoToScreen(frame, u, 6.85, 2)
    for (let y = 0; y < 4; y++) { blend(Math.round(a.x), Math.round(a.y) + 1 + y, dark); blend(Math.round(b.x), Math.round(b.y) + 1 + y, dark) }
  }
  // The islet pulls drawables from the island's rim at the bridge foot.
  drawables = h.clearAround(drawables, 17.5, 6.5, 1.2)
  drawables.push(h.drawableAt(frame, map, "sign", sp(signpost), 16.4, 7.4, 8))
  bitmap(paint.paintGround(islet.map, ip), dx, dy)
  drawAll(scene.sortDrawables(drawables))
  const rw = scene.itemDrawable(ip, islet.map, "j-owl", "owl-statue", 3.6, 1.6)
  drawAll(scene.sortDrawables([...islet.drawables, ...(rw ? [rw] : [])]), dx, dy)
}
writeFileSync(`out/split-${mode}.rgba`, out); writeFileSync(`out/split-${mode}.json`, JSON.stringify({ w: OW, h: OH }))
console.log(mode, OW, OH)
