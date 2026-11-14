import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, View } from "react-native"
import type { ApiHomebase, ApiState } from "@beside/api-client"
import { shopListing } from "@beside/api-client/acorns"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AcornAmount, AcornCount } from "@/components/AcornCount"
import { avatarsForMembers, firstNamesLabel } from "@/components/pixel-world/avatars"
import {
  avatarAt,
  catalogue,
  hitTest,
  homePlacementAt,
  initialItems,
  type WorldItem,
} from "@/components/pixel-world/scene"
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
  const [preview, setPreview] = useState<WorldItem>()
  const [placingHint, setPlacingHint] = useState("")
  const [busyAction, setBusyAction] = useState(false)
  const [notice, setNotice] = useState("")
  const placeItemId = route.params?.placeItemId
  const placingItem = placeItemId ? catalogue.get(placeItemId) : undefined
  const placingListing = placeItemId ? shopListing(placeItemId) : null

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setBusy(true)
      setError("")
      Promise.all([besideApi.homebases(), besideApi.state()])
        .then(([bases, state]) => {
          if (active)
            setData({
              homebase: selectHomebase(bases, state.users, route.params?.connectionId),
              state,
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
  const worldItems = useMemo(() => [...initialItems, ...decorationItems], [decorationItems])
  const selectedDecoration = decorations.find((row) => row.id === selectedKey)
  const selectedDecorationItem = selectedDecoration && catalogue.get(selectedDecoration.itemId)
  const buyerName = selectedDecoration
    ? (data?.state.users.find((user) => user.id === selectedDecoration.purchasedByUserId)?.name ??
      "Someone")
    : ""

  function tapWorld(x: number, y: number, scale: number) {
    if (placingItem) {
      const spot = homePlacementAt(x, y, worldItems, avatars)
      setPreview(spot ? { ...spot, key: "preview", itemId: placingItem.id } : undefined)
      setPlacingHint(
        spot
          ? "A good spot? Buy it here, or tap another patch."
          : "Try an open patch of lawn, away from the pond, path and picnic.",
      )
      return
    }
    const decoration = hitTest(decorationItems, x, y, scale)
    setSelectedKey(decoration?.key ?? avatarAt(x, y, scale, avatars)?.key)
    setNotice("")
  }

  function stopPlacing() {
    setPreview(undefined)
    setPlacingHint("")
    navigation.setParams({ placeItemId: undefined })
  }

  async function buy() {
    if (!homebase || !placingItem || !preview || busyAction) return
    setBusyAction(true)
    setNotice("")
    try {
      const result = await besideApi.buyDecoration({
        homebaseId: homebase.id,
        itemId: placingItem.id,
        x: preview.x,
        y: preview.y,
        externalKey: `buy:${placingItem.id}:${preview.x}:${preview.y}:${Date.now()}`,
      })
      const left = acorns - (placingListing?.price ?? 0)
      setSelectedKey(result.entityId)
      setNotice(`${placingItem.name} is in the meadow. ${acornLabel(left)} left.`)
      stopPlacing()
      setAttempt((value) => value + 1)
    } catch (e) {
      setPlacingHint(e instanceof Error ? e.message : "We couldn’t buy that. Please try again.")
    } finally {
      setBusyAction(false)
    }
  }

  async function giveBack() {
    if (!selectedDecoration || busyAction) return
    setBusyAction(true)
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
      setBusyAction(false)
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
              items={worldItems}
              avatars={avatars}
              selectedKey={placingItem ? undefined : selectedKey}
              preview={preview}
              framing={homeFraming}
              picnic="group"
              resetCamera={cameraReset}
              onTap={tapWorld}
              accessibilityLabel={`${homebase.name}. ${members.length} members in the meadow: ${members.map((member) => member.name).join(", ")}. Drag to explore. Tap a friend to see their name.`}
            />
            <View pointerEvents="none" style={styles.worldLabel}>
              <View style={styles.dot} />
              <Text text={placingItem ? "Finding a spot" : "The meadow"} style={styles.labelText} />
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
        {!!notice && (
          <Text
            testID="homebase-notice"
            text={notice}
            accessibilityLiveRegion="polite"
            style={styles.success}
          />
        )}
        {placingItem ? (
          <>
            <View style={styles.detail} testID="homebase-placing">
              <View style={styles.thumbnail}>
                <RewardSprite item={placingItem} scale={2} />
              </View>
              <View style={styles.detailText}>
                <Text
                  text={`Where should the ${placingItem.name.toLowerCase()} go?`}
                  weight="semiBold"
                  style={styles.sectionTitle}
                />
                <Text
                  testID="homebase-placing-hint"
                  accessibilityLiveRegion="polite"
                  text={placingHint || "Tap an open patch of lawn in the meadow."}
                  style={styles.description}
                />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                testID="homebase-buy"
                accessibilityRole="button"
                disabled={!preview || busyAction}
                accessibilityState={{ disabled: !preview || busyAction }}
                style={({ pressed }) => [
                  styles.primary,
                  styles.buy,
                  (!preview || busyAction) && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => void buy()}
              >
                <Text
                  text={busyAction ? "Buying…" : "Buy for"}
                  weight="medium"
                  style={styles.primaryText}
                />
                {!busyAction && placingListing && (
                  <Text
                    text={`${placingListing.price} acorns`}
                    weight="medium"
                    style={styles.primaryText}
                  />
                )}
              </Pressable>
              <Pressable
                testID="homebase-cancel-placing"
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                onPress={stopPlacing}
              >
                <Text text="Cancel" weight="medium" style={styles.secondaryText} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.detail}>
              {selectedDecoration && selectedDecorationItem ? (
                <>
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
                        text={`${shopListing(selectedDecoration.itemId) ? tierFor(shopListing(selectedDecoration.itemId)!.rarity).name : "Bought"} · ${buyerName.split(/\s+/)[0]} bought it for`}
                        style={styles.description}
                      />
                      <AcornAmount amount={selectedDecoration.price} muted />
                    </View>
                  </View>
                  <Pressable
                    testID="homebase-return-decoration"
                    accessibilityRole="button"
                    accessibilityLabel={`Return ${selectedDecorationItem.name} for ${acornLabel(selectedDecoration.price)}`}
                    disabled={busyAction}
                    style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
                    onPress={() => void giveBack()}
                  >
                    <Text text="Return" style={styles.smallText} />
                  </Pressable>
                </>
              ) : (
                <>
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
                          : "Tap a friend or something you bought."
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
                </>
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
                testID="homebase-shop"
                accessibilityRole="button"
                disabled={!homebase}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                onPress={() =>
                  homebase && navigation.navigate("Shop", { connectionId: homebase.id })
                }
              >
                <Text text="Shop" weight="medium" style={styles.secondaryText} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  body: { color: world.text, fontSize: 14, lineHeight: 22 },
  boughtRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  buy: { flexDirection: "row", gap: 6 },
  count: { color: world.muted, fontSize: 11, lineHeight: 16 },
  description: { color: world.muted, fontSize: 12, lineHeight: 18 },
  detail: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64 },
  detailText: { flex: 1, gap: 3 },
  disabled: { opacity: 0.5 },
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
  returnButton: {
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
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
