import * as h from "./helpers.ts"
export default {
  setup({ paint }: any) {
    const p = paint.palette
    p.grass = ["#c9d8e6", "#d7e3ee", "#e2ebf3", "#ecf2f8", "#f6f9fc"]
    p.grassLight = "#ffffff"
    p.forest = ["#bccddd", "#c9d8e6", "#d5e1ec", "#e0e9f2"]
    p.petals = ["#a8c4dc", "#bcd3e6", "#ffffff", "#9fb8cf"]
    p.sand = ["#cfdbe6", "#d9e3ec", "#e3ebf2", "#eef3f8"]
    p.water = ["#8db6cf", "#a3c6da", "#b8d5e5", "#cfe4ef", "#eef7fb"]
    p.dirt = ["#9a8f86", "#ada39a", "#c0b8b0", "#d3ccc5"]
    p.pebble = "#e6e1da"
  },
  sea: () => h.seaFrom("#1f3c55", "#2c4d68", "#5f7f99", (b) => {
    for (const [x, y, w] of [[12, 12, 7], [44, 20, 9], [30, 3, 5]] as number[][])
      for (let i = 0; i < w; i++) { h.put(b, x + i, y, "#e8f0f6"); if (i > 0 && i < w - 1) h.put(b, x + i, y + 1, "#b9cbd9") }
  }),
  glint: "#ffffff",
  shadow: "#5a6f86",
  art: (art: any, d: any) => (d.key.startsWith("reward") || /oak|pine|tree/.test(d.key) || /prop/.test(d.key) ? h.snowArt(art) : h.snowArt(art)),
  bitmap: (b: any, d: any) => (d.key.startsWith("block-") ? b : h.snowBitmap(b, d.hit?.type === "house" ? 4 : 2)),
  drawables({ map, frame, drawables }: any) {
    const ds = [...drawables]
    const snowman = h.pad(h.fromRows([
      "....kkk....",
      "...kkkkk...",
      "..kkkkkkk..",
      "...wwwww...",
      "..wwkwkww..",
      "..wwwowww..",
      "...wwwww...",
      "..rrrrrrr..",
      ".wwwwwwwrr.",
      "wwwwkwwwwrw",
      "wwwwwwwwwww",
      "wwwwkwwwwww",
      ".wwwwwwwww.",
      "wwwwwwwwwww",
      "wwwwwwwwwww",
      ".wwwwwwwww.",
    ], { k: "#2a2a33", w: "#f8fbfd", o: "#ee7d2b", r: "#c8333a" }))
    // Shade the right side.
    for (let y = 0; y < snowman.height; y++) for (let x = 7; x < snowman.width; x++) {
      const i = (y * snowman.width + x) * 4
      if (snowman.rgba[i + 3] && snowman.rgba[i] > 240) snowman.rgba.set([214, 226, 238, 255], i)
    }
    h.outline(snowman, "#4a5a70")
    ds.push(h.drawableAt(frame, map, "snowman", { bitmap: snowman, anchorX: 6, anchorY: 16 }, 11.0, 3.4, 10))
    const sled = h.fromRows(["r.......", "rrrrrrrr", ".k....k.", "kkkkkkkk"], { r: "#b8452f", k: "#5a3a26" })
    ds.push(h.drawableAt(frame, map, "sled", { bitmap: sled, anchorX: 4, anchorY: 3 }, 11.9, 4.1, 8))
    return ds
  },
  overlay({ blend, frame, hex }: any) {
    // Falling snow.
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(h.hash(i, 1, 91) * (frame.width + 48)) - 24
      const y = Math.floor(h.hash(i, 2, 92) * (frame.height + 48)) - 24
      blend(x, y, hex("#ffffff"), 0.85)
      if (h.hash(i, 3, 93) > 0.7) blend(x + 1, y, hex("#ffffff"), 0.5)
    }
  },
}
