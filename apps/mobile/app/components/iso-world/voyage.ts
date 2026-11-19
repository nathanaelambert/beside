import { islandPoint, onIsland, type IslandLayer } from "./archipelago"
import { screenToIso, type ScreenPoint } from "./projection"

export interface VoyagePath {
  /** Equally spaced samples of rounded quadratic curves, evaluated on the UI thread. */
  points: ScreenPoint[]
}

const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const mix = (a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Segment/land intersection in tile space, including the island's front slab. */
function crossesLand(a: ScreenPoint, b: ScreenPoint, island: IslandLayer) {
  return [0, -14].some((lift) => {
    const p = screenToIso(island.frame, a.x - island.offset.x, a.y - island.offset.y, lift)
    const q = screenToIso(island.frame, b.x - island.offset.x, b.y - island.offset.y, lift)
    let near = 0
    let far = 1
    for (const [start, delta, max] of [
      [p.u, q.u - p.u, island.map.cols],
      [p.v, q.v - p.v, island.map.rows],
    ]) {
      if (Math.abs(delta!) < 0.000001) {
        if (start! < 0 || start! > max!) return false
      } else {
        const t0 = -start! / delta!
        const t1 = (max! - start!) / delta!
        near = Math.max(near, Math.min(t0, t1))
        far = Math.min(far, Math.max(t0, t1))
        if (near > far) return false
      }
    }
    return near <= far
  })
}

function visible(a: ScreenPoint, b: ScreenPoint, islands: readonly IslandLayer[]) {
  return !islands.some((island) => crossesLand(a, b, island))
}

/** Route around every island, then round the corners in open water. No straight land crossing. */
export function voyagePath(
  from: IslandLayer,
  to: IslandLayer,
  islands: readonly IslandLayer[],
  mooring: { u: number; v: number; lift?: number },
): VoyagePath {
  const start = islandPoint(from, mooring.u, mooring.v, mooring.lift ?? -14)
  const end = islandPoint(to, mooring.u, mooring.v, mooring.lift ?? -14)
  if (islands.some((island) => onIsland(island, start) || onIsland(island, end))) {
    throw new Error("Boat moorings must be in open water")
  }
  // Visibility graph vertices sit well outside the slab. The generous clearance lets the
  // quadratic corners bend naturally without cutting across the land diamond.
  const nodes = [
    start,
    end,
    ...islands.flatMap((island) => {
      const pad = 2.5
      const { cols, rows } = island.map
      return [
        [-pad, -pad],
        [cols + pad, -pad],
        [cols + pad, rows + pad],
        [-pad, rows + pad],
      ].map(([u, v]) => islandPoint(island, u!, v!))
    }),
  ]
  const costs = nodes.map(() => Infinity)
  const previous = nodes.map(() => -1)
  const visited = new Set<number>()
  costs[0] = 0
  while (visited.size < nodes.length) {
    let current = -1
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || costs[i]! < costs[current]!)) current = i
    if (current < 0 || !Number.isFinite(costs[current])) break
    if (current === 1) break
    visited.add(current)
    nodes.forEach((node, next) => {
      if (visited.has(next) || next === current) return
      const cost = costs[current]! + distance(nodes[current]!, node)
      if (cost < costs[next]! && visible(nodes[current]!, node, islands)) {
        costs[next] = cost
        previous[next] = current
      }
    })
  }
  if (!Number.isFinite(costs[1])) throw new Error("No open-water route between moorings")
  const route = [end]
  for (let i = previous[1]!; i >= 0; i = previous[i]!) route.unshift(nodes[i]!)
  const samples: ScreenPoint[] = [start]
  const addCurve = (a: ScreenPoint, control: ScreenPoint, b: ScreenPoint) => {
    const count = Math.max(2, Math.ceil((distance(a, control) + distance(control, b)) / 2))
    for (let i = 1; i <= count; i++) {
      const t = i / count
      samples.push(mix(mix(a, control, t), mix(control, b, t), t))
    }
  }
  let cursor = start
  for (let i = 1; i < route.length - 1; i++) {
    const before = route[i - 1]!
    const corner = route[i]!
    const after = route[i + 1]!
    let radius = Math.min(36, distance(before, corner) / 4, distance(corner, after) / 4)
    let entry = mix(corner, before, radius / distance(before, corner))
    let exit = mix(corner, after, radius / distance(corner, after))
    // A rounded corner's chord encloses the curve; require that chord to be in water too.
    while (!visible(entry, exit, islands) && radius > 0.5) {
      radius /= 2
      entry = mix(corner, before, radius / distance(before, corner))
      exit = mix(corner, after, radius / distance(corner, after))
    }
    addCurve(cursor, mix(cursor, entry, 0.5), entry)
    addCurve(entry, corner, exit)
    cursor = exit
  }
  addCurve(cursor, mix(cursor, end, 0.5), end)
  const lengths = [0]
  samples.slice(1).forEach((p, i) => lengths.push(lengths[i]! + distance(samples[i]!, p)))
  const total = lengths[lengths.length - 1]!
  const count = Math.max(2, Math.ceil(total / 2))
  let segment = 1
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const target = (total * i) / count
    while (segment < samples.length - 1 && lengths[segment]! < target) segment++
    const span = lengths[segment]! - lengths[segment - 1]!
    return mix(
      samples[segment - 1]!,
      samples[segment]!,
      span ? (target - lengths[segment - 1]!) / span : 0,
    )
  })
  return { points }
}

export function voyagePoint(path: VoyagePath, progress: number): ScreenPoint {
  "worklet"
  const index = Math.max(0, Math.min(1, progress)) * (path.points.length - 1)
  const a = path.points[Math.floor(index)]!
  const b = path.points[Math.min(path.points.length - 1, Math.floor(index) + 1)]!
  const t = index - Math.floor(index)
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) }
}
