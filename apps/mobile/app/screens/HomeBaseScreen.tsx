import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, PixelRatio, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError, type ApiState, type HomebaseGarden } from "@beside/api-client"
import type { MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PixelArtSprite } from "@/components/BesideMark"
import { cottageArt } from "@/components/iso-world/cottageArt"
import {
  homeFocus,
  nextSuggestion,
  rewardKey,
  plantableTiles,
  plantingTap,
} from "@/components/iso-world/homeWorld"
import { IsoWorldCanvas } from "@/components/iso-world/IsoWorldCanvas"
import { meadowToIso } from "@/components/iso-world/projection"
import { catalogue, itemDrawable, type HitTarget } from "@/components/iso-world/scene"
import { firstNamesLabel } from "@/components/pixel-world/avatars"
import { PlaceRewardPanel } from "@/components/pixel-world/PlaceRewardPanel"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import { oakAt } from "@/components/pixel-world/starterOak"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { firstName, namesLabel, rewardMemory, rewardsToPlace } from "@/utils/rewardChoice"

import {
  focusedIslandLayers,
  snapZoom,
  stepZoom,
  zoomStops,
} from "@/components/iso-world/archipelago"
import { IslandSwitcher } from "@/components/iso-world/IslandSwitcher"
import { useArchipelagoTravel } from "@/components/iso-world/useArchipelagoTravel"
import { useHomeArchipelago } from "@/components/iso-world/useHomeArchipelago"

type PlacementTarget = { kind: "oak" } | { kind: "reward"; rewardId: string; itemId: string }
const friends = { x: homeFocus.u * 16, y: homeFocus.v * 16 }
const placedRewards = (garden?: HomebaseGarden) => garden?.rewards ?? []

function placementMessage(rejection: string | null) {
  return rejection === "occupied"
    ? "That spot is occupied."
    : rejection
      ? "Choose a clear patch of lawn."
      : ""
}

export function HomeBaseScreen(props: AppStackScreenProps<"HomeBase">) {
  const { user } = useAuth()
  return <HomeArchipelagoScreen key={user?.id ?? "anonymous"} {...props} userId={user?.id} />
}

function HomeArchipelagoScreen({
  navigation,
  route,
  userId,
}: AppStackScreenProps<"HomeBase"> & { userId?: string }) {
  const [attempt, setAttempt] = useState(0)
  const archipelago = useHomeArchipelago(userId, route.params?.connectionId, attempt)
  return (
    <HomeIslandScreen
      key={archipelago.focused?.homebase.id ?? route.params?.connectionId ?? "loading"}
      navigation={navigation}
      route={route}
      userId={userId}
      archipelago={archipelago}
      retry={() => setAttempt((value) => value + 1)}
    />
  )
}

function HomeIslandScreen({
  navigation,
  route,
  userId,
  archipelago,
  retry,
}: AppStackScreenProps<"HomeBase"> & {
  userId?: string
  archipelago: ReturnType<typeof useHomeArchipelago>
  retry: () => void
}) {
  const { logout } = useAuth()
  const {
    data: shared,
    focused,
    islands,
    focusIsland,
    beginGardenUpdate,
    busy,
    error,
    setError,
  } = archipelago
  const homebase = focused?.homebase
  const data = shared && { state: shared.state, garden: focused?.garden }
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>()
  const [cameraReset, setCameraReset] = useState(0)
  const [zoom, setZoom] = useState<number>()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [planting, setPlanting] = useState<{
    homebaseId: string
    target: PlacementTarget
    position?: MeadowPoint
  }>()
  const [gardenError, setGardenError] = useState("")
  const [savingOak, setSavingOak] = useState(false)
  const [focus, setFocus] = useState<MeadowPoint>()
  const plantingLock = useRef(false)
  const viewSession = useRef<object | undefined>(undefined)
  // Follow reward links after this island’s garden has loaded.
  const params = useRef(route.params)
  params.current = route.params

  useFocusEffect(
    useCallback(() => {
      viewSession.current = {}
      setSavingOak(plantingLock.current)
      setPlanting(undefined)
      setGardenError("")
      return () => {
        viewSession.current = undefined
      }
    }, []),
  )

  const members = focused?.members ?? []
  const avatars = focused?.avatars ?? []
  const activities = focused?.activities ?? []
  const multipleIslands = islands.length > 1
  const stops = useMemo(() => zoomStops(PixelRatio.get(), multipleIslands), [multipleIslands])
  const autoZoom = snapZoom(size.width >= 700 ? 3 : 2, stops)
  const currentZoom = multipleIslands ? snapZoom(zoom ?? autoZoom, stops) : (zoom ?? autoZoom)
  const changeZoom = (direction: 1 | -1) =>
    setZoom(
      multipleIslands
        ? stepZoom(currentZoom, direction, stops)
        : Math.max(1, Math.min(4, currentZoom + direction)),
    )
  const baseLayers = useMemo(() => islands.map((island) => island.layer), [islands])
  const onArrive = useCallback(
    (id: string) => {
      focusIsland(id)
      navigation.setParams({ connectionId: id })
    },
    [focusIsland, navigation],
  )
  const { voyage, travel, arrive } = useArchipelagoTravel({
    layers: baseLayers,
    focusedId: homebase?.id,
    avatar: avatars.find((avatar) => avatar.key === userId),
    arrivalZoom: autoZoom,
    onArrive,
  })
  function sailTo(id: string) {
    if (plantingLock.current || voyage || busy || id === homebase?.id) return
    setSelectedKey(undefined)
    setPlanting(undefined)
    setGardenError("")
    setFocus(undefined)
    travel(id)
  }
  const selected = avatars.find((avatar) => avatar.key === selectedKey)
  const oak = data?.garden?.oak
  const placements = useMemo(() => placedRewards(data?.garden), [data?.garden])
  const placedIds = useMemo(() => new Set(placements.map((p) => p.rewardId)), [placements])
  const waiting = data && homebase ? rewardsToPlace(data.state, homebase.id, placedIds) : []
  const canPlant = !!data?.garden && !oak && !busy && !voyage
  const target = planting?.homebaseId === homebase?.id ? planting?.target : undefined
  const editing =
    !!target && !!data?.garden && !busy && !voyage && (target.kind === "reward" || canPlant)
  const movingId = editing && target?.kind === "reward" ? target.rewardId : undefined
  const position = editing ? planting?.position : undefined
  // Everything already standing except what is being placed, as the API sees it.
  const occupied = useMemo(
    () => [...(oak ? [oak] : []), ...placements.filter((p) => p.rewardId !== movingId)],
    [oak, placements, movingId],
  )
  const guideTiles = useMemo(() => (editing ? plantableTiles(occupied) : []), [editing, occupied])
  const guide = guideTiles.map(({ col, row }) => ({ x: col * 16 + 8, y: row * 16 + 8 }))
  const worldItems = focused?.items ?? []
  const previewItemId = target?.kind === "reward" ? target.itemId : oakAt({ x: 0, y: 0 }).itemId
  const placingItem = target?.kind === "reward" ? catalogue.get(target.itemId) : undefined

  const layers = useMemo(() => {
    const editedLayers = baseLayers.map((layer) =>
      layer.key === homebase?.id && movingId
        ? { ...layer, drawables: layer.drawables.filter((d) => d.key !== rewardKey(movingId)) }
        : layer,
    )
    const built = focused?.scene
    const point = position && meadowToIso(position.x, position.y)
    const preview =
      built &&
      point &&
      itemDrawable(built.frame, built.map, "placement-preview", previewItemId, point.u, point.v, {
        opacity: 0.72,
        hit: undefined,
      })
    return focusedIslandLayers(editedLayers, homebase?.id, userId, !!voyage, preview || undefined)
  }, [baseLayers, homebase?.id, movingId, focused, position, previewItemId, userId, voyage])
  const scene = focused?.scene
  const selectedHouse = scene?.houses.find((h) => `house-${h.activity.id}` === selectedKey)
  const houseArt = selectedHouse
    ? cottageArt(scene!.houses.indexOf(selectedHouse), !!selectedHouse.activity.open)
    : undefined

  function openActivity(activityId: string) {
    navigation.navigate("ActivityDetail", { activityId })
  }

  function rewardStory(state: ApiState, rewardId: string) {
    const { milestone, activity } = rewardMemory(state, rewardId)
    return milestone
      ? `Earned for “${milestone.name}”${activity ? ` · ${activity.name}` : ""}`
      : "Earned together"
  }

  function startPlanting() {
    if (!homebase || !canPlant || editing || plantingLock.current || voyage) return
    setSelectedKey(undefined)
    setFocus(undefined)
    setGardenError("")
    setPlanting({ homebaseId: homebase.id, target: { kind: "oak" } })
  }

  /** Start placing (or moving) a reward, with a suggested spot already previewed. */
  function startPlacingReward(
    homebaseId: string,
    rewardId: string,
    itemId: string,
    garden: HomebaseGarden,
  ) {
    if (plantingLock.current || voyage || busy || homebaseId !== homebase?.id) return
    const others = [
      ...(garden.oak ? [garden.oak] : []),
      ...placedRewards(garden).filter((p) => p.rewardId !== rewardId),
    ]
    setSelectedKey(undefined)
    setGardenError("")
    setFocus(undefined)
    setCameraReset((value) => value + 1)
    setPlanting({
      homebaseId,
      target: { kind: "reward", rewardId, itemId },
      position: nextSuggestion(
        plantableTiles(others).map(({ col, row }) => ({ x: col * 16 + 8, y: row * 16 + 8 })),
        friends,
      ),
    })
  }

  /** Follow a link from an activity: place a fresh reward, or show one in the meadow. */
  function openLinkedReward(homebaseId: string, state: ApiState, garden: HomebaseGarden) {
    const { rewardId, place } = params.current ?? {}
    if (!rewardId || (params.current?.connectionId && params.current.connectionId !== homebaseId))
      return
    const reward = state.rewards.find((r) => r.id === rewardId && r.homebaseId === homebaseId)
    if (!reward?.obtainedAt || consumedLink.current === rewardId) return
    consumedLink.current = rewardId
    navigation.setParams({ rewardId: undefined, place: undefined })
    const placed = placedRewards(garden).find((p) => p.rewardId === rewardId)
    if (place && !placed) startPlacingReward(homebaseId, reward.id, reward.itemId, garden)
    else if (placed) {
      setSelectedKey(rewardKey(rewardId))
      setFocus(placed)
      setCameraReset((value) => value + 1)
    }
  }
  const consumedLink = useRef<string | undefined>(undefined)
  const linkedReward = useRef(openLinkedReward)
  linkedReward.current = openLinkedReward

  useEffect(() => {
    if (!route.params?.rewardId) consumedLink.current = undefined
  }, [route.params?.rewardId])

  useEffect(() => {
    if (!busy && !voyage && homebase && shared && focused?.garden)
      linkedReward.current(homebase.id, shared.state, focused.garden)
  }, [busy, voyage, homebase, shared, focused?.garden])

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
    if (plantingLock.current || voyage) return
    if (multipleIslands && islandKey && islandKey !== homebase?.id) {
      sailTo(islandKey)
      return
    }
    if (!editing || !homebase || !target) {
      if (hit?.type === "house" && selectedKey === `house-${hit.id}`) openActivity(hit.id)
      else
        setSelectedKey(
          hit?.type === "avatar" ? hit.id : hit?.type === "house" ? `house-${hit.id}` : hit?.id,
        )
      return
    }
    const { point, rejection } = plantingTap(scene!.frame, x, y, occupied)
    setPlanting({ homebaseId: homebase.id, target, position: rejection ? undefined : point })
    setGardenError(placementMessage(rejection))
  }

  function suggestSpot() {
    if (!homebase || !editing || !target || plantingLock.current) return
    // Offer a keyboard/screen-reader path without requiring a canvas gesture.
    const next = nextSuggestion(guide, friends, position)
    if (!next) return
    setCameraReset((value) => value + 1)
    setPlanting({ homebaseId: homebase.id, target, position: next })
    setGardenError("")
  }

  async function placeReward() {
    if (
      !editing ||
      !position ||
      !homebase ||
      target?.kind !== "reward" ||
      plantingLock.current ||
      !viewSession.current
    )
      return
    const session = viewSession.current
    const update = beginGardenUpdate(homebase.id)
    plantingLock.current = true
    setSavingOak(true)
    setGardenError("")
    try {
      const garden = await besideApi.placeReward(homebase.id, target.rewardId, position)
      if (!update(garden) || viewSession.current !== session) return
      const key = rewardKey(target.rewardId)
      setPlanting(undefined)
      setSelectedKey(key)
      // Keep the confirmed reward in view.
      setFocus(position)
      setCameraReset((value) => value + 1)
    } catch (e) {
      if (viewSession.current !== session) return
      setGardenError(
        e instanceof ApiError && (e.status === 400 || e.status === 409)
          ? e.message
          : "We couldn’t place it. Try again.",
      )
      if (e instanceof ApiError && e.status === 400) {
        // Another member may have occupied this spot. Refresh the guide without
        // closing the editor or losing the reason the placement was refused.
        setPlanting((current) => current && { ...current, position: undefined })
        try {
          const garden = await besideApi.homebaseGarden(homebase.id)
          if (!update(garden) || viewSession.current !== session) return
        } catch {
          if (viewSession.current !== session) return
          setGardenError("We couldn’t refresh free spots. Cancel and try again.")
        }
      }
    } finally {
      setSavingOak(false)
      plantingLock.current = false
    }
  }

  useEffect(() => {
    // A selection that no longer exists (e.g. after a refresh) should not linger.
    if (selectedKey?.startsWith("reward-") && !worldItems.some((i) => i.key === selectedKey))
      setSelectedKey(undefined)
  }, [selectedKey, worldItems])

  const selectedPlacement = placements.find((p) => rewardKey(p.rewardId) === selectedKey)
  const selectedItem = selected ? undefined : worldItems.find((item) => item.key === selectedKey)
  const selectedArt = selectedItem && catalogue.get(selectedItem.itemId)
  const memory =
    selectedPlacement && data ? rewardMemory(data.state, selectedPlacement.rewardId) : undefined
  const selectedReward =
    selectedPlacement && data?.state.rewards.find((r) => r.id === selectedPlacement.rewardId)
  const earnedBy =
    selectedReward && data
      ? selectedReward.requiredUserIds
          .map((id) => data.state.users.find((u) => u.id === id)?.name)
          .filter((name): name is string => !!name)
          .map(firstName)
      : []
  const nextUp = waiting[0]
  const nextUpItem = nextUp && catalogue.get(nextUp.itemId)

  async function plantOak() {
    if (
      !editing ||
      !position ||
      !homebase ||
      target?.kind !== "oak" ||
      plantingLock.current ||
      !viewSession.current
    )
      return
    const session = viewSession.current
    const update = beginGardenUpdate(homebase.id)
    plantingLock.current = true
    setSavingOak(true)
    setGardenError("")
    try {
      const garden = await besideApi.plantStarterOak(homebase.id, position)
      if (!update(garden) || viewSession.current !== session) return
      setPlanting(undefined)
      setSelectedKey("starter-oak")
      setFocus(position)
      setCameraReset((value) => value + 1)
    } catch (e) {
      if (viewSession.current !== session) return
      if (e instanceof ApiError && e.status === 409) {
        setPlanting(undefined)
        setGardenError("Someone already planted the shared oak.")
        update(undefined)
        try {
          const garden = await besideApi.homebaseGarden(homebase.id)
          if (!update(garden) || viewSession.current !== session) return
        } catch (refreshError) {
          if (viewSession.current !== session) return
          if (refreshError instanceof ApiError && refreshError.status === 404) {
            update(undefined)
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
            disabled={!!voyage || savingOak || busy}
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
              {...(multipleIslands
                ? { islands: layers, focusIslandKey: homebase.id }
                : {
                    map: scene!.map,
                    frame: scene!.frame,
                    drawables: layers[0]!.drawables,
                  })}
              voyage={voyage}
              onArrival={arrive}
              zoom={currentZoom}
              focus={
                position
                  ? meadowToIso(position.x, position.y)
                  : focus && !editing
                    ? meadowToIso(focus.x, focus.y)
                    : homeFocus
              }
              resetCamera={cameraReset}
              selectedKey={editing ? undefined : selected ? `avatar-${selected.key}` : selectedKey}
              guideTiles={editing ? guideTiles : undefined}
              previewTile={
                position ? { col: (position.x - 8) / 16, row: (position.y - 8) / 16 } : undefined
              }
              onTap={tapWorld}
              onPinch={changeZoom}
              accessibilityLabel={`${homebase.name}, an island garden. ${members.length} members: ${members.map((member) => member.name).join(", ")}. ${activities.length} activity cottages. ${multipleIslands ? "Use the island buttons or tap another island to sail there. " : ""}${editing ? `Tap a marked lawn tile to preview the ${placingItem?.name ?? "oak"}, or use Suggest spot.` : "Drag to explore, pinch to zoom. Tap a friend, cottage or reward to learn about it."}`}
            />
            <View
              pointerEvents="none"
              style={styles.worldLabel}
              testID={
                editing
                  ? target?.kind === "reward"
                    ? "reward-placement-guide"
                    : "oak-placement-guide"
                  : undefined
              }
            >
              <View style={[styles.dot, editing && styles.guideDot]} />
              <Text
                text={
                  editing
                    ? target?.kind === "reward"
                      ? "Marked spots are free lawn"
                      : "Marked spots are plantable"
                    : voyage
                      ? "Sailing…"
                      : multipleIslands
                        ? "The archipelago"
                        : "The island"
                }
                style={styles.labelText}
              />
            </View>
            {!editing && !voyage && (
              <View style={styles.cameraControls}>
                <Pressable
                  testID="homebase-zoom-out"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                  disabled={currentZoom <= (multipleIslands ? stops[0]! : 1)}
                  style={[
                    styles.chip,
                    currentZoom <= (multipleIslands ? stops[0]! : 1) && styles.disabled,
                  ]}
                  onPress={() => changeZoom(-1)}
                >
                  <Text text="−" style={styles.chipText} />
                </Pressable>
                <Pressable
                  testID="homebase-zoom-in"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                  disabled={currentZoom >= 4}
                  style={[styles.chip, currentZoom >= 4 && styles.disabled]}
                  onPress={() => changeZoom(1)}
                >
                  <Text text="+" style={styles.chipText} />
                </Pressable>
                <Pressable
                  testID="homebase-recenter"
                  accessibilityRole="button"
                  accessibilityLabel="Recenter on your friends"
                  style={styles.chip}
                  onPress={() => {
                    setFocus(undefined)
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
        {!!data?.garden && (
          <View testID="homebase-garden-status" style={styles.gardenStatus}>
            {oak && !nextUp && (
              <Text
                testID="homebase-starter-oak"
                text="Planted in your shared garden"
                style={styles.plantedLabel}
                accessibilityLiveRegion="polite"
              />
            )}
            {canPlant && !editing && (
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
            <Pressable accessibilityRole="button" onPress={retry}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
        {selectedPlacement && memory && selectedArt ? (
          <View style={styles.detail} testID="homebase-reward-memory">
            <View style={styles.thumbnail}>
              <RewardSprite item={selectedArt} scale={1.5} />
            </View>
            <View style={styles.detailText}>
              <Text
                testID="homebase-selected-reward"
                text={selectedArt.name}
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <Text
                text={data ? rewardStory(data.state, selectedPlacement.rewardId) : ""}
                style={styles.description}
              />
              <Text
                text={[
                  selectedReward?.obtainedAt &&
                    new Date(selectedReward.obtainedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                  earnedBy.length ? `with ${namesLabel(earnedBy)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                style={styles.description}
              />
            </View>
            {!editing && data?.garden && homebase && (
              <Pressable
                testID="homebase-move-reward"
                accessibilityRole="button"
                style={styles.logout}
                onPress={() =>
                  startPlacingReward(
                    homebase.id,
                    selectedPlacement.rewardId,
                    selectedPlacement.itemId,
                    data.garden!,
                  )
                }
              >
                <Text text="Move" style={styles.smallText} />
              </Pressable>
            )}
          </View>
        ) : selectedHouse && houseArt ? (
          <View style={styles.detail}>
            <View style={styles.thumbnail}>
              <PixelArtSprite art={houseArt} scale={1} />
            </View>
            <View style={styles.detailText}>
              <Text
                text={selectedHouse.activity.name}
                weight="semiBold"
                style={styles.sectionTitle}
              />
              <Text
                text={
                  selectedHouse.activity.open
                    ? "Lights are on: a session is open now."
                    : "An activity cottage. Open it to plan or check in."
                }
                style={styles.description}
              />
            </View>
            <Pressable
              testID="homebase-open-activity"
              accessibilityRole="button"
              accessibilityLabel={`Open ${selectedHouse.activity.name}`}
              style={styles.placeButton}
              onPress={() => openActivity(selectedHouse.activity.id)}
            >
              <Text text="Open" weight="medium" style={styles.primaryText} />
            </Pressable>
          </View>
        ) : selectedItem && selectedArt ? (
          <View style={styles.detail}>
            <View style={styles.thumbnail}>
              <RewardSprite item={selectedArt} scale={1.5} />
            </View>
            <View style={styles.detailText}>
              <Text
                text={selectedArt.name}
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <Text
                text={
                  selectedItem.key === "starter-oak"
                    ? "Your starter oak, planted together."
                    : "Part of the meadow."
                }
                style={styles.description}
              />
            </View>
          </View>
        ) : !selected && nextUp && nextUpItem && !editing ? (
          <View style={[styles.detail, styles.waiting]} testID="homebase-reward-waiting">
            <View style={styles.thumbnail}>
              <RewardSprite item={nextUpItem} scale={1.5} />
            </View>
            <View style={styles.detailText}>
              <Text
                text={`${nextUpItem.name} is waiting`}
                weight="semiBold"
                style={styles.sectionTitle}
                accessibilityLiveRegion="polite"
              />
              <Text
                text={`${data ? rewardStory(data.state, nextUp.id) : "Earned together"}. Find it a spot.${waiting.length > 1 ? ` ${waiting.length - 1} more waiting.` : ""}`}
                style={styles.description}
              />
            </View>
            <Pressable
              testID="homebase-place-reward"
              accessibilityRole="button"
              style={styles.placeButton}
              onPress={() =>
                homebase &&
                data?.garden &&
                startPlacingReward(homebase.id, nextUp.id, nextUp.itemId, data.garden)
              }
            >
              <Text text="Place" weight="medium" style={styles.primaryText} />
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
                text={
                  selected
                    ? "Part of your home base."
                    : "Tap a friend, cottage or reward on the island."
                }
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
        </View>
      </View>
      {editing && target?.kind === "reward" && placingItem && data && (
        <PlaceRewardPanel
          item={placingItem}
          story={rewardStory(data.state, target.rewardId)}
          moving={placedIds.has(target.rewardId)}
          hasPreview={!!position}
          saving={savingOak}
          error={gardenError}
          onCancel={() => {
            setPlanting(undefined)
            setGardenError("")
          }}
          onPlace={() => void placeReward()}
          onSuggest={suggestSpot}
        />
      )}
      {editing && target?.kind === "oak" && (
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
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64 },
  detailText: { flex: 1, gap: 3 },
  disabled: { opacity: 0.45 },
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
  placeButton: {
    alignItems: "center",
    backgroundColor: world.forest,
    borderRadius: worldShape.radius,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
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
  waiting: {
    backgroundColor: world.meadow,
    borderColor: world.leaf,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    padding: 8,
  },
  world: { backgroundColor: world.sea, flex: 1, overflow: "hidden" },
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
