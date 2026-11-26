import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import { initialMeadowItems } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"

import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { loadString, saveString } from "@/utils/storage"

import { archipelagoLayout, type IslandLayer } from "./archipelago"
import { islandSign, islandVariantSeed, JETTY, jetty } from "./archipelagoProps"
import { rewardKey } from "./homeWorld"
import { assignIslandPalettes, recolorTerrain } from "./islandPalettes"
import {
  buildHomeScene,
  catalogue,
  sortDrawables,
  spriteDrawable,
  type HomeSceneInput,
} from "./scene"
import { avatarsForMembers } from "../pixel-world/avatars"
import { oakAt } from "../pixel-world/starterOak"

type GardenSnapshot = { garden: HomebaseGarden; receivedAt: number }

async function loadGardenSnapshot(id: string): Promise<GardenSnapshot> {
  const garden = await besideApi.homebaseGarden(id)
  return { garden, receivedAt: performance.now() }
}

function advanceGardenRevision(revisions: Map<string, number>, id: string) {
  const revision = (revisions.get(id) ?? 0) + 1
  revisions.set(id, revision)
  return revision
}

function acceptGardenRefresh(revisions: Map<string, number>, id: string, expected?: number) {
  if (revisions.get(id) !== expected) return false
  advanceGardenRevision(revisions, id)
  return true
}

type ArchipelagoData = {
  bases: ApiHomebase[]
  state: ApiState
  gardens: Record<string, GardenSnapshot | undefined>
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
      let loading = true
      let refreshAfterLoad = false
      let latestRefresh = 0
      let appState = AppState.currentState
      async function refreshFocused() {
        const id = currentFocus.current
        if (!id) return
        const request = ++latestRefresh
        const revision = gardenRevisions.current.get(id)
        try {
          const [state, garden] = await Promise.all([besideApi.state(), loadGardenSnapshot(id)])
          if (!active || request !== latestRefresh) return
          const freshGarden = acceptGardenRefresh(gardenRevisions.current, id, revision)
          setData((current) =>
            current?.bases.some((base) => base.id === id)
              ? {
                  ...current,
                  state,
                  gardens: freshGarden ? { ...current.gardens, [id]: garden } : current.gardens,
                }
              : current,
          )
        } catch {
          // Keep the current island usable if the silent refresh fails.
        }
      }
      const subscription = AppState.addEventListener("change", (next) => {
        const resumed = (appState === "background" || appState === "inactive") && next === "active"
        appState = next
        if (!resumed) return
        if (loading) refreshAfterLoad = true
        else void refreshFocused()
      })
      setBusy(true)
      setError("")
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(async ([bases, state]) => {
          if (!active) return
          const revisions = new Map(gardenRevisions.current)
          const missing = new Set<string>()
          const gardens = await Promise.all(
            bases.map(async (base) => {
              try {
                return [base.id, await loadGardenSnapshot(base.id)] as const
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
          // Read focus after the requests: a deep link may have changed while loading.
          const preferred =
            requested.current ?? currentFocus.current ?? loadString(storageKey) ?? undefined
          const base = selectHomebase(available, state.users, preferred)
          if (base) focusIsland(base.id)
          const fresh = new Map(
            gardens.filter(([id]) =>
              acceptGardenRefresh(gardenRevisions.current, id, revisions.get(id)),
            ),
          )
          setData((current) => ({
            bases: available,
            state,
            gardens: Object.fromEntries(
              available.map(({ id }) => [id, fresh.has(id) ? fresh.get(id) : current?.gardens[id]]),
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
          if (!active) return
          loading = false
          setBusy(false)
          if (refreshAfterLoad && appState === "active") void refreshFocused()
        })
      return () => {
        active = false
        subscription.remove()
      }
    }, [attempt, storageKey, focusIsland]),
  )

  // Every writer owns one home base and one revision. Late refreshes and older writes
  // cannot replace a newer garden, even after the member sails away and back.
  const beginGardenUpdate = useCallback((id: string) => {
    const request = (gardenRequests.current.get(id) ?? 0) + 1
    gardenRequests.current.set(id, request)
    let revision = advanceGardenRevision(gardenRevisions.current, id)
    function publish(snapshot?: GardenSnapshot) {
      setData((current) =>
        gardenRequests.current.get(id) === request && current?.bases.some((base) => base.id === id)
          ? { ...current, gardens: { ...current.gardens, [id]: snapshot } }
          : current,
      )
    }
    return (garden: HomebaseGarden | undefined) => {
      if (gardenRequests.current.get(id) !== request) return false
      const refreshedDuringWrite = gardenRevisions.current.get(id) !== revision
      revision = advanceGardenRevision(gardenRevisions.current, id)
      if (!refreshedDuringWrite) {
        publish(garden && { garden, receivedAt: performance.now() })
      } else if (garden) {
        // The write succeeded, but its response may predate a teammate's changes.
        // Keep the refreshed garden until a read started after the write returns.
        const afterWrite = revision
        void loadGardenSnapshot(id)
          .then((snapshot) => {
            if (gardenRequests.current.get(id) !== request) return
            if (acceptGardenRefresh(gardenRevisions.current, id, afterWrite)) publish(snapshot)
          })
          .catch(() => {
            // Keep the refreshed garden available if reconciliation fails.
          })
      }
      return true
    }
  }, [])
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
      const avatars = avatarsForMembers(members)
      const snapshot = data.gardens[id]
      const garden = snapshot?.garden
      const serverTime = Date.parse(garden?.serverTime ?? "")
      const items: HomeSceneInput["items"] = [
        ...initialMeadowItems.filter((item) => catalogue.get(item.itemId)?.category === "Trees"),
        ...(garden?.oak ? [oakAt(garden.oak)] : []),
        ...(garden?.rewards ?? []).map((p) => ({
          key: rewardKey(p.rewardId),
          itemId: p.itemId,
          x: p.x,
          y: p.y,
          upgradeCount: p.upgradeCount,
          buildDeadline:
            p.buildReadyAt && snapshot && Number.isFinite(serverTime)
              ? snapshot.receivedAt + Date.parse(p.buildReadyAt) - serverTime
              : undefined,
        })),
      ]
      const scene = buildHomeScene({
        avatars,
        items,
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
      return [{ homebase, members, avatars, garden, items, scene, layer }]
    })
  }, [data])
  const focused = islands.find((island) => island.homebase.id === focusedId) ?? islands[0]

  return {
    data,
    islands,
    focused,
    focusIsland,
    beginGardenUpdate,
    busy,
    error,
    setError,
  }
}
