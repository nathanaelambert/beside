import { writeFileSync } from "node:fs"
const W = process.env.ISO_ROOT + "/apps/mobile/app/components/iso-world/"
const paint = await import(W + "paint.ts")
const scene = await import(W + "scene.ts")
const av = await import(process.env.ISO_ROOT + "/apps/mobile/app/components/pixel-world/avatars.ts")
const garden = await import(process.env.ISO_ROOT + "/packages/domain/src/garden.ts")
const themeId = process.argv[2] ?? "default"
const theme = themeId === "default" ? null : (await import(`./themes/${themeId}.ts`)).default

theme?.setup?.({ paint, scene })

const members = ["Maya", "Leo", "Pritesh Parmar", "Vaibhav Kapoor"].map((name, i) => ({ id: String(i), name }))
const avatars = av.avatarsForMembers(members)
const { map, frame, drawables: base } = scene.buildHomeScene({
  avatars,
  items: garden.initialMeadowItems,
  rewards: [
    { id: "r1", itemId: "sunflower" },
    { id: "r2", itemId: "star-statue" },
    { id: "r3", itemId: "pink-tulip" },
  ],
  activities: [
    { id: "a1", name: "Saturday soccer", open: true },
    { id: "a2", name: "Book club" },
    { id: "a3", name: "Piano practice" },
  ],
})
let drawables = theme?.drawables ? scene.sortDrawables(theme.drawables({ map, frame, drawables: base, scene, paint })) : base

const M = 24
const OW = frame.width + M * 2, OH = frame.height + M * 2
const out = new Uint8Array(OW * OH * 4)
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
function blend(x: number, y: number, c: number[], a = 1) {
  x += M; y += M
  if (x < 0 || y < 0 || x >= OW || y >= OH) return
  const i = (y * OW + x) * 4
  for (let k = 0; k < 3; k++) out[i + k] = Math.round(out[i + k] * (1 - a) + c[k] * a)
  out[i + 3] = 255
}
const sea = theme?.sea ? theme.sea() : paint.seaTile()
for (let y = -M; y < frame.height + M; y++)
  for (let x = -M; x < frame.width + M; x++) {
    const sx = ((x % sea.width) + sea.width) % sea.width, sy = ((y % sea.height) + sea.height) % sea.height
    const i = (sy * sea.width + sx) * 4
    blend(x, y, [sea.rgba[i], sea.rgba[i + 1], sea.rgba[i + 2]])
  }
function bitmap(b: any, ox: number, oy: number) {
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
    const i = (y * b.width + x) * 4
    if (b.rgba[i + 3]) blend(ox + x, oy + y, [b.rgba[i], b.rgba[i + 1], b.rgba[i + 2]])
  }
}
function art(a: any, ox: number, oy: number) {
  a.pixels.forEach((row: string, y: number) => [...row].forEach((k, x) => { if (k !== ".") blend(ox + x, oy + y, hex(a.palette[k])) }))
}
theme?.onSea?.({ bitmap, blend, frame, hex })
bitmap(paint.paintGround(map, frame), 0, 0)
const glint = hex(theme?.glint ?? "#e9f6ec")
for (const g of paint.waterGlints(map, frame)) for (let i = 0; i < 3; i++) blend(g.x + i, g.y, glint, 0.8)
theme?.afterGround?.({ blend, frame, map, paint })
const shadow = hex(theme?.shadow ?? "#1c301e")
for (const d of drawables) {
  if (d.shadow) {
    const rx = d.shadow / 2, ry = Math.max(1.5, d.shadow / 6)
    for (let y = 0; y < Math.ceil(ry * 2); y++) {
      const dy = (y + 0.5 - ry) / ry
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)))
      for (let x = -half; x < half; x++) blend(d.baseX + x, d.baseY + y - Math.floor(ry), shadow, 0.32)
    }
  }
  const s = d.source
  if (s.type === "bitmap") bitmap(theme?.bitmap ? theme.bitmap(s.bitmap, d) : s.bitmap, d.x, d.y)
  else if (s.type === "art") art(theme?.art ? theme.art(s.art, d) : s.art, d.x, d.y)
  else art(s.avatar.frames.idle, d.x, d.y)
}
theme?.overlay?.({ blend, frame, hex })
writeFileSync(`out/${themeId}.rgba`, out)
writeFileSync(`out/${themeId}.json`, JSON.stringify({ w: OW, h: OH }))
console.log(themeId, OW, OH, drawables.length)
