import { useCallback, useMemo, useRef, useState } from "react"
import { ActivityIndicator, PixelRatio, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError } from "@beside/api-client"
import { type MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PixelArtSprite } from "@/components/BesideMark"
import {
  focusedIslandLayers,
  snapZoom,
  stepZoom,
  zoomStops,
} from "@/components/iso-world/archipelago"
import { cottageArt } from "@/components/iso-world/cottageArt"
import { homeFocus, plantableTiles, plantingTap } from "@/components/iso-world/homeWorld"
import { IslandSwitcher } from "@/components/iso-world/IslandSwitcher"
import { IsoWorldCanvas } from "@/components/iso-world/IsoWorldCanvas"
import { meadowToIso } from "@/components/iso-world/projection"
import {
  catalogue,
  itemDrawable,
  sortDrawables,
  type HitTarget,
} from "@/components/iso-world/scene"
import { useArchipelagoTravel } from "@/components/iso-world/useArchipelagoTravel"
import { useHomeArchipelago } from "@/components/iso-world/useHomeArchipelago"
import { firstNamesLabel } from "@/components/pixel-world/avatars"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"

export function HomeBaseScreen({ navigation, route }: AppStackScreenProps<"HomeBase">) {
  const { logout, user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [selected, setSelected] = useState<HitTarget>()
  const [cameraReset, setCameraReset] = useState(0)
  const [zoom, setZoom] = useState<number>()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [planting, setPlanting] = useState<{ homebaseId: string; position?: MeadowPoint }>()
  const [gardenError, setGardenError] = useState("")
  const [savingOak, setSavingOak] = useState(false)
  const plantingLock = useRef(false)

  useFocusEffect(
    useCallback(() => {
      setPlanting(undefined)
      setGardenError("")
    }, []),
  )

  const { data, islands, focused, focusIsland, updateGarden, busy, error, setError } =
    useHomeArchipelago(user?.id, route.params?.connectionId, attempt)
  const homebase = focused?.homebase
  const members = focused?.members ?? []
  const avatars = focused?.avatars ?? []
  const activities = focused?.activities ?? []
  const oak = focused?.garden?.oak
  const canPlant = !!focused?.garden && !oak && !busy
  const editing = !!planting && planting.homebaseId === homebase?.id && canPlant
  const position = editing ? planting?.position : undefined
  const multipleIslands = islands.length > 1
  const stops = useMemo(() => zoomStops(PixelRatio.get(), multipleIslands), [multipleIslands])
  const autoZoom = snapZoom(size.width >= 700 ? 3 : 2, stops)
  const currentZoom = snapZoom(zoom ?? autoZoom, stops)
  const changeZoom = (direction: 1 | -1) => setZoom(stepZoom(currentZoom, direction, stops))
  const baseLayers = useMemo(() => islands.map((island) => island.layer), [islands])
  const onArrive = useCallback(
    (id: string) => {
      focusIsland(id)
      navigation.setParams({ connectionId: id })
      setSelected(undefined)
      setPlanting(undefined)
      setGardenError("")
      setZoom(undefined)
      setCameraReset((value) => value + 1)
    },
    [focusIsland, navigation],
  )
  const { voyage, travel, arrive } = useArchipelagoTravel({
    layers: baseLayers,
    focusedId: homebase?.id,
    avatar: avatars.find((avatar) => avatar.key === user?.id),
    arrivalZoom: autoZoom,
    onArrive,
  })
  function sailTo(id: string) {
    if (plantingLock.current || voyage || id === homebase?.id) return
    setSelected(undefined)
    setPlanting(undefined)
    setGardenError("")
    travel(id)
  }
  const scene = useMemo(() => {
    const built = focused?.scene
    if (!built || !position) return built
    const { u, v } = meadowToIso(position.x, position.y)
    const preview = itemDrawable(built.frame, built.map, "oak-preview", "oak-tree", u, v, {
      opacity: 0.72,
      hit: undefined,
    })
    return preview ? { ...built, drawables: sortDrawables([...built.drawables, preview]) } : built
  }, [focused, position])
  const layers = useMemo(
    () =>
      focusedIslandLayers(
        baseLayers,
        homebase?.id,
        user?.id,
        !!voyage,
        scene?.drawables.find((drawable) => drawable.key === "oak-preview"),
      ),
    [baseLayers, homebase?.id, user?.id, voyage, scene],
  )

  const selectedAvatar =
    selected?.type === "avatar" ? avatars.find((a) => a.key === selected.id) : undefined
  const selectedHouse =
    selected?.type === "house"
      ? scene?.houses.find((h) => h.activity.id === selected.id)
      : undefined
  const selectedItem = selected?.type === "item" ? catalogue.get(selected.itemId) : undefined
  const selectedKey = selectedAvatar
    ? `avatar-${selectedAvatar.key}`
    : selectedHouse
      ? `house-${selectedHouse.activity.id}`
      : selected?.type === "item"
        ? selected.id
        : undefined

  function openActivity(activityId: string) {
    navigation.navigate("ActivityDetail", { activityId })
  }

  function startPlanting() {
    if (!homebase || !canPlant || editing || plantingLock.current || voyage) return
    setSelected(undefined)
    setGardenError("")
    setPlanting({ homebaseId: homebase.id })
  }

  function tapWorld({
    islandKey,
    hit,
    x,
    y,
  }: {
    islandKey?: string
    hit?: HitTarget
    x: number
    y: number
  }) {
    if (plantingLock.current || voyage || !islandKey) return
    if (islandKey !== homebase?.id) {
      sailTo(islandKey)
      return
    }
    if (!editing || !homebase) {
      // A second tap on a selected cottage walks in.
      if (hit?.type === "house" && selected?.type === "house" && selected.id === hit.id)
        openActivity(hit.id)
      else setSelected(hit)
      return
    }
    const { point, rejection } = plantingTap(scene!.frame, x, y)
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
    // A keyboard/screen-reader path that doesn't require a canvas gesture.
    const points = [...plantableTiles()].sort(
      (a, b) =>
        Math.hypot(a.col + 0.5 - homeFocus.u, a.row + 0.5 - homeFocus.v) -
        Math.hypot(b.col + 0.5 - homeFocus.u, b.row + 0.5 - homeFocus.v),
    )
    const index = points.findIndex(
      ({ col, row }) => col * 16 + 8 === position?.x && row * 16 + 8 === position.y,
    )
    const next = points[(index + 1) % points.length]
    if (!next) return
    setCameraReset((value) => value + 1)
    setPlanting({
      homebaseId: homebase.id,
      position: { x: next.col * 16 + 8, y: next.row * 16 + 8 },
    })
    setGardenError("")
  }

  async function plantOak() {
    if (!position || !homebase || plantingLock.current) return
    plantingLock.current = true
    setSavingOak(true)
    setGardenError("")
    try {
      const garden = await besideApi.plantStarterOak(homebase.id, position)
      updateGarden(homebase.id, garden)
      setPlanting(undefined)
      setSelected({ type: "item", id: "starter-oak", itemId: "oak-tree" })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setGardenError("Someone already planted the shared oak.")
        setAttempt((value) => value + 1)
      } else {
        setGardenError("We couldn’t plant the oak. Try again.")
      }
    } finally {
      setSavingOak(false)
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

  const houseArt = selectedHouse
    ? cottageArt(scene!.houses.indexOf(selectedHouse), !!selectedHouse.activity.open)
    : undefined

  return (
    <SafeAreaView
      testID="homebase-screen"
      style={styles.screen}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <Text text={multipleIslands ? "YOUR ISLANDS" : "YOUR HOME BASE"} style={worldEyebrow} />
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
        {multipleIslands && (
          <IslandSwitcher
            bases={islands.map((island) => island.homebase)}
            focusedId={homebase?.id}
            disabled={!!voyage || savingOak}
            onTravel={sailTo}
          />
        )}
      </View>
      <View
        testID="homebase-world"
        style={styles.world}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
      >
        {homebase && size.width > 0 && size.height > 0 && (
          <>
            <IsoWorldCanvas
              {...size}
              islands={layers}
              focusIslandKey={homebase.id}
              voyage={voyage}
              onArrival={arrive}
              zoom={currentZoom}
              focus={homeFocus}
              resetCamera={cameraReset}
              selectedKey={editing ? undefined : selectedKey}
              guideTiles={editing ? plantableTiles() : undefined}
              previewTile={
                position ? { col: (position.x - 8) / 16, row: (position.y - 8) / 16 } : undefined
              }
              onTap={tapWorld}
              onPinch={changeZoom}
              accessibilityLabel={`${homebase.name}, an island garden. ${members.length} friends on the picnic blanket and ${activities.length} activity cottages. ${
                multipleIslands
                  ? `Other islands: ${islands
                      .filter((island) => island.homebase.id !== homebase.id)
                      .map((island) => island.homebase.name)
                      .join(", ")}. Tap an island or use the island buttons to sail there. `
                  : ""
              }${editing ? "Tap a marked tile to preview the oak." : "Drag to explore, pinch to zoom. Tap a friend, cottage or decoration."}`}
            />
            <View
              pointerEvents="none"
              style={styles.worldLabel}
              testID={editing ? "oak-placement-guide" : undefined}
            >
              <View style={[styles.dot, editing && styles.guideDot]} />
              <Text
                text={
                  editing
                    ? "Glowing tiles are plantable"
                    : voyage
                      ? "Sailing…"
                      : multipleIslands
                        ? "Your archipelago"
                        : "The island"
                }
                style={styles.labelText}
              />
            </View>
            {!editing && (
              <View style={styles.cameraControls}>
                <Pressable
                  testID="homebase-zoom-out"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                  disabled={!!voyage || currentZoom <= stops[0]!}
                  style={[styles.chip, (!!voyage || currentZoom <= stops[0]!) && styles.disabled]}
                  onPress={() => changeZoom(-1)}
                >
                  <Text text="−" style={styles.chipText} />
                </Pressable>
                <Pressable
                  testID="homebase-zoom-in"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                  disabled={!!voyage || currentZoom >= stops[stops.length - 1]!}
                  style={[
                    styles.chip,
                    (!!voyage || currentZoom >= stops[stops.length - 1]!) && styles.disabled,
                  ]}
                  onPress={() => changeZoom(1)}
                >
                  <Text text="+" style={styles.chipText} />
                </Pressable>
                <Pressable
                  testID="homebase-recenter"
                  accessibilityRole="button"
                  accessibilityLabel="Recenter on your friends"
                  disabled={!!voyage}
                  style={styles.chip}
                  onPress={() => {
                    setZoom(undefined)
                    setCameraReset((value) => value + 1)
                  }}
                >
                  <Text text="Recenter" style={styles.smallText} />
                </Pressable>
              </View>
            )}
          </>
        )}
        {!data && busy && (
          <View style={styles.loading}>
            <ActivityIndicator color={world.forest} />
            <Text text="Opening your island…" style={styles.body} />
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
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
        <View style={styles.detail}>
          <View style={styles.thumbnail}>
            {selectedAvatar ? (
              <PixelArtSprite art={selectedAvatar.frames.idle} scale={2.5} />
            ) : houseArt ? (
              <PixelArtSprite art={houseArt} scale={1} />
            ) : selectedItem ? (
              <RewardSprite item={selectedItem} scale={1.5} />
            ) : (
              (avatars.find((a) => a.key === user?.id) ?? avatars[0]) && (
                <PixelArtSprite
                  art={(avatars.find((a) => a.key === user?.id) ?? avatars[0])!.frames.idle}
                  scale={2.5}
                />
              )
            )}
          </View>
          <View style={styles.detailText}>
            <Text
              testID="homebase-selected-member"
              text={
                selectedAvatar?.name ??
                selectedHouse?.activity.name ??
                (selected?.type === "item" && selected.id === "starter-oak"
                  ? "Your shared oak"
                  : selectedItem?.name) ??
                "Your people, together"
              }
              weight="semiBold"
              style={styles.sectionTitle}
              accessibilityLiveRegion="polite"
              numberOfLines={1}
            />
            <Text
              text={
                selectedAvatar
                  ? "Part of your home base."
                  : selectedHouse
                    ? selectedHouse.activity.open
                      ? "Lights are on: a session is open now."
                      : "An activity cottage. Open it to plan or check in."
                    : selected?.type === "item"
                      ? selected.id.startsWith("reward-")
                        ? "Earned together."
                        : selected.id === "starter-oak"
                          ? "Planted in your shared garden."
                          : "Part of the meadow."
                      : `${members.length} members · ${activities.length} activity ${activities.length === 1 ? "cottage" : "cottages"}. Tap a friend or a cottage.`
              }
              style={styles.description}
            />
          </View>
          {selectedHouse && (
            <Pressable
              testID="homebase-open-activity"
              accessibilityRole="button"
              accessibilityLabel={`Open ${selectedHouse.activity.name}`}
              style={({ pressed }) => [styles.open, pressed && styles.pressed]}
              onPress={() => openActivity(selectedHouse.activity.id)}
            >
              <Text text="Open" weight="medium" style={styles.primaryText} />
            </Pressable>
          )}
        </View>
        {homebase && (
          <Text
            testID="homebase-member-count"
            text={`${members.length} members`}
            style={styles.count}
          />
        )}
        <View style={styles.actions}>
          <Pressable
            testID="homebase-create-activity"
            accessibilityRole="button"
            disabled={!homebase || !!voyage}
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
            disabled={!homebase || !!voyage}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              homebase && navigation.navigate("Activities", { connectionId: homebase.id })
            }
          >
            <Text text="Activities" weight="medium" style={styles.secondaryText} />
          </Pressable>
          {canPlant && (
            <Pressable
              testID="start-planting-oak"
              accessibilityRole="button"
              accessibilityState={{ expanded: editing }}
              disabled={!!voyage}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={startPlanting}
            >
              <Text text="Plant" weight="medium" style={styles.secondaryText} />
            </Pressable>
          )}
        </View>
        {oak && (
          <Text
            testID="homebase-starter-oak"
            text="Your shared oak is planted on the island."
            style={styles.count}
          />
        )}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  body: { color: world.text, fontSize: 14, lineHeight: 22 },
  cameraControls: {
    bottom: 12,
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    right: 12,
  },
  chip: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.smallRadius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  chipText: { color: world.ink, fontSize: 20, lineHeight: 24 },
  count: { color: world.muted, fontSize: 11, lineHeight: 16 },
  description: { color: world.muted, fontSize: 12, lineHeight: 18 },
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 72 },
  detailText: { flex: 1, gap: 3 },
  disabled: { opacity: 0.45 },
  dock: {
    backgroundColor: world.paper,
    borderTopColor: world.line,
    borderTopWidth: worldShape.border,
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  dot: { backgroundColor: world.leaf, height: 5, width: 5 },
  error: { color: world.error, fontSize: 13, lineHeight: 20 },
  guideDot: {
    backgroundColor: world.onForest,
    borderColor: world.forest,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  header: { paddingBottom: 14, paddingHorizontal: 20, paddingTop: 4 },
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
  open: {
    alignItems: "center",
    backgroundColor: world.forest,
    borderRadius: worldShape.radius,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
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
  smallText: { color: world.text, fontSize: 13, lineHeight: 20 },
  subtitle: { color: world.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  thumbnail: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    height: 72,
    justifyContent: "center",
    overflow: "hidden",
    width: 72,
  },
  title: { color: world.ink, fontSize: 27, lineHeight: 34 },
  world: { backgroundColor: world.sea, flex: 1, overflow: "hidden" },
  worldLabel: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderRadius: worldShape.smallRadius,
    flexDirection: "row",
    gap: 7,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    top: 12,
  },
})
