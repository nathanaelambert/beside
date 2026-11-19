import * as h from "./helpers.ts"
const maple = ["#7a1f1a", "#a8321f", "#cf4a24", "#e8742f", "#f2a23c"]
export default {
  setup({ paint }: any) {
    paint.palette.blanket = ["#7e1d1d", "#c8102e", "#e9e2d8", "#f7f3ec"]
    paint.palette.water = ["#2f6a86", "#3a7a96", "#4a8ca8", "#64a2bb", "#a6d4e2"]
    paint.palette.stoneLeft = ["#a7a29a", "#958f87", "#857f77"]
    paint.palette.stoneRight = ["#7f7a73", "#726d66", "#66615b"]
  },
  sea: () => h.seaFrom("#3a6f86", "#4b8299", "#79a9ba"),
  glint: "#dff3f8",
  art(art: any, d: any) {
    if (art === h.oakArt)
      return h.recolor(art, (c) => (h.isGreen(c) ? h.toHue(c, "#d2482a", 0.15) : c))
    if (/banner/.test(d.key)) return h.recolor(art, (c) => { const b = parseInt(c.slice(5, 7), 16), r = parseInt(c.slice(1, 3), 16); return b > r + 30 ? "#c8102e" : c })
    return art
  },
  drawables({ map, frame, drawables }: any) {
    const spots: [number, number, number, number][] = [
      // u, v, footprint, height
      [3.5, 0.6, 0.7, 46], [5.4, 0.55, 0.8, 70], [7.2, 0.6, 0.6, 54],
      [11.6, 0.55, 0.75, 82], [13.4, 0.6, 0.65, 58], [15.3, 0.7, 0.8, 40],
      [0.6, 3.2, 0.6, 36], [0.6, 5.4, 0.7, 30],
    ]
    let ds = drawables
    const glass = [
      ["#9fb8c9", "#6f8ea4", "#4e6b80"], ["#c9c2b4", "#a59d8d", "#857d6e"], ["#7ea6bf", "#557d97", "#3d5f78"], ["#b9c7cf", "#8d9fab", "#6b7e8b"],
    ]
    for (const [u, v] of [...spots.map((s) => [s[0], s[1]]), [9.5, 0.5]] as [number, number][]) ds = h.clearAround(ds, u, v, 1.0)
    spots.forEach(([u, v, s, hgt], i) => {
      const [t, l, r] = glass[i % glass.length]
      ds.push(h.drawableAt(frame, map, `tower-${i}`, h.isoBox(s, hgt, t, l, r, { lit: "#f4e4a6", dark: h.shade(r, -0.25), seed: i + 3 }), u, v))
    })
    // CN Tower: tapered shaft, pod, antenna.
    const H = 150, W = 22, b = h.createBitmap(W, H), cx = 11
    const conc = ["#e3e0da", "#c9c5bd", "#a8a39a"]
    for (let y = 0; y < H; y++) {
      const t = y / H
      let half = 0, col = conc
      if (y < 34) half = y < 6 ? 0 : 1           // antenna
      else if (y < 40) half = 3                    // sky pod
      else if (y < 46) half = 1
      else if (y < 58) half = y < 50 ? 9 : y < 54 ? 10 : 7   // main pod
      else half = Math.round(2 + (t - 0.38) * 6)  // shaft widens to base
      if (y < 6) { h.put(b, cx, y, "#d23a2a"); continue }
      for (let x = -half; x <= half; x++) {
        let c = x < 0 ? col[0] : x === 0 ? col[1] : col[2]
        if (y >= 46 && y < 58 && (y === 50 || y === 51)) c = "#3c4a58"
        if (y >= 46 && y < 58 && y === 46) c = "#f2f0ea"
        h.put(b, cx + x, y, c)
      }
    }
    ds.push(h.drawableAt(frame, map, "cn-tower", { bitmap: b, anchorX: cx, anchorY: H - 1 }, 9.5, 0.5))
    return ds
  },
  onSea({ bitmap }: any) {
    const ferry = h.fromRows([
      "......wwww..........",
      "....wwwwwwwwww......",
      "..dddddddddddddddd..",
      "rrrrrrrrrrrrrrrrrrrr",
      ".kkkkkkkkkkkkkkkkkk.",
      "..kkkkkkkkkkkkkkkk..",
    ], { w: "#f4f1ea", d: "#2c3e50", r: "#c8102e", k: "#1f2a33" })
    bitmap(ferry, 40, 300); bitmap(ferry, 500, 330)
    const sail = h.fromRows(["...w...", "...ww..", "...www.", "...wwww", "...wwww", "...wwww", "kkkkkkk", ".kkkkk."], { w: "#ffffff", k: "#7a4b2a" })
    bitmap(sail, 520, 40); bitmap(sail, 70, 60); bitmap(sail, 110, 360)
  },
}
