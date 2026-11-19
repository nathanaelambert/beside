import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import { initialMeadowItems } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"

import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { loadString, saveString } from "@/utils/storage"

import { archipelagoLayout, type IslandLayer } from "./archipelago"
import { islandSign, islandVariantSeed, JETTY, jetty } from "./archipelagoProps"
import { homeActivities, rewardKey } from "./homeWorld"
import { assignIslandPalettes, recolorTerrain } from "./islandPalettes"
import { buildHomeScene, catalogue, sortDrawables, spriteDrawable } from "./scene"
import { avatarsForMembers } from "../pixel-world/avatars"
import { oakAt } from "../pixel-world/starterOak"

type ArchipelagoData = {
  bases: ApiHomebase[]
  state: ApiState
  gardens: Record<string, HomebaseGarden | undefined>
  /** Membership order: islands keep fixed places on the map, wherever you open. */
  order: string[]
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
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(async ([bases, state]) => {
          if (!active) return
          const preferred =
            requested.current ?? currentFocus.current ?? loadString(storageKey) ?? undefined
          const base = selectHomebase(bases, state.users, preferred)
          const missing = new Set<string>()
          const gardens = await Promise.all(
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
          )
          if (!active) return
          // A single island keeps #34's atomic first frame, including its saved garden.
          const available = bases.filter((candidate) => !missing.has(candidate.id))
          if (base) focusIsland(base.id)
          setData({
            bases: available,
            state,
            gardens: Object.fromEntries(gardens),
            order: available.map((b) => b.id),
          })
        })
        .catch(() => {
          if (active) setError("We couldn’t open your home base. Please try again.")
        })
        .finally(() => {
          if (active) setBusy(false)
        })
      return () => {
        active = false
      }
    }, [attempt, storageKey, focusIsland]),
  )

  const updateGarden = useCallback((id: string, garden: HomebaseGarden | undefined) => {
    setData((current) =>
      current ? { ...current, gardens: { ...current.gardens, [id]: garden } } : current,
    )
  }, [])

  const islands = useMemo(() => {
    if (!data) return []
    const offsets = archipelagoLayout(data.order)
    const multiple = data.bases.length > 1
    // Your oldest island keeps the original colours; the others get their own.
    const palettes = multiple ? assignIslandPalettes(data.bases.map((base) => base.id)) : {}
    const serverNow = Date.parse(data.state.serverTime ?? "")
    const now = Number.isFinite(serverNow) ? serverNow : Date.now()
    return data.order.flatMap((id) => {
      const homebase = data.bases.find((base) => base.id === id)
      if (!homebase) return []
      const members = homebase.memberIds.map(
        (memberId) =>
          data.state.users.find((u) => u.id === memberId) ?? { id: memberId, name: "Member" },
      )
      const avatars = avatarsForMembers(members)
      const garden = data.gardens[id]
      const activities = homeActivities(data.state, id, now)
      const scene = buildHomeScene({
        avatars,
        activities,
        items: [
          ...initialMeadowItems.filter((item) => catalogue.get(item.itemId)?.category === "Trees"),
          ...(garden?.oak ? [oakAt(garden.oak)] : []),
          ...(garden?.rewards ?? []).map((p) => ({
            key: rewardKey(p.rewardId),
            itemId: p.itemId,
            x: p.x,
            y: p.y,
          })),
        ],
        variantSeed: multiple ? islandVariantSeed(id) : 0,
      })
      const palette = palettes[id] ?? 0
      // Signs hang over each island's north corner, out in the channel above it.
      const signAt = { u: 0, v: 0, lift: 8 }
      const layer: IslandLayer = {
        key: id,
        map: scene.map,
        frame: scene.frame,
        offset: offsets[id]!,
        palette,
        drawables: multiple
          ? sortDrawables([
              ...recolorTerrain(scene.drawables, palette),
              spriteDrawable(scene.frame, "jetty", jetty(), { ...JETTY, lift: 0 }),
            ])
          : scene.drawables,
        sign: multiple
          ? spriteDrawable(scene.frame, "sign", islandSign(homebase.name), signAt)
          : undefined,
        signHere: multiple
          ? spriteDrawable(scene.frame, "sign-here", islandSign(homebase.name, true), signAt)
          : undefined,
      }
      return [{ homebase, members, avatars, activities, garden, scene, layer }]
    })
  }, [data])
  const focused = islands.find((island) => island.homebase.id === focusedId) ?? islands[0]

  return { data, islands, focused, focusIsland, updateGarden, busy, error, setError }
}
