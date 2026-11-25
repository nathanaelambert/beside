import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import { initialMeadowItems } from "@beside/api-client/garden"
import { sameHomeCoastTile, type HomebaseExpansion } from "@beside/api-client/homebase-expansion"
import { useFocusEffect } from "@react-navigation/native"

import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { loadString, saveString } from "@/utils/storage"

import { archipelagoLayout, type IslandLayer } from "./archipelago"
import { islandSign, islandVariantSeed, JETTY, jetty } from "./archipelagoProps"
import { jettyTimberGrade } from "./harborArt"
import { homeActivities, rewardKey } from "./homeWorld"
import { assignIslandPalettes, recolorTerrain } from "./islandPalettes"
import { gardenGrowthDeadline, plantArtStage } from "./plantGrowth"
import {
  buildHomeScene,
  catalogue,
  sortDrawables,
  spriteDrawable,
  type HomeGardenItem,
} from "./scene"
import { useCottageClock } from "./useCottageClock"
import { worldArtAssets } from "./worldArtAssets"
import { detailedSpriteBitmap } from "./worldDetailArt"
import { avatarsForMembers, memberAvatarAppearances } from "../pixel-world/avatars"
import { detailedAvatar } from "../pixel-world/detailedAvatars"
import { oakAt } from "../pixel-world/starterOak"

type ArchipelagoData = {
  bases: ApiHomebase[]
  state: ApiState
  receivedAt: number
  gardens: Record<string, HomebaseGarden | undefined>
  expansions: Record<string, HomebaseExpansion | undefined>
  /** Membership order: islands keep fixed places on the map, wherever you open. */
  order: string[]
}

/** Coastline is append-only; a slow read cannot erase a confirmed tile. */
function mergeExpansion(previous?: HomebaseExpansion, latest?: HomebaseExpansion) {
  if (!previous) return latest
  if (!latest) return previous
  const newTiles = latest.additions.filter(
    (tile) => !previous.additions.some((added) => sameHomeCoastTile(tile, added)),
  )
  return newTiles.length ? { additions: [...previous.additions, ...newTiles] } : previous
}

export function useHomeArchipelago(
  userId: string | undefined,
  connectionId: string | undefined,
  attempt: number,
) {
  const [data, setData] = useState<ArchipelagoData | null>(null)
  const [focusedId, setFocusedId] = useState<string>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const gardenRevisions = useRef(new Map<string, number>())
  const gardenRequests = useRef(new Map<string, number>())
  const requested = useRef(connectionId)
  requested.current = connectionId
  const currentFocus = useRef<string | undefined>(undefined)
  const storageKey = `homebase.focus.${userId ?? "anonymous"}`

  const focusIsland = useCallback(
    (id: string) => {
      currentFocus.current = id
      setFocusedId(id)
      saveString(storageKey, id)
    },
    [storageKey],
  )

  useEffect(() => {
    if (connectionId && data?.bases.some((base) => base.id === connectionId))
      focusIsland(connectionId)
    // Only explicit route changes move the focus. Garden refreshes preserve an ongoing trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId])

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      Promise.all([
        besideApi.homebases(),
        besideApi.state().then((state) => ({ state, receivedAt: performance.now() })),
      ])
        .then(async ([bases, { state, receivedAt }]) => {
          if (!active) return
          const revisions = new Map(gardenRevisions.current)
          const missing = new Set<string>()
          const [gardens, expansions] = await Promise.all([
            Promise.all(
              bases.map(async (base) => {
                try {
                  return [base.id, await besideApi.homebaseGarden(base.id)] as const
                } catch (e) {
                  if (e instanceof ApiError && e.status === 404) missing.add(base.id)
                  if (active)
                    setError(
                      e instanceof ApiError && e.status === 404
                        ? "This home base is no longer available. Please try again."
                        : "We couldn’t load garden decorations. Please try again.",
                    )
                  return [base.id, undefined] as const
                }
              }),
            ),
            Promise.all(
              bases.map(
                async (base) =>
                  [
                    base.id,
                    await besideApi.homebaseExpansion(base.id).catch(() => undefined),
                  ] as const,
              ),
            ),
          ])
          if (!active) return
          // A single island keeps #34's atomic first frame, including its saved garden.
          const available = bases.filter((candidate) => !missing.has(candidate.id))
          // Read focus after the requests: a deep link may have changed while loading.
          const preferred =
            requested.current ?? currentFocus.current ?? loadString(storageKey) ?? undefined
          const base = selectHomebase(available, state.users, preferred)
          if (base) focusIsland(base.id)
          setData((current) => ({
            bases: available,
            state,
            receivedAt,
            gardens: Object.fromEntries(
              gardens.map(([id, garden]) => [
                id,
                gardenRevisions.current.get(id) === revisions.get(id)
                  ? garden
                  : current?.gardens[id],
              ]),
            ),
            expansions: Object.fromEntries(
              expansions.map(([id, expansion]) => [
                id,
                mergeExpansion(current?.expansions[id], expansion),
              ]),
            ),
            order: available.map((b) => b.id),
          }))
        })
        .catch(() => {
          if (active) {
            setData(null)
            setError("We couldn’t open your home base. Please try again.")
          }
        })
        .finally(() => {
          if (active) setBusy(false)
        })
      return () => {
        active = false
      }
    }, [attempt, storageKey, focusIsland]),
  )

  const acceptExpansion = useCallback((id: string, expansion: HomebaseExpansion) => {
    setData((current) => {
      if (!current?.bases.some((base) => base.id === id)) return current
      const previous = current.expansions[id]
      const merged = mergeExpansion(previous, expansion)
      return merged === previous
        ? current
        : { ...current, expansions: { ...current.expansions, [id]: merged } }
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!focusedId || busy) return
      let active = true
      let pending = false
      async function refresh() {
        if (!focusedId || pending) return
        pending = true
        try {
          const expansion = await besideApi.homebaseExpansion(focusedId)
          if (active) acceptExpansion(focusedId, expansion)
        } catch {
          // A transient refresh never rolls an island back; the next tick can recover.
        } finally {
          pending = false
        }
      }
      const interval = setInterval(() => {
        if (AppState.currentState !== "background" && AppState.currentState !== "inactive")
          void refresh()
      }, 15_000)
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh()
      })
      return () => {
        active = false
        clearInterval(interval)
        listener.remove()
      }
    }, [acceptExpansion, busy, focusedId]),
  )

  // Every writer owns one home base and one revision. Late refreshes and older writes
  // cannot replace a newer garden, even after the member sails away and back.
  const beginGardenUpdate = useCallback((id: string) => {
    const request = (gardenRequests.current.get(id) ?? 0) + 1
    gardenRequests.current.set(id, request)
    gardenRevisions.current.set(id, (gardenRevisions.current.get(id) ?? 0) + 1)
    return (garden: HomebaseGarden | undefined) => {
      if (gardenRequests.current.get(id) !== request) return false
      gardenRevisions.current.set(id, (gardenRevisions.current.get(id) ?? 0) + 1)
      setData((current) =>
        gardenRequests.current.get(id) === request && current?.bases.some((base) => base.id === id)
          ? { ...current, gardens: { ...current.gardens, [id]: garden } }
          : current,
      )
      return true
    }
  }, [])
  const growthDeadline = useMemo(
    () => gardenGrowthDeadline(Object.values(data?.gardens ?? {})),
    [data?.gardens],
  )
  const now = useCottageClock(
    data?.state.activities,
    data?.state.serverTime,
    data?.receivedAt,
    growthDeadline,
  )
  const islands = useMemo(() => {
    if (!data) return []
    const offsets = archipelagoLayout(data.order)
    const multiple = data.bases.length > 1
    // Your oldest island keeps the original colours; the others get their own.
    const palettes = multiple ? assignIslandPalettes(data.bases.map((base) => base.id)) : {}
    return data.order.flatMap((id) => {
      const homebase = data.bases.find((base) => base.id === id)
      if (!homebase) return []
      const members = homebase.memberIds.map(
        (memberId) =>
          data.state.users.find((u) => u.id === memberId) ?? { id: memberId, name: "Member" },
      )
      const appearances = memberAvatarAppearances(data.state.memberships, id)
      const avatars = avatarsForMembers(members, appearances).map(detailedAvatar)
      const garden = data.gardens[id]
      const expansion = data.expansions[id]
      const activities = homeActivities(data.state, id, now)
      const items: HomeGardenItem[] = [
        ...initialMeadowItems.filter((item) => catalogue.get(item.itemId)?.category === "Trees"),
        ...(garden?.oak
          ? [{ ...oakAt(garden.oak), stage: plantArtStage(garden.oak.growthStartedAt, now) }]
          : []),
        ...(garden?.rewards ?? []).map((p) => ({
          key: rewardKey(p.rewardId),
          itemId: p.itemId,
          x: p.x,
          y: p.y,
          stage: plantArtStage(p.growthStartedAt, now),
        })),
      ]
      const scene = buildHomeScene({
        avatars,
        activities,
        items,
        assets: worldArtAssets,
        coast: expansion?.additions,
        variantSeed: multiple ? islandVariantSeed(id) : 0,
      })
      const palette = palettes[id] ?? 0
      // Signs hang over each island's north corner, out in the channel above it.
      const signAt = { u: 0, v: 0, lift: 8 }
      const sign = (here: boolean) => {
        const sprite = islandSign(homebase.name, here, true)
        return { ...sprite, bitmap: detailedSpriteBitmap(sprite.bitmap, "sign") }
      }
      const layer: IslandLayer = {
        key: id,
        map: scene.map,
        frame: scene.frame,
        offset: offsets[id]!,
        palette,
        drawables: multiple
          ? sortDrawables([
              ...recolorTerrain(scene.drawables, palette),
              spriteDrawable(
                scene.frame,
                "jetty",
                jetty(true),
                { ...JETTY, lift: 0 },
                {
                  artAsset: worldArtAssets.jetty,
                  artColorMatrix: jettyTimberGrade,
                },
              ),
            ])
          : scene.drawables,
        sign: multiple ? spriteDrawable(scene.frame, "sign", sign(false), signAt) : undefined,
        signHere: multiple
          ? spriteDrawable(scene.frame, "sign-here", sign(true), signAt)
          : undefined,
      }
      return [{ homebase, members, avatars, activities, garden, expansion, items, scene, layer }]
    })
  }, [data, now])
  const focused = islands.find((island) => island.homebase.id === focusedId) ?? islands[0]

  return {
    data,
    islands,
    focused,
    focusIsland,
    beginGardenUpdate,
    acceptExpansion,
    busy,
    error,
    setError,
  }
}
