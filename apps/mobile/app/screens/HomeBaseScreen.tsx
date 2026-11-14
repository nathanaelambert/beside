import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import { ApiError, type ApiHomebase, type ApiState, type HomebaseGarden } from "@beside/api-client"
import type { MeadowPoint } from "@beside/api-client/garden"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import { PlantOakPanel } from "@/components/pixel-world/PlantOakPanel"
import { avatarAt, initialItems } from "@/components/pixel-world/scene"
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
import { besideApi } from "@/services/api/beside"
import { selectHomebase } from "@/services/api/homebase"
import { world, worldEyebrow, worldShape } from "@/theme/world"

const homeFraming = { scale: 4, centerX: (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2, centerY: 137 }
const plantingFraming = { ...homeFraming, centerY: 110 }
const compactPlantingFraming = { ...plantingFraming, scale: 3, centerY: 120 }

type HomeData = { homebase?: ApiHomebase; state: ApiState; garden?: HomebaseGarden }

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
  const [oakConflictIn, setOakConflictIn] = useState<string>()
  const [savingOak, setSavingOak] = useState(false)
  const [plantedIn, setPlantedIn] = useState<string>()
  const plantingLock = useRef(false)

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
            setData({ state })
            return
          }
          try {
            const garden = await besideApi.homebaseGarden(homebase.id)
            if (active) setData({ homebase, state, garden })
          } catch (e) {
            if (!active) return
            if (e instanceof ApiError && e.status === 404) {
              // Older servers have no garden route; membership can also disappear after the first request.
              const latest = (await besideApi.homebases()).find((base) => base.id === homebase.id)
              if (!active) return
              setData({ homebase: latest, state })
              if (!latest) setError("This home base is no longer available.")
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
  const framing =
    editing || justPlanted
      ? size.width < 600
        ? compactPlantingFraming
        : plantingFraming
      : homeFraming

  function startPlanting() {
    if (!homebase || !canPlant || editing || plantingLock.current) return
    setSelectedKey(undefined)
    setGardenError("")
    setOakConflictIn(undefined)
    setPlanting({ homebaseId: homebase.id })
  }

  function tapWorld(x: number, y: number, scale: number) {
    if (plantingLock.current) return
    if (!editing || !homebase) {
      setSelectedKey(avatarAt(x, y, scale, avatars)?.key)
      return
    }
    const { point, rejection } = starterOakTap(x, y)
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
    const points = [...starterOakGuidePoints()].sort(
      (a, b) =>
        Math.hypot(a.x - homeFraming.centerX, a.y - 92) -
        Math.hypot(b.x - homeFraming.centerX, b.y - 92),
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
        setOakConflictIn(homebase.id)
        setPlanting(undefined)
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
              items={oak ? [...initialItems, oakAt(oak)] : initialItems}
              avatars={avatars}
              selectedKey={selectedKey}
              preview={position ? oakAt(position, "preview") : undefined}
              showPlantingGuide={editing}
              justPlanted={justPlanted}
              framing={framing}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${members.length} members in the meadow: ${members.map((member) => member.name).join(", ")}. ${editing ? "Tap a marked spot or use Suggest spot to preview the oak." : "Drag to explore. Tap a friend to see their name."}`}
            />
            <View
              pointerEvents="none"
              style={styles.worldLabel}
              testID={editing ? "oak-placement-guide" : undefined}
            >
              <View style={[styles.dot, editing && styles.guideDot]} />
              <Text
                text={editing ? "Marked spots are plantable" : "The meadow"}
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
        {!!homebase && oakConflictIn === homebase.id && (
          <Text
            text="Someone already planted the shared oak."
            accessibilityRole="alert"
            style={styles.error}
          />
        )}
        {!editing && !!gardenError && (
          <Text text={gardenError} accessibilityRole="alert" style={styles.error} />
        )}
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
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
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
              text={selected ? "Part of your home base." : "Tap a friend in the meadow."}
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
