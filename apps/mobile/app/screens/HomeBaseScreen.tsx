import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import type { MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import {
  nextSuggestion,
  placementGuide,
  placementTap,
  rewardKey,
} from "@/components/pixel-world/placement"
import { PlaceRewardPanel } from "@/components/pixel-world/PlaceRewardPanel"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import {
  avatarAt,
  catalogue,
  hitTest,
  initialItems,
  type WorldItem,
} from "@/components/pixel-world/scene"
import { oakAt } from "@/components/pixel-world/starterOak"
import { GROUP_BLANKET } from "@/components/pixel-world/terrain"
import { WorldCanvas } from "@/components/pixel-world/WorldCanvas"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { firstName, namesLabel, rewardMemory, rewardsToPlace } from "@/utils/rewardChoice"

const homeFraming = { scale: 4, centerX: (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2, centerY: 110 }
const compactHomeFraming = { ...homeFraming, scale: 3, centerY: 120 }

type HomeData = { homebase?: ApiHomebase; state: ApiState; garden?: HomebaseGarden }
type PlacementTarget = { kind: "oak" } | { kind: "reward"; rewardId: string; itemId: string }
const friends = { x: homeFraming.centerX, y: 92 }

function placementMessage(rejection: string | null) {
  return rejection === "occupied"
    ? "That spot is occupied."
    : rejection
      ? "Choose a clear patch of lawn."
      : ""
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
  const [planting, setPlanting] = useState<{
    homebaseId: string
    target: PlacementTarget
    position?: MeadowPoint
  }>()
  const [gardenError, setGardenError] = useState("")
  const [savingOak, setSavingOak] = useState(false)
  const [justPlanted, setJustPlanted] = useState<{ homebaseId: string; item: WorldItem }>()
  const [focus, setFocus] = useState<MeadowPoint>()
  const plantingLock = useRef(false)
  // Read the latest deep-link params inside the loader without re-running it.
  const params = useRef(route.params)
  params.current = route.params

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      setPlanting(undefined)
      setJustPlanted(undefined)
      setGardenError("")
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(async ([bases, state]) => {
          if (!active) return
          const homebase = selectHomebase(bases, state.users, route.params?.connectionId)
          setData((current) => ({
            homebase,
            state,
            garden: current?.homebase?.id === homebase?.id ? current?.garden : undefined,
          }))
          if (!homebase) return
          try {
            const garden = await besideApi.homebaseGarden(homebase.id)
            if (!active) return
            setData({ homebase, state, garden })
            linkedReward.current(homebase.id, state, garden)
          } catch (e) {
            // A web build can be opened before the garden endpoint is deployed.
            if (active && !(e instanceof ApiError && e.status === 404))
              setError("We couldn’t load garden decorations. Please try again.")
          }
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
  const placements = useMemo(() => data?.garden?.rewards ?? [], [data?.garden])
  const placedIds = useMemo(() => new Set(placements.map((p) => p.rewardId)), [placements])
  const waiting = data && homebase ? rewardsToPlace(data.state, homebase.id, placedIds) : []
  const canPlant = !!data?.garden && !oak && !busy
  const target = planting?.homebaseId === homebase?.id ? planting?.target : undefined
  const editing = !!target && !!data?.garden && !busy && (target.kind === "reward" || canPlant)
  const movingId = editing && target?.kind === "reward" ? target.rewardId : undefined
  const position = editing ? planting?.position : undefined
  // Everything already standing except what is being placed, as the API sees it.
  const occupied = useMemo(
    () => [...(oak ? [oak] : []), ...placements.filter((p) => p.rewardId !== movingId)],
    [oak, placements, movingId],
  )
  const guide = useMemo(() => (editing ? placementGuide(occupied) : []), [editing, occupied])
  const worldItems = useMemo<WorldItem[]>(
    () => [
      ...initialItems,
      ...(oak ? [oakAt(oak)] : []),
      ...placements
        .filter((p) => p.rewardId !== movingId)
        .map((p) => ({ key: rewardKey(p.rewardId), itemId: p.itemId, x: p.x, y: p.y })),
    ],
    [oak, placements, movingId],
  )
  const previewItemId = target?.kind === "reward" ? target.itemId : oakAt({ x: 0, y: 0 }).itemId
  const placingItem = target?.kind === "reward" ? catalogue.get(target.itemId) : undefined

  function rewardStory(state: ApiState, rewardId: string) {
    const { milestone, activity } = rewardMemory(state, rewardId)
    return milestone
      ? `Earned for “${milestone.name}”${activity ? ` · ${activity.name}` : ""}`
      : "Earned together"
  }

  function startPlanting() {
    if (!homebase || !canPlant || editing || plantingLock.current) return
    setSelectedKey(undefined)
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
    if (plantingLock.current) return
    const others = [
      ...(garden.oak ? [garden.oak] : []),
      ...garden.rewards.filter((p) => p.rewardId !== rewardId),
    ]
    setSelectedKey(undefined)
    setGardenError("")
    setFocus(undefined)
    setCameraReset((value) => value + 1)
    setPlanting({
      homebaseId,
      target: { kind: "reward", rewardId, itemId },
      position: nextSuggestion(placementGuide(others), friends),
    })
  }

  /** Follow a link from an activity: place a fresh reward, or show one in the meadow. */
  function openLinkedReward(homebaseId: string, state: ApiState, garden: HomebaseGarden) {
    const { rewardId, place } = params.current ?? {}
    if (!rewardId) return
    navigation.setParams({ rewardId: undefined, place: undefined })
    const reward = state.rewards.find((r) => r.id === rewardId && r.homebaseId === homebaseId)
    if (!reward?.obtainedAt) return
    const placed = garden.rewards.find((p) => p.rewardId === rewardId)
    if (place && !placed) startPlacingReward(homebaseId, reward.id, reward.itemId, garden)
    else if (placed) {
      setSelectedKey(rewardKey(rewardId))
      setFocus(placed)
      setCameraReset((value) => value + 1)
    }
  }

  const linkedReward = useRef(openLinkedReward)
  linkedReward.current = openLinkedReward

  function tapWorld(x: number, y: number, scale: number) {
    if (plantingLock.current) return
    if (!editing || !homebase || !target) {
      setSelectedKey(avatarAt(x, y, scale, avatars)?.key ?? hitTest(worldItems, x, y, scale)?.key)
      return
    }
    const { point, rejection } = placementTap(x, y, occupied)
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
      setJustPlanted({ homebaseId: homebase.id, item: oakAt(position, homebase.id) })
      setPlanting(undefined)
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

  async function placeReward() {
    if (!position || !homebase || target?.kind !== "reward" || plantingLock.current) return
    plantingLock.current = true
    setSavingOak(true)
    setGardenError("")
    try {
      const garden = await besideApi.placeReward(homebase.id, target.rewardId, position)
      setData((current) =>
        current?.homebase?.id === homebase.id ? { ...current, garden } : current,
      )
      const key = rewardKey(target.rewardId)
      setJustPlanted({
        homebaseId: homebase.id,
        item: { key, itemId: target.itemId, ...position },
      })
      setPlanting(undefined)
      setSelectedKey(key)
    } catch (e) {
      setGardenError(
        e instanceof ApiError && (e.status === 400 || e.status === 409)
          ? e.message
          : "We couldn’t place it. Try again.",
      )
      if (e instanceof ApiError && e.status === 400) setAttempt((value) => value + 1)
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
  const earnedBy =
    selectedPlacement && data
      ? (data.state.rewards
          .find((r) => r.id === selectedPlacement.rewardId)
          ?.requiredUserIds.map((id) => data.state.users.find((u) => u.id === id)?.name)
          .filter((name): name is string => !!name)
          .map(firstName) ?? [])
      : []
  const earnedOn =
    selectedPlacement && data?.state.rewards.find((r) => r.id === selectedPlacement.rewardId)
  const nextUp = waiting[0]
  const nextUpItem = nextUp && catalogue.get(nextUp.itemId)

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
              selectedKey={selectedKey}
              preview={
                position ? { key: "preview", itemId: previewItemId, ...position } : undefined
              }
              showPlantingGuide={editing}
              guidePoints={guide}
              justPlanted={justPlanted?.homebaseId === homebase.id ? justPlanted.item : undefined}
              framing={{
                ...(size.width < 600 ? compactHomeFraming : homeFraming),
                ...(focus ? { centerX: focus.x, centerY: focus.y - 16 } : {}),
              }}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${editing ? `Tap an open patch of lawn to preview the ${placingItem?.name ?? "oak"}.` : "Drag to explore. Tap a friend or a reward to learn about it."}`}
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
                    : "The meadow"
                }
                style={styles.labelText}
              />
            </View>
            {!editing && (
              <Pressable
                testID="homebase-recenter"
                accessibilityRole="button"
                accessibilityLabel="Recenter on your friends"
                style={styles.recenter}
                onPress={() => {
                  setFocus(undefined)
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
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
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
                  earnedOn?.obtainedAt &&
                    new Date(earnedOn.obtainedAt).toLocaleDateString("en-US", {
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
                  selected ? "Part of your home base." : "Tap a friend or a reward in the meadow."
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
  count: { color: world.muted, fontSize: 11, lineHeight: 16 },
  description: { color: world.muted, fontSize: 12, lineHeight: 18 },
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64 },
  detailText: { flex: 1, gap: 3 },
  dock: { backgroundColor: world.paper, gap: 16, padding: 20, paddingBottom: 12 },
  dot: { backgroundColor: world.leaf, height: 5, width: 5 },
  error: { color: world.error, fontSize: 13, lineHeight: 20 },
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
