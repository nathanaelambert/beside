import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import { shopListing } from "@beside/api-client/acorns"
import type { MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AcornAmount, AcornCount } from "@/components/AcornCount"
import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import { PlaceItemPanel } from "@/components/pixel-world/PlaceItemPanel"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import {
  avatarAt,
  catalogue,
  hitTest,
  initialItems,
  type WorldItem,
} from "@/components/pixel-world/scene"
import {
  oakAt,
  oakPlantingPulseMs,
  starterOakGuidePoints,
  starterOakTap,
} from "@/components/pixel-world/starterOak"
import { GROUP_BLANKET } from "@/components/pixel-world/terrain"
import { WorldCanvas } from "@/components/pixel-world/WorldCanvas"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { acornLabel, homebaseAcorns, tierFor } from "@/services/api/acorns"
import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { world, worldEyebrow, worldShape } from "@/theme/world"

const homeFraming = { scale: 4, centerX: (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2, centerY: 137 }
const plantingFraming = { ...homeFraming, centerY: 110 }
const compactPlantingFraming = { ...plantingFraming, scale: 3, centerY: 120 }

type HomeData = { homebase?: ApiHomebase; state: ApiState; garden?: HomebaseGarden }
/** Buying a shop item, or moving something already in the meadow (moving is free). */
type Placing =
  | { kind: "buy"; itemId: string }
  | { kind: "move"; itemId: string; decorationId: string }
  | { kind: "move-oak"; itemId: string }
const oakKey = "starter-oak"

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
  const [placing, setPlacing] = useState<Placing>()
  const [placePosition, setPlacePosition] = useState<MeadowPoint>()
  const [placeError, setPlaceError] = useState("")
  const [savingPlace, setSavingPlace] = useState(false)
  const [pulse, setPulse] = useState<WorldItem>()
  const [notice, setNotice] = useState("")
  const placeItemId = route.params?.placeItemId

  useEffect(() => {
    if (!placeItemId) return
    setSelectedKey(undefined)
    setNotice("")
    setPlacePosition(undefined)
    setPlaceError("")
    setPlacing({ kind: "buy", itemId: placeItemId })
  }, [placeItemId])

  useEffect(() => {
    if (!pulse) return
    const timer = setTimeout(() => setPulse(undefined), oakPlantingPulseMs)
    return () => clearTimeout(timer)
  }, [pulse])

  useEffect(() => {
    if (!plantedIn) return
    const timer = setTimeout(() => setPlantedIn(undefined), oakPlantingPulseMs)
    return () => clearTimeout(timer)
  }, [plantedIn])

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      setPlanting(undefined)
      setPlantedIn(undefined)
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
            if (active) setData({ homebase, state, garden })
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
    }, [route.params?.connectionId, attempt]),
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
  const justPlanted =
    oak && homebase && plantedIn === homebase.id ? oakAt(oak, homebase.id) : undefined
  const acorns = useMemo(
    () => (data && homebase ? homebaseAcorns(data.state, homebase.id).balance : 0),
    [data, homebase],
  )
  const decorations = useMemo(
    () => data?.state.decorations.filter((row) => row.homebaseId === homebase?.id) ?? [],
    [data, homebase],
  )
  const decorationItems = useMemo<WorldItem[]>(
    () => decorations.map((row) => ({ key: row.id, itemId: row.itemId, x: row.x, y: row.y })),
    [decorations],
  )
  const oakItem = useMemo(() => (oak ? oakAt(oak, oakKey) : undefined), [oak])
  const placed = useMemo(
    () => (oakItem ? [oakItem, ...decorationItems] : decorationItems),
    [oakItem, decorationItems],
  )
  const placingItem = placing && homebase && data ? catalogue.get(placing.itemId) : undefined
  const placingListing = placing?.kind === "buy" ? shopListing(placing.itemId) : null
  // Everything already standing in the meadow, except whatever is being moved.
  const occupied = useMemo(
    () =>
      placed.filter((item) =>
        placing?.kind === "move"
          ? item.key !== placing.decorationId
          : placing?.kind === "move-oak"
            ? item.key !== oakKey
            : true,
      ),
    [placed, placing],
  )
  const guide = useMemo(
    () =>
      placingItem
        ? starterOakGuidePoints(occupied)
        : editing
          ? starterOakGuidePoints(decorationItems)
          : undefined,
    [placingItem, editing, occupied, decorationItems],
  )
  const selectedDecoration = decorations.find((row) => row.id === selectedKey)
  const selectedDecorationItem = selectedDecoration && catalogue.get(selectedDecoration.itemId)
  const selectedOak = selectedKey === oakKey && oakItem
  const buyerName = selectedDecoration
    ? (data?.state.users.find((user) => user.id === selectedDecoration.purchasedByUserId)?.name ??
      "Someone")
    : ""
  const framing =
    editing || justPlanted || placingItem || pulse
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
    if (placingItem) {
      const { point, rejection } = starterOakTap(x, y, occupied)
      setPlacePosition(rejection ? undefined : point)
      setPlaceError(
        rejection === "occupied"
          ? "Something already stands there."
          : rejection
            ? "Choose a clear patch of lawn."
            : "",
      )
      return
    }
    if (!editing || !homebase) {
      const hit = hitTest(placed, x, y, scale)
      setSelectedKey(hit?.key ?? avatarAt(x, y, scale, avatars)?.key)
      setNotice("")
      return
    }
    const { point, rejection } = starterOakTap(x, y, decorationItems)
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
    const points = [...starterOakGuidePoints(decorationItems)].sort(
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

  function startPlacing(next: Placing) {
    setSelectedKey(undefined)
    setNotice("")
    setPlacePosition(undefined)
    setPlaceError("")
    setPlacing(next)
  }

  function stopPlacing() {
    setPlacing(undefined)
    setPlacePosition(undefined)
    setPlaceError("")
    if (route.params?.placeItemId) navigation.setParams({ placeItemId: undefined })
  }

  function suggestPlace() {
    if (!guide?.length || savingPlace) return
    const points = [...guide].sort(
      (a, b) =>
        Math.hypot(a.x - framing.centerX, a.y - framing.centerY) -
        Math.hypot(b.x - framing.centerX, b.y - framing.centerY),
    )
    const index = points.findIndex(
      (point) => point.x === placePosition?.x && point.y === placePosition.y,
    )
    setCameraReset((value) => value + 1)
    setPlacePosition(points[(index + 1) % points.length])
    setPlaceError("")
  }

  async function confirmPlace() {
    if (!placing || !placingItem || !placePosition || !homebase || savingPlace) return
    setSavingPlace(true)
    setPlaceError("")
    try {
      let key: string
      if (placing.kind === "buy") {
        const result = await besideApi.buyDecoration({
          homebaseId: homebase.id,
          itemId: placing.itemId,
          ...placePosition,
          externalKey: `buy:${placing.itemId}:${placePosition.x}:${placePosition.y}:${Date.now()}`,
        })
        key = result.entityId
        setNotice(
          `${placingItem.name} is in the meadow. ${acornLabel(acorns - (placingListing?.price ?? 0))} left.`,
        )
      } else if (placing.kind === "move") {
        await besideApi.moveDecoration(placing.decorationId, placePosition)
        key = placing.decorationId
        setNotice(`Moved the ${placingItem.name.toLowerCase()}. Moving is free.`)
      } else {
        const garden = await besideApi.moveStarterOak(homebase.id, placePosition)
        setData((current) =>
          current?.homebase?.id === homebase.id ? { ...current, garden } : current,
        )
        key = oakKey
        setNotice("Moved the starter oak. Moving is free.")
      }
      setPulse({ key: `pulse-${key}`, itemId: placing.itemId, ...placePosition })
      stopPlacing()
      setSelectedKey(key)
      if (placing.kind !== "move-oak") setAttempt((value) => value + 1)
    } catch (e) {
      setPlaceError(e instanceof Error ? e.message : "We couldn’t save that. Please try again.")
    } finally {
      setSavingPlace(false)
    }
  }

  async function giveBack() {
    if (!selectedDecoration || savingPlace) return
    setSavingPlace(true)
    try {
      await besideApi.returnDecoration(selectedDecoration.id)
      setNotice(
        `${selectedDecorationItem?.name ?? "It"} went back to the shop. ${acornLabel(selectedDecoration.price)} returned.`,
      )
      setSelectedKey(undefined)
      setAttempt((value) => value + 1)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "We couldn’t return that. Please try again.")
    } finally {
      setSavingPlace(false)
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
        <View style={styles.titleRow}>
          <Text
            testID="homebase-name"
            text={homebase?.name ?? "Home base"}
            weight="semiBold"
            style={styles.title}
          />
          {homebase && (
            <AcornCount
              amount={acorns}
              testID="homebase-acorns"
              onPress={() => navigation.navigate("Shop", { connectionId: homebase.id })}
            />
          )}
        </View>
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
              items={[...initialItems, ...placed]}
              avatars={avatars}
              selectedKey={editing || placingItem ? undefined : selectedKey}
              preview={
                position
                  ? oakAt(position, "preview")
                  : placingItem && placePosition
                    ? { key: "preview", itemId: placingItem.id, ...placePosition }
                    : undefined
              }
              plantingGuide={guide}
              justPlanted={justPlanted ?? pulse}
              framing={framing}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${members.length} members in the meadow: ${members.map((member) => member.name).join(", ")}. ${editing || placingItem ? "Tap an open patch of lawn to preview it, or use Suggest spot." : "Drag to explore. Tap a friend or a decoration."}`}
            />
            <View
              pointerEvents="none"
              style={styles.worldLabel}
              testID={editing ? "oak-placement-guide" : undefined}
            >
              <View style={[styles.dot, (editing || !!placingItem) && styles.guideDot]} />
              <Text
                text={
                  editing
                    ? "Marked spots are plantable"
                    : placingItem
                      ? "Marked spots are free"
                      : "The meadow"
                }
                style={styles.labelText}
              />
            </View>
            {!editing && !placingItem && (
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
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
        {!!notice && (
          <Text
            testID="homebase-notice"
            text={notice}
            accessibilityLiveRegion="polite"
            style={styles.success}
          />
        )}
        {selectedDecoration && selectedDecorationItem ? (
          <View style={styles.detail}>
            <View style={styles.thumbnail}>
              <RewardSprite item={selectedDecorationItem} scale={2} />
            </View>
            <View style={styles.detailText}>
              <Text
                testID="homebase-selected-decoration"
                text={selectedDecorationItem.name}
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <View style={styles.boughtRow}>
                <Text
                  text={`${tierFor(shopListing(selectedDecoration.itemId)?.rarity ?? "common").name} · ${buyerName.split(/\s+/)[0]} paid`}
                  style={styles.description}
                />
                <AcornAmount amount={selectedDecoration.price} muted />
              </View>
            </View>
            <View style={styles.itemActions}>
              <Pressable
                testID="homebase-move-decoration"
                accessibilityRole="button"
                accessibilityLabel={`Move ${selectedDecorationItem.name}`}
                disabled={savingPlace}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                onPress={() =>
                  startPlacing({
                    kind: "move",
                    itemId: selectedDecoration.itemId,
                    decorationId: selectedDecoration.id,
                  })
                }
              >
                <Text text="Move" style={styles.smallText} />
              </Pressable>
              <Pressable
                testID="homebase-return-decoration"
                accessibilityRole="button"
                accessibilityLabel={`Return ${selectedDecorationItem.name} for ${acornLabel(selectedDecoration.price)}`}
                disabled={savingPlace}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                onPress={() => void giveBack()}
              >
                <Text text="Return" style={styles.smallText} />
              </Pressable>
            </View>
          </View>
        ) : selectedOak ? (
          <View style={styles.detail}>
            <View style={styles.thumbnail}>
              <RewardSprite item={catalogue.get(selectedOak.itemId)!} scale={2} />
            </View>
            <View style={styles.detailText}>
              <Text
                testID="homebase-selected-oak"
                text="Starter oak"
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <Text text="A free gift for your home base." style={styles.description} />
            </View>
            <Pressable
              testID="homebase-move-oak"
              accessibilityRole="button"
              accessibilityLabel="Move the starter oak"
              style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
              onPress={() => startPlacing({ kind: "move-oak", itemId: selectedOak.itemId })}
            >
              <Text text="Move" style={styles.smallText} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.detail}>
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
              <Text
                testID="homebase-selected-member"
                text={selected?.name ?? "Your people, together"}
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <Text
                text={selected ? "Part of your home base." : "Tap a friend or a decoration."}
                style={styles.description}
              />
            </View>
            {homebase && (
              <Text
                testID="homebase-member-count"
                text={`${members.length} members`}
                style={styles.count}
              />
            )}
          </View>
        )}
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
            testID="homebase-shop"
            accessibilityRole="button"
            disabled={!homebase}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => homebase && navigation.navigate("Shop", { connectionId: homebase.id })}
          >
            <Text text="Shop" weight="medium" style={styles.secondaryText} />
          </Pressable>
        </View>
      </View>
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
      {placing && placingItem && (
        <PlaceItemPanel
          item={placingItem}
          title={
            placing.kind === "buy"
              ? `Buy ${placingItem.name.toLowerCase()}`
              : placing.kind === "move"
                ? `Move ${placingItem.name.toLowerCase()}`
                : "Move the starter oak"
          }
          confirmText={
            savingPlace
              ? "Saving…"
              : placing.kind === "buy"
                ? `Buy for ${placingListing?.price ?? ""}`
                : "Move here"
          }
          hasPreview={!!placePosition}
          saving={savingPlace}
          error={placeError}
          onCancel={stopPlacing}
          onConfirm={() => void confirmPlace()}
          onSuggest={suggestPlace}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  body: { color: world.text, fontSize: 14, lineHeight: 22 },
  boughtRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  count: { color: world.muted, fontSize: 11, lineHeight: 16 },
  description: { color: world.muted, fontSize: 12, lineHeight: 18 },
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64 },
  detailText: { flex: 1, gap: 3 },
  dock: { backgroundColor: world.paper, gap: 16, padding: 20, paddingBottom: 12 },
  dot: { backgroundColor: world.leaf, height: 5, width: 5 },
  error: { color: world.error, fontSize: 13, lineHeight: 20 },
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
  itemActions: { flexDirection: "row", gap: 8 },
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
    paddingHorizontal: 16,
  },
  secondaryText: { color: world.text, fontSize: 14, lineHeight: 22 },
  sectionTitle: { color: world.ink, fontSize: 18, lineHeight: 24 },
  smallButton: {
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  smallText: { color: world.text, fontSize: 13, lineHeight: 20 },
  subtitle: { color: world.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  success: { color: world.forest, fontSize: 13, lineHeight: 20 },
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
  title: { color: world.ink, flexShrink: 1, fontSize: 27, lineHeight: 34 },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
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
