/* eslint-disable react-native/no-color-literals -- Deliberately local palette for this visual spike. */
import { useState } from "react"
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native"
import { rewardItems } from "@beside/rewards"
import { SafeAreaView } from "react-native-safe-area-context"

import {
  catalogue,
  hitTest,
  initialItems,
  placementAt,
  type WorldItem,
} from "@/components/pixel-world/scene"
import { WorldCanvas } from "@/components/pixel-world/WorldCanvas"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

const memories: Record<string, string> = {
  "oak-tree": "A little shade for the things you do together.",
  "pine-tree": "Your growing corner of the woods.",
  "sunflower": "A small reminder of brighter days.",
  "pink-tulip": "Something lovely, just because.",
  "owl-statue": "Nathaniel left this here after your first shared book.",
  "star-statue": "A keepsake from a month of showing up together.",
  "rose-pennant": "A little celebration for your shared space.",
  "blue-banner": "Planted here to mark a new beginning.",
}

export function PixelWorldScreen({ navigation }: AppStackScreenProps<"PixelWorld">) {
  const [items, setItems] = useState(initialItems)
  const [selectedKey, setSelectedKey] = useState<string | undefined>("owl")
  const [decorating, setDecorating] = useState(false)
  const [chosenId, setChosenId] = useState("oak-tree")
  const [preview, setPreview] = useState<WorldItem>()
  const [photo, setPhoto] = useState(false)
  const [cameraReset, setCameraReset] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [status, setStatus] = useState("Drag to explore. Tap a little something.")
  const selected = items.find((item) => item.key === selectedKey)
  const selectedItem = selected && catalogue.get(selected.itemId)
  const chosen = catalogue.get(chosenId)!

  function tapWorld(x: number, y: number, scale: number) {
    if (decorating) {
      const position = placementAt(x, y, items)
      setPreview(position ? { ...position, key: "preview", itemId: chosenId } : undefined)
      setStatus(
        position
          ? "A good spot? Place it here, or tap another patch."
          : "Try an open patch of lawn, away from the pond.",
      )
    } else {
      const hit = hitTest(items, x, y, scale)
      setSelectedKey(hit?.key)
      setStatus(
        hit ? `You found ${catalogue.get(hit.itemId)!.name}.` : "A little room to grow, together.",
      )
    }
  }

  function stopDecorating() {
    setDecorating(false)
    setPreview(undefined)
    setStatus("Drag to explore. Tap a little something.")
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      {!photo && (
        <View style={styles.header}>
          <View style={styles.headingRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to app"
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate("RewardItems")
              }
              style={styles.back}
            >
              <Text text="‹" style={styles.backText} />
            </Pressable>
            <View style={styles.heading}>
              <Text text="YOUR SHARED SPACE" style={styles.eyebrow} />
              <Text text="A little beside" weight="semiBold" style={styles.title} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide controls for a screenshot"
              onPress={() => setPhoto(true)}
              style={styles.smallButton}
            >
              <Text text="Photo" style={styles.smallText} />
            </Pressable>
          </View>
          <Text text="You & Nathaniel  ·  A quiet afternoon" style={styles.subtitle} />
        </View>
      )}

      <View
        style={styles.world}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
        testID="pixel-world"
      >
        {size.width > 0 && size.height > 0 && (
          <WorldCanvas
            {...size}
            items={items}
            selectedKey={decorating ? undefined : selectedKey}
            preview={preview}
            resetCamera={cameraReset}
            onTap={tapWorld}
          />
        )}
        <View pointerEvents="none" style={styles.worldLabel}>
          <View style={styles.dot} />
          <Text text={decorating ? "Finding a home" : "The meadow"} style={styles.labelText} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? "Show controls" : "Recenter world"}
          onPress={() => (photo ? setPhoto(false) : setCameraReset((value) => value + 1))}
          style={styles.recenter}
        >
          <Text text={photo ? "Show controls" : "Recenter"} style={styles.smallText} />
        </Pressable>
      </View>

      {!photo && (
        <ScrollView style={styles.dock} contentContainerStyle={styles.dockContent} bounces={false}>
          <View style={styles.dockHeading}>
            <Text
              text={
                decorating ? "Make yourself at home" : (selectedItem?.name ?? "Room for your story")
              }
              weight="semiBold"
              style={styles.sectionTitle}
            />
            <Text text="LOCAL MOCK" style={styles.mock} />
          </View>
          <Text
            text={
              decorating
                ? "Choose a decoration, then tap an open spot."
                : selectedItem
                  ? memories[selectedItem.id]
                  : "Trees, keepsakes, and a place to return to."
            }
            style={styles.description}
          />

          {decorating && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tray}
              accessibilityLabel="Decoration catalogue"
            >
              {rewardItems.map((item) => (
                <Pressable
                  key={item.id}
                  testID={`choose-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.name}`}
                  accessibilityState={{ selected: chosenId === item.id }}
                  onPress={() => {
                    setChosenId(item.id)
                    setPreview((current) => (current ? { ...current, itemId: item.id } : undefined))
                  }}
                  style={[styles.trayItem, chosenId === item.id && styles.chosenItem]}
                >
                  <RewardSprite item={item} scale={2} />
                  <Text text={item.name} style={styles.itemName} numberOfLines={2} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text text={status} accessibilityLiveRegion="polite" style={styles.status} />
          <View style={styles.actions}>
            {decorating ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={stopDecorating}
                  style={styles.secondary}
                >
                  <Text text="Cancel" style={styles.smallText} />
                </Pressable>
                <Pressable
                  testID="confirm-placement"
                  accessibilityRole="button"
                  accessibilityLabel={`Place ${chosen.name}`}
                  accessibilityState={{ disabled: !preview || items.length >= 40 }}
                  disabled={!preview || items.length >= 40}
                  style={[styles.primary, (!preview || items.length >= 40) && styles.disabled]}
                  onPress={() => {
                    if (!preview) return
                    const placed = { ...preview, key: `placed-${Date.now()}` }
                    setItems((current) => [...current, placed])
                    setSelectedKey(placed.key)
                    setPreview(undefined)
                    setDecorating(false)
                    setStatus(`${chosen.name} feels right at home.`)
                  }}
                >
                  <Text
                    text={items.length >= 40 ? "Meadow is full" : "Place here"}
                    weight="semiBold"
                    style={styles.primaryText}
                  />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setItems(initialItems)
                    setSelectedKey("owl")
                    setCameraReset((value) => value + 1)
                    setStatus("Back to a fresh afternoon.")
                  }}
                  style={styles.secondary}
                >
                  <Text text="Reset scene" style={styles.smallText} />
                </Pressable>
                <Pressable
                  testID="decorate-world"
                  accessibilityRole="button"
                  onPress={() => {
                    setDecorating(true)
                    setStatus("Tap the lawn to preview your decoration.")
                  }}
                  style={styles.primary}
                >
                  <Text text="+  Decorate" weight="semiBold" style={styles.primaryText} />
                </Pressable>
              </>
            )}
          </View>
          <Text
            text="A playful prototype. Changes stay only for this session."
            style={styles.footnote}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 2 },
  back: { justifyContent: "center", minHeight: 44, minWidth: 36 },
  backText: { color: "#344b3d", fontSize: 36, lineHeight: 40 },
  chosenItem: { backgroundColor: "#e5eacb", borderColor: "#6e8659" },
  description: { color: "#717762", fontSize: 13, lineHeight: 20 },
  disabled: { opacity: 0.4 },
  dock: { flexGrow: 0, maxHeight: "48%" },
  dockContent: { gap: 10, padding: 20, paddingBottom: 12 },
  dockHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  dot: { backgroundColor: "#6b8658", height: 5, width: 5 },
  eyebrow: { color: "#6f775f", fontSize: 10, letterSpacing: 1.7, lineHeight: 16 },
  footnote: { color: "#7b806e", fontSize: 10, lineHeight: 16, textAlign: "center" },
  header: { paddingBottom: 20, paddingHorizontal: 20, paddingTop: 12 },
  heading: { flex: 1 },
  headingRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  itemName: { color: "#435a46", fontSize: 10, lineHeight: 13, minHeight: 26, textAlign: "center" },
  labelText: { color: "#526647", fontSize: 11, lineHeight: 16 },
  mock: { color: "#737b64", fontSize: 9, letterSpacing: 1, lineHeight: 14 },
  primary: {
    alignItems: "center",
    backgroundColor: "#405d46",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryText: { color: "#f6f1df", fontSize: 14, lineHeight: 22 },
  recenter: {
    backgroundColor: "#f3f0d8",
    borderRadius: 5,
    bottom: 16,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    position: "absolute",
    right: 20,
  },
  screen: { backgroundColor: "#f7f3e8", flex: 1 },
  secondary: { justifyContent: "center", minHeight: 48, paddingHorizontal: 12 },
  sectionTitle: { color: "#344b3d", flex: 1, fontSize: 18, lineHeight: 24 },
  smallButton: {
    borderColor: "#d8dccb",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  smallText: { color: "#435a46", fontSize: 13, lineHeight: 20 },
  status: { color: "#4e674c", fontSize: 12, lineHeight: 18 },
  subtitle: { color: "#747a68", fontSize: 12, lineHeight: 18, marginLeft: 48, marginTop: 10 },
  title: { color: "#344b3d", fontSize: 27, lineHeight: 34 },
  tray: { gap: 8, paddingVertical: 4 },
  trayItem: {
    alignItems: "center",
    borderColor: "#dedfce",
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
    width: 94,
  },
  world: { backgroundColor: "#92af70", flex: 1, minHeight: 200, overflow: "hidden" },
  worldLabel: {
    alignItems: "center",
    backgroundColor: "#f3f0d8",
    borderRadius: 5,
    flexDirection: "row",
    gap: 7,
    left: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: "absolute",
    top: 16,
  },
})
