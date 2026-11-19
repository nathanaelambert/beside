import * as h from "./helpers.ts"
export default {
  setup({ paint, scene }: any) {
    const p = paint.palette
    p.grass = ["#5a7d45", "#678b4e", "#749857", "#84a660", "#97b66e"]
    p.petals = ["#f7d3df", "#f2b6c8", "#fbe6ee", "#e893ad"]
    p.plank = ["#7a1f14", "#a3301d", "#c2412a", "#d65a3c"]
    p.blanket = ["#1e2a52", "#2f3f78", "#e9e4d6", "#f6f1e4"]
    p.dirt = ["#8a7a64", "#a39279", "#b9a88d", "#cdbda1"]
    p.pebble = "#e6dccb"
  },
  sea: () => h.seaFrom("#24525e", "#326573", "#5e8f98"),
  glint: "#f7d3df",
  art(art: any, d: any) {
    if (art === h.oakArt)
      return h.recolor(art, (c) => (h.isGreen(c) ? h.toHue(c, "#f0a3bd", 0.1) : c))
    if (/tulip/.test(d.key)) return art
    return art
  },
  bitmap(b: any, d: any) {
    // Grey kawara roofs on every cottage.
    if (!/^(a\d|plot)/.test(d.key) && d.hit?.type !== "house") return b
    const o = { ...b, rgba: b.rgba.slice() }
    for (let i = 0; i < o.rgba.length; i += 4) {
      const [r, g, bb] = [o.rgba[i], o.rgba[i + 1], o.rgba[i + 2]]
      const sat = Math.max(r, g, bb) - Math.min(r, g, bb)
      // Roof pixels are the saturated ones that are not wall plaster or windows.
      if (o.rgba[i + 3] && sat > 40 && !(r > 200 && g > 190) && !(bb > r + 30 && bb > 150) && !(r > 230 && g > 200)) {
        const l = r * 0.3 + g * 0.59 + bb * 0.11
        o.rgba[i] = l * 0.62 + 10; o.rgba[i + 1] = l * 0.66 + 14; o.rgba[i + 2] = l * 0.78 + 22
      }
    }
    return o
  },
  drawables({ map, frame, drawables }: any) {
    let ds = h.clearAround(drawables, 9.5, 0.5, 1.6)
    // Five-storey pagoda: stacked boxes with wide dark eaves.
    const parts: any[] = []
    let rise = 0
    for (let i = 0; i < 5; i++) {
      const s = 0.78 - i * 0.09
      const body = h.isoBox(s, 13, "#3b3f4a", "#b8482f", "#8e3423")
      parts.push({ ...body, rise })
      rise += 13
      const eave = h.isoBox(s + 0.34, 3, "#3e4350", "#2b2f39", "#22252d")
      parts.push({ ...eave, rise })
      rise += 5
    }
    const spire = { bitmap: h.fromRows([".y.", ".y.", "yyy", ".y.", "yyy", ".y.", ".y.", ".y.", ".y.", ".y.", ".y.", ".y."], { y: "#c9a54a" }), anchorX: 1, anchorY: 11, rise: rise + 4 }
    parts.push(spire)
    ds.push(h.drawableAt(frame, map, "pagoda", h.stack(parts), 9.5, 0.5))
    // Torii on the path.
    const torii = h.fromRows([
      "kkkkkkkkkkkkkkkkkkkkkk",
      ".kvvvvvvvvvvvvvvvvvvk.",
      "...vv....vvvv....vv...",
      "..vvvvvvvvvvvvvvvvvv..",
      "...vv............vv...",
      ...Array(18).fill("...vv............vv..."),
      "..kkkk..........kkkk..",
    ], { k: "#1f1a1a", v: "#d2452a" })
    ds = h.clearAround(ds, 8.5, 12.6, 0.5)
    ds.push(h.drawableAt(frame, map, "torii", { bitmap: torii, anchorX: 11, anchorY: torii.height - 1 }, 8.5, 12.4, 18))
    // Stone lanterns by the pond.
    const lantern = h.fromRows([".sss.", "sssss", ".sys.", ".sys.", "..s..", ".sss.", "sssss"], { s: "#9a978f", y: "#f6d77a" })
    for (const [u, v] of [[12.7, 7.4], [15.6, 8.3], [11.3, 9.6]]) ds.push(h.drawableAt(frame, map, `lantern-${u}`, { bitmap: lantern, anchorX: 2, anchorY: 6 }, u, v, 6))
    // Bamboo along the left rim.
    const bamboo = h.fromRows(Array.from({ length: 30 }, (_, y) => (y % 7 === 0 ? ".lllgg." : y < 8 && y % 3 === 0 ? "gg.g.gg" : "..lg.g.")), { l: "#a9c46a", g: "#6f9a3e" })
    ds = h.clearAround(ds, 0.5, 4.5, 1.2)
    for (const v of [3.6, 4.4, 5.2]) ds.push(h.drawableAt(frame, map, `bamboo-${v}`, { bitmap: bamboo, anchorX: 3, anchorY: 29 }, 0.5, v))
    return ds
  },
}
