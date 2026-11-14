import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import type { ApiHomebase, ApiState } from "@beside/api-client"
import { buildPlans, gardenHistory } from "@beside/api-client/precursors"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import {
  gardenItems,
  gardenKey,
  itemLabel,
  seenStamp,
  unseenChange,
} from "@/components/pixel-world/garden"
import { avatarAt, catalogue, hitTest, initialItems } from "@/components/pixel-world/scene"
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

// Framed a little north of the picnic so the nearest garden plots are in view.
const homeFraming = { scale: 4, centerX: (GROUP_BLANKET.x0 + GROUP_BLANKET.x1) / 2, centerY: 118 }
const seenKey = (homebaseId: string) => `beside.garden.seen.${homebaseId}`

function readSeen(homebaseId: string): Record<string, string> {
  try {
    return JSON.parse(loadString(seenKey(homebaseId)) ?? "{}")
  } catch {
    return {}
  }
}

type HomeData = { homebase?: ApiHomebase; state: ApiState }

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
  const [fresh, setFresh] = useState<string>()

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(([bases, state]) => {
          if (!active) return
          const homebase = selectHomebase(bases, state.users, route.params?.connectionId)
          setData({ homebase, state })
          if (!homebase) return
          // Celebrate the newest change this device has not shown yet, then remember it.
          const objects = state.gardenObjects ?? []
          const change = unseenChange(objects, homebase.id, readSeen(homebase.id))
          setFresh(change && gardenKey(change.id))
          if (change) setSelectedKey(gardenKey(change.id))
          saveString(
            seenKey(homebase.id),
            JSON.stringify(Object.fromEntries(objects.map((o) => [o.id, seenStamp(o)]))),
          )
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
  const garden = useMemo(
    () => (homebase && data ? gardenItems(data.state.gardenObjects ?? [], homebase.id) : []),
    [data, homebase],
  )
  const items = useMemo(() => [...initialItems, ...garden], [garden])
  const selectedObject = data?.state.gardenObjects?.find((o) => gardenKey(o.id) === selectedKey)
  const selectedItem = selectedObject && catalogue.get(selectedObject.itemId)
  const history = selectedObject && data ? gardenHistory(data.state, selectedObject) : []
  const build = selectedObject && buildPlans.find((p) => p.stages.includes(selectedObject.itemId))
  const objectStory = !selectedObject
    ? ""
    : build
      ? `${build.name} · stage ${build.stages.indexOf(selectedObject.itemId) + 1} of ${build.stages.length}. ${history.map((r) => itemLabel(r.itemId)).join(" → ")}`
      : history.length > 1
        ? `Was ${history
            .slice(0, -1)
            .map((r) => `a ${itemLabel(r.itemId)}`)
            .join(", then ")}. Upgraded together.`
        : "Earned together for your garden."

  function tapWorld(x: number, y: number, scale: number) {
    const avatar = avatarAt(x, y, scale, avatars)
    setSelectedKey(avatar?.key ?? hitTest(garden, x, y, scale)?.key)
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
              items={items}
              sparkleKey={fresh}
              avatars={avatars}
              selectedKey={selectedKey}
              framing={homeFraming}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${members.length} members in the meadow: ${members.map((member) => member.name).join(", ")}. Garden: ${garden.map((g) => itemLabel(g.itemId)).join(", ") || "nothing earned yet"}. Drag to explore. Tap a friend or a garden item.`}
            />
            <View pointerEvents="none" style={styles.worldLabel}>
              <View style={styles.dot} />
              <Text text="The meadow" style={styles.labelText} />
            </View>
            <Pressable
              testID="homebase-recenter"
              accessibilityRole="button"
              accessibilityLabel="Recenter on your friends"
              style={styles.recenter}
              onPress={() => setCameraReset((value) => value + 1)}
            >
              <Text text="Recenter" style={styles.smallText} />
            </Pressable>
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
                    : garden.length
                      ? "Tap a friend or something you earned."
                      : "Tap a friend in the meadow."
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
