import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import type { MeadowPoint } from "@beside/api-client/garden"
import { buildPlans, gardenHistory } from "@beside/api-client/precursors"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import {
  gardenItems,
  gardenKey,
  itemLabel,
  occupiedSpots,
  placementGuide,
  placementTap,
  seenStamp,
  unplacedObjects,
  unseenChange,
} from "@/components/pixel-world/garden"
import { PlaceObjectPanel } from "@/components/pixel-world/PlaceObjectPanel"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import { avatarAt, catalogue, hitTest, initialItems } from "@/components/pixel-world/scene"
import { oakAt, oakPlantingPulseMs } from "@/components/pixel-world/starterOak"
import { GROUP_BLANKET } from "@/components/pixel-world/terrain"
import { WorldCanvas } from "@/components/pixel-world/WorldCanvas"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { loadString, saveString } from "@/utils/storage"

const homeFraming = { scale: 4, centerX: (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2, centerY: 137 }
const plantingFraming = { ...homeFraming, centerY: 110 }
const compactPlantingFraming = { ...plantingFraming, scale: 3, centerY: 120 }

type HomeData = { homebase?: ApiHomebase; state: ApiState; garden?: HomebaseGarden }
type Placing = { homebaseId: string; objectId: string; moving: boolean; position?: MeadowPoint }

const starterKey = "starter-oak"
const seenKey = (homebaseId: string) => `beside.garden.seen.${homebaseId}`
function readSeen(homebaseId: string): Record<string, string> {
  try {
    return JSON.parse(loadString(seenKey(homebaseId)) ?? "{}")
  } catch {
    return {}
  }
}

export function HomeBaseScreen({ navigation, route }: AppStackScreenProps<"HomeBase">) {
  const { logout } = useAuth()
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>()
  const [cameraReset, setCameraReset] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [planting, setPlanting] = useState<{ homebaseId: string; position?: MeadowPoint }>()
  const [gardenError, setGardenError] = useState("")
  const [savingOak, setSavingOak] = useState(false)
  const [plantedIn, setPlantedIn] = useState<string>()
  const plantingLock = useRef(false)
  // Placing an earned object, or moving any placed one (the starter oak too).
  const [placing, setPlacing] = useState<Placing>()
  const [savingPlace, setSavingPlace] = useState(false)
  const [placedKey, setPlacedKey] = useState<string>()
  const [fresh, setFresh] = useState<string>()

  useEffect(() => {
    if (!plantedIn) return
    const timer = setTimeout(() => setPlantedIn(undefined), oakPlantingPulseMs)
    return () => clearTimeout(timer)
  }, [plantedIn])
  useEffect(() => {
    if (!placedKey) return
    const timer = setTimeout(() => setPlacedKey(undefined), oakPlantingPulseMs)
    return () => clearTimeout(timer)
  }, [placedKey])

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      setPlanting(undefined)
      setPlantedIn(undefined)
      setPlacing(undefined)
      setGardenError("")
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(async ([bases, state]) => {
          if (!active) return
          const homebase = selectHomebase(bases, state.users, route.params?.connectionId)
          if (!homebase) {
            setData({ homebase, state })
            return
          }
          try {
            const garden = await besideApi.homebaseGarden(homebase.id)
            // Commit the scene together, so a saved oak is present on its first frame.
            if (!active) return
            setData({ homebase, state, garden })
            // Celebrate the newest change this device has not shown yet, then remember it.
            const objects = state.gardenObjects ?? []
            const change = unseenChange(objects, homebase.id, readSeen(homebase.id))
            const key = change && (change.origin === "starter" ? starterKey : gardenKey(change.id))
            setFresh(key)
            if (key) setSelectedKey(key)
            saveString(
              seenKey(homebase.id),
              JSON.stringify(Object.fromEntries(objects.map((o) => [o.id, seenStamp(o)]))),
            )
            // Arriving from an earned reward: go straight to choosing its spot.
            const ready = objects.find((o) => o.id === route.params?.placeObjectId && o.x === null)
            if (ready) setPlacing({ homebaseId: homebase.id, objectId: ready.id, moving: false })
          } catch (e) {
            if (!active) return
            if (e instanceof ApiError && e.status === 404) {
              setData({ state })
              setError("This home base is no longer available. Please try again.")
            } else {
              setData({ homebase, state })
              setError("We couldn’t load garden decorations. Please try again.")
            }
          }
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
    }, [route.params?.connectionId, route.params?.placeObjectId, attempt]),
  )

  const homebase = data?.homebase
  const members = useMemo(
    () =>
      data?.homebase?.memberIds.map(
        (id) => data.state.users.find((member) => member.id === id) ?? { id, name: "Member" },
      ) ?? [],
    [data],
  )
  const avatars = useMemo(() => avatarsForMembers(members), [members])
  const selected = avatars.find((avatar) => avatar.key === selectedKey)
  const oak = data?.garden?.oak
  const canPlant = !!data?.garden && !oak && !busy
  const editing = !!planting && planting.homebaseId === homebase?.id && canPlant
  const position = editing ? planting?.position : undefined
  const objects = useMemo(
    () => data?.state.gardenObjects?.filter((o) => o.homebaseId === homebase?.id) ?? [],
    [data, homebase],
  )
  const starterObject = objects.find((o) => o.origin === "starter")
  // The starter oak comes from PR #14's garden endpoint, at its current stage.
  const starterItem = oak && { ...oakAt(oak, starterKey), itemId: oak.itemId }
  const earnedItems = useMemo(
    () =>
      homebase
        ? gardenItems(
            objects.filter((o) => o.origin !== "starter"),
            homebase.id,
          )
        : [],
    [objects, homebase],
  )
  const objectFor = (key?: string) =>
    key === starterKey ? starterObject : objects.find((o) => gardenKey(o.id) === key)
  const placingNow = placing && placing.homebaseId === homebase?.id ? placing : undefined
  const placingObject = placingNow && objects.find((o) => o.id === placingNow.objectId)
  const placingKey =
    placingObject && (placingObject.origin === "starter" ? starterKey : gardenKey(placingObject.id))
  // Everything already standing, except what is being moved, plus a just-planted
  // starter oak the state has not caught up with yet.
  const placingId = placingNow?.objectId
  const starterSaved = !!starterObject
  const occupied = useMemo(() => {
    const spots = occupiedSpots(objects, homebase?.id ?? "", placingId)
    if (oak && !starterSaved && !placingId) spots.push({ x: oak.x, y: oak.y })
    return spots
  }, [objects, homebase, placingId, oak, starterSaved])
  const guide = useMemo(
    () => (editing || placingId ? placementGuide(occupied) : undefined),
    [editing, placingId, occupied],
  )
  const unplaced = homebase ? unplacedObjects(objects, homebase.id) : []
  const selectedObject = objectFor(selectedKey)
  const selectedItem = selectedObject && catalogue.get(selectedObject.itemId)
  const history = selectedObject && data ? gardenHistory(data.state, selectedObject) : []
  const build = selectedObject && buildPlans.find((p) => p.stages.includes(selectedObject.itemId))
  const objectStory = !selectedObject
    ? ""
    : build
      ? `${build.name} · stage ${build.stages.indexOf(selectedObject.itemId) + 1} of ${build.stages.length}. ${history.map((r) => itemLabel(r.itemId)).join(" → ")}`
      : selectedObject.origin === "starter"
        ? selectedObject.itemId === "oak-tree"
          ? "Your free starter oak."
          : "Was your starter oak. Decorated together."
        : history.length > 1
          ? `Was ${history
              .slice(0, -1)
              .map((r) => `a ${itemLabel(r.itemId)}`)
              .join(", then ")}. Upgraded together.`
          : "Earned together for your garden."
  const worldItems = [
    ...initialItems,
    ...(starterItem && !(placingKey === starterKey && placingNow?.position) ? [starterItem] : []),
    ...earnedItems.filter((item) => !(item.key === placingKey && placingNow?.position)),
  ]
  const placedPulse = placedKey ? worldItems.find((item) => item.key === placedKey) : undefined
  const justPlanted =
    oak && homebase && plantedIn === homebase.id
      ? { ...oakAt(oak, homebase.id), itemId: oak.itemId }
      : placedPulse
  const framing =
    editing || placingNow || justPlanted
      ? size.width < 600
        ? compactPlantingFraming
        : plantingFraming
      : homeFraming

  function startPlanting() {
    if (!homebase || !canPlant || editing || plantingLock.current) return
    setSelectedKey(undefined)
    setGardenError("")
    setPlanting({ homebaseId: homebase.id })
  }

  function tapWorld(x: number, y: number, scale: number) {
    if (plantingLock.current) return
    if (placingNow) {
      const { point, rejection } = placementTap(x, y, occupied)
      setPlacing({ ...placingNow, position: rejection ? undefined : point })
      setGardenError(
        rejection === "occupied"
          ? "Something already stands there."
          : rejection
            ? "Choose a clear patch of lawn."
            : "",
      )
      return
    }
    if (!editing || !homebase) {
      const garden = [...(starterItem ? [starterItem] : []), ...earnedItems]
      setSelectedKey(avatarAt(x, y, scale, avatars)?.key ?? hitTest(garden, x, y, scale)?.key)
      return
    }
    const { point, rejection } = placementTap(x, y, occupied)
    setPlanting({ homebaseId: homebase.id, position: rejection ? undefined : point })
    setGardenError(
      rejection === "occupied"
        ? "That spot is occupied."
        : rejection
          ? "Choose a clear patch of lawn."
          : "",
    )
  }

  function suggestSpot() {
    if (!homebase || !editing || plantingLock.current) return
    // Offer a keyboard/screen-reader path without requiring a canvas gesture.
    const points = [...(guide ?? [])].sort(
      (a, b) =>
        Math.hypot(a.x - framing.centerX, a.y - framing.centerY) -
        Math.hypot(b.x - framing.centerX, b.y - framing.centerY),
    )
    const index = points.findIndex((point) => point.x === position?.x && point.y === position.y)
    const next = points[(index + 1) % points.length]
    if (!next) return
    setCameraReset((value) => value + 1)
    setPlanting({ homebaseId: homebase.id, position: next })
    setGardenError("")
  }

  async function plantOak() {
    if (!position || !homebase || plantingLock.current) return
    plantingLock.current = true
    setSavingOak(true)
    setGardenError("")
    try {
      const garden = await besideApi.plantStarterOak(homebase.id, position)
      setData((current) =>
        current?.homebase?.id === homebase.id ? { ...current, garden } : current,
      )
      setPlantedIn(homebase.id)
      setPlanting(undefined)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setPlanting(undefined)
        setGardenError("Someone already planted the shared oak.")
        setData((current) =>
          current?.homebase?.id === homebase.id ? { ...current, garden: undefined } : current,
        )
        try {
          const garden = await besideApi.homebaseGarden(homebase.id)
          setData((current) =>
            current?.homebase?.id === homebase.id ? { ...current, garden } : current,
          )
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 404) {
            setData((current) =>
              current?.homebase?.id === homebase.id ? { state: current.state } : current,
            )
            setError("This home base is no longer available. Please try again.")
          } else {
            setError("We couldn’t load garden decorations. Please try again.")
          }
        }
      } else {
        setGardenError("We couldn’t plant the oak. Try again.")
      }
    } finally {
      setSavingOak(false)
      plantingLock.current = false
    }
  }

  function startPlacing(objectId: string, moving: boolean) {
    if (!homebase || editing || plantingLock.current) return
    setGardenError("")
    setPlacing({ homebaseId: homebase.id, objectId, moving })
  }

  function suggestPlace() {
    if (!placingNow || !guide?.length) return
    const anchor =
      placingObject?.x != null ? placingObject : { x: framing.centerX, y: framing.centerY }
    const points = [...guide].sort(
      (a, b) =>
        Math.hypot(a.x - anchor.x!, a.y - anchor.y!) - Math.hypot(b.x - anchor.x!, b.y - anchor.y!),
    )
    const current = placingNow.position
    const index = points.findIndex((p) => p.x === current?.x && p.y === current?.y)
    setCameraReset((value) => value + 1)
    setPlacing({ ...placingNow, position: points[(index + 1) % points.length] })
    setGardenError("")
  }

  async function confirmPlace() {
    if (!placingNow?.position || !homebase || plantingLock.current) return
    plantingLock.current = true
    setSavingPlace(true)
    setGardenError("")
    try {
      await besideApi.placeGardenObject(placingNow.objectId, placingNow.position)
      const [state, garden] = await Promise.all([
        besideApi.state(),
        besideApi.homebaseGarden(homebase.id),
      ])
      setData((current) =>
        current?.homebase?.id === homebase.id ? { ...current, state, garden } : current,
      )
      const key = placingKey ?? gardenKey(placingNow.objectId)
      setPlacedKey(key)
      setSelectedKey(key)
      setPlacing(undefined)
    } catch (e) {
      setGardenError(
        e instanceof ApiError && e.status === 400
          ? e.message
          : "We couldn’t save that spot. Try again.",
      )
    } finally {
      setSavingPlace(false)
      plantingLock.current = false
    }
  }

  async function signOut() {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      setError("We couldn’t log you out. Please try again.")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <SafeAreaView
      testID="homebase-screen"
      style={styles.screen}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <Text text="YOUR HOME BASE" style={worldEyebrow} />
          <Pressable
            testID="homebase-logout"
            accessibilityRole="button"
            onPress={signOut}
            disabled={loggingOut}
            style={styles.logout}
          >
            <Text text={loggingOut ? "Logging out…" : "Log out"} style={styles.smallText} />
          </Pressable>
        </View>
        <Text
          testID="homebase-name"
          text={homebase?.name ?? "Home base"}
          weight="semiBold"
          style={styles.title}
        />
        {!!members.length && <Text text={firstNamesLabel(members)} style={styles.subtitle} />}
      </View>
      <View
        testID="homebase-world"
        style={styles.world}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
      >
        {homebase && size.width > 0 && size.height > 0 && (
          <>
            <WorldCanvas
              {...size}
              items={worldItems}
              avatars={avatars}
              selectedKey={placingNow ? undefined : selectedKey}
              preview={
                position
                  ? oakAt(position, "preview")
                  : placingNow?.position && placingObject
                    ? { key: "preview", itemId: placingObject.itemId, ...placingNow.position }
                    : undefined
              }
              showPlantingGuide={editing || !!placingNow}
              guidePoints={guide}
              sparkleKey={placingNow ? undefined : fresh}
              justPlanted={justPlanted}
              framing={framing}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${members.length} members in the meadow: ${members.map((member) => member.name).join(", ")}. ${editing || placingNow ? "Tap an open patch of lawn to preview the spot, or use Suggest spot." : `Garden: ${[...(starterItem ? [starterItem] : []), ...earnedItems].map((g) => itemLabel(g.itemId)).join(", ") || "nothing earned yet"}. Drag to explore. Tap a friend or something in the garden.`}`}
            />
            <View
              pointerEvents="none"
              style={styles.worldLabel}
              testID={
                editing ? "oak-placement-guide" : placingNow ? "object-placement-guide" : undefined
              }
            >
              <View style={[styles.dot, (editing || !!placingNow) && styles.guideDot]} />
              <Text
                text={
                  editing
                    ? "Marked spots are plantable"
                    : placingNow
                      ? "Marked spots are open lawn"
                      : "The meadow"
                }
                style={styles.labelText}
              />
            </View>
            {!editing && !placingNow && (
              <Pressable
                testID="homebase-recenter"
                accessibilityRole="button"
                accessibilityLabel="Recenter on your friends"
                style={styles.recenter}
                onPress={() => {
                  setPlantedIn(undefined)
                  setCameraReset((value) => value + 1)
                }}
              >
                <Text text="Recenter" style={styles.smallText} />
              </Pressable>
            )}
          </>
        )}
        {!data && busy && (
          <View style={styles.loading}>
            <ActivityIndicator color={world.forest} />
            <Text text="Opening your meadow…" style={styles.body} />
          </View>
        )}
        {!busy && !homebase && !error && (
          <View style={styles.loading}>
            <Text text="You haven’t joined a home base yet." style={styles.body} />
          </View>
        )}
      </View>
      <View style={styles.dock}>
        {!editing && !!gardenError && (
          <Text text={gardenError} accessibilityRole="alert" style={styles.error} />
        )}
        {!!data?.garden && (
          <View testID="homebase-garden-status" style={styles.gardenStatus}>
            {oak && (
              <Text
                testID="homebase-starter-oak"
                text="Planted in your shared garden"
                style={styles.plantedLabel}
                accessibilityLiveRegion="polite"
              />
            )}
            {canPlant && (
              <Pressable
                testID="start-planting-oak"
                accessibilityRole="button"
                accessibilityState={{ expanded: editing }}
                style={styles.secondary}
                onPress={startPlanting}
              >
                <Text text="Plant a tree" weight="medium" style={styles.secondaryText} />
              </Pressable>
            )}
          </View>
        )}
        {!placingNow && unplaced[0] && catalogue.get(unplaced[0].itemId) && (
          <View style={styles.readyRow} testID="homebase-ready-to-place">
            <View style={styles.smallThumb}>
              <RewardSprite item={catalogue.get(unplaced[0].itemId)!} scale={1} />
            </View>
            <Text
              text={`${itemLabel(unplaced[0].itemId)} is ready to place${unplaced.length > 1 ? ` · ${unplaced.length - 1} more waiting` : ""}`}
              style={[styles.description, styles.flex]}
            />
            <Pressable
              testID="homebase-place-ready"
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() => startPlacing(unplaced[0].id, false)}
            >
              <Text text="Place it" weight="medium" style={styles.secondaryText} />
            </Pressable>
          </View>
        )}
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
        <View style={styles.detail}>
          {selectedItem && (
            <View style={styles.thumbnail}>
              <RewardSprite item={selectedItem} scale={1.5} />
            </View>
          )}
          {selected && (
            <View style={styles.thumbnail}>
              <RewardSprite
                item={{
                  id: selected.key,
                  name: selected.name,
                  category: "Friends",
                  artifact: selected.frames.idle,
                }}
                scale={3}
              />
            </View>
          )}
          <View style={styles.detailText}>
            {selectedObject && fresh === selectedKey && (
              <Text text="NEW IN YOUR GARDEN" style={worldEyebrow} testID="homebase-garden-new" />
            )}
            <Text
              testID="homebase-selected-member"
              text={selectedItem?.name ?? selected?.name ?? "Your people, together"}
              weight="semiBold"
              style={styles.sectionTitle}
              accessibilityLiveRegion="polite"
            />
            <Text
              testID={selectedObject ? "homebase-garden-story" : undefined}
              text={
                selectedObject
                  ? objectStory
                  : selected
                    ? "Part of your home base."
                    : "Tap a friend in the meadow."
              }
              style={styles.description}
            />
          </View>
          {selectedObject && selectedObject.x !== null && !placingNow && (
            <Pressable
              testID="homebase-move-object"
              accessibilityRole="button"
              accessibilityLabel={`Move the ${selectedItem?.name ?? "item"}`}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() => startPlacing(selectedObject.id, true)}
            >
              <Text text="Move" weight="medium" style={styles.secondaryText} />
            </Pressable>
          )}
          {homebase && !selectedObject && (
            <Text
              testID="homebase-member-count"
              text={`${members.length} members`}
              style={styles.count}
            />
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            testID="homebase-create-activity"
            accessibilityRole="button"
            disabled={!homebase}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() =>
              homebase && navigation.navigate("ActivityCreate", { connectionId: homebase.id })
            }
          >
            <Text text="New activity" weight="medium" style={styles.primaryText} />
          </Pressable>
          <Pressable
            testID="homebase-activities"
            accessibilityRole="button"
            disabled={!homebase}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              homebase && navigation.navigate("Activities", { connectionId: homebase.id })
            }
          >
            <Text text="Activities" weight="medium" style={styles.secondaryText} />
          </Pressable>
          <Pressable
            testID="homebase-rewards"
            accessibilityRole="button"
            disabled={!homebase}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              homebase && navigation.navigate("GardenRewards", { connectionId: homebase.id })
            }
          >
            <Text text="Rewards" weight="medium" style={styles.secondaryText} />
          </Pressable>
        </View>
      </View>
      {placingNow && placingObject && (
        <PlaceObjectPanel
          itemId={placingObject.itemId}
          moving={placingNow.moving}
          hasPreview={!!placingNow.position}
          saving={savingPlace}
          error={gardenError}
          onCancel={() => {
            setPlacing(undefined)
            setGardenError("")
          }}
          onConfirm={() => void confirmPlace()}
          onSuggest={suggestPlace}
        />
      )}
      {editing && (
        <PlantOakPanel
          hasPreview={!!position}
          saving={savingOak}
          error={gardenError}
          onCancel={() => {
            setPlanting(undefined)
            setGardenError("")
          }}
          onPlant={() => void plantOak()}
          onSuggest={suggestSpot}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 12 },
  body: { color: world.text, fontSize: 14, lineHeight: 22 },
  count: { color: world.muted, fontSize: 11, lineHeight: 16 },
  description: { color: world.muted, fontSize: 12, lineHeight: 18 },
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64 },
  detailText: { flex: 1, gap: 3 },
  dock: { backgroundColor: world.paper, gap: 16, padding: 20, paddingBottom: 12 },
  dot: { backgroundColor: world.leaf, height: 5, width: 5 },
  error: { color: world.error, fontSize: 13, lineHeight: 20 },
  flex: { flex: 1 },
  // Keep the canvas height unchanged when the button becomes a smaller saved label.
  gardenStatus: { justifyContent: "center", minHeight: worldShape.control },
  guideDot: {
    backgroundColor: world.onForest,
    borderColor: world.forest,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  header: { paddingBottom: 20, paddingHorizontal: 20, paddingTop: 8 },
  headingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  labelText: { color: world.text, fontSize: 11, lineHeight: 16 },
  loading: {
    alignItems: "center",
    backgroundColor: world.paper,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  logout: { justifyContent: "center", minHeight: 40, paddingLeft: 16 },
  notice: { gap: 8 },
  plantedLabel: {
    alignSelf: "flex-start",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.smallRadius,
    borderWidth: worldShape.border,
    color: world.ink,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.75 },
  primary: {
    alignItems: "center",
    backgroundColor: world.forest,
    borderRadius: worldShape.radius,
    flex: 1,
    justifyContent: "center",
    minHeight: worldShape.control,
    paddingHorizontal: 14,
  },
  primaryText: { color: world.onForest, fontSize: 14, lineHeight: 22 },
  readyRow: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    flexDirection: "row",
    gap: 10,
    padding: 8,
  },
  recenter: {
    backgroundColor: world.panel,
    borderRadius: worldShape.smallRadius,
    bottom: 16,
    justifyContent: "center",
    minHeight: worldShape.control,
    paddingHorizontal: 12,
    position: "absolute",
    right: 20,
  },
  screen: { backgroundColor: world.paper, flex: 1 },
  secondary: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: worldShape.control,
    paddingHorizontal: 20,
  },
  secondaryText: { color: world.text, fontSize: 14, lineHeight: 22 },
  sectionTitle: { color: world.ink, fontSize: 18, lineHeight: 24 },
  smallText: { color: world.text, fontSize: 13, lineHeight: 20 },
  smallThumb: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  subtitle: { color: world.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  thumbnail: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  title: { color: world.ink, fontSize: 27, lineHeight: 34 },
  world: { backgroundColor: world.canvas, flex: 1, overflow: "hidden" },
  worldLabel: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderRadius: worldShape.smallRadius,
    flexDirection: "row",
    gap: 7,
    left: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    top: 16,
  },
})
