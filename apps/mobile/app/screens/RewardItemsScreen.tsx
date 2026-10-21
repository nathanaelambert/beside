import { useRef, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { rewardItems } from "@beside/rewards"

import { Button } from "@/components/Button"
import { RewardSprite } from "@/components/RewardSprite"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useHeader } from "@/utils/useHeader"

const categories = ["All", ...new Set(rewardItems.map((item) => item.category))]

export function RewardItemsScreen({ navigation }: AppStackScreenProps<"RewardItems">) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { isAuthenticated } = useAuth()
  const [category, setCategory] = useState("All")
  const [mode, setMode] = useState<"collection" | "preview">("collection")
  const [selectedId, setSelectedId] = useState<string>()
  const [placements, setPlacements] = useState<Record<number, string>>({})
  const [erasing, setErasing] = useState(false)
  const [status, setStatus] = useState("")
  const scrollRef = useRef<ScrollView>(null)
  const selected = rewardItems.find((item) => item.id === selectedId)
  const filtered = rewardItems.filter((item) => category === "All" || item.category === category)
  const filled = Object.keys(placements).length
  function showMode(value: "collection" | "preview") {
    setMode(value)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  useHeader(
    {
      title: "Reward items",
      leftTx: "common:back",
      onLeftPress: () =>
        navigation.canGoBack()
          ? navigation.goBack()
          : navigation.navigate(isAuthenticated ? "Welcome" : "Login"),
    },
    [navigation, isAuthenticated],
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["bottom"]} contentContainerStyle={$screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={themed($content)}
        showsVerticalScrollIndicator={false}
        testID="reward-items-scroll"
      >
        <View style={$intro}>
          <Text
            text="A little something for your world."
            preset="heading"
            style={$heading}
            accessibilityRole="header"
          />
          <Text
            text="Eight little artifacts. Pick a favorite and try it in a patch of your own."
            size="sm"
            style={themed($muted)}
          />
        </View>

        <View style={themed($modeSwitch)}>
          {(
            [
              ["collection", "Collection"],
              ["preview", "World preview"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
              onPress={() => showMode(value)}
              style={({ pressed }) => [
                themed($modeButton),
                mode === value && themed($activeMode),
                pressed && $pressed,
              ]}
            >
              <Text text={label} size="sm" weight="medium" />
            </Pressable>
          ))}
        </View>

        {mode === "collection" ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={$categories}
            >
              {categories.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`${value}, ${rewardItems.filter((item) => value === "All" || item.category === value).length} items`}
                  accessibilityState={{ selected: category === value }}
                  style={({ pressed }) => [
                    themed($category),
                    category === value && themed($selectedBorder),
                    pressed && $pressed,
                  ]}
                  onPress={() => setCategory(value)}
                >
                  <Text
                    text={value}
                    size="sm"
                    weight={category === value ? "semiBold" : "normal"}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <Text
              text={`${filtered.length} items · 32 × 32 pixel art`}
              size="xs"
              style={themed($muted)}
            />
            <View style={$grid}>
              {filtered.map((item) => (
                <Pressable
                  key={item.id}
                  testID={`reward-item-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.category}`}
                  accessibilityHint="Select this item to try placing it in the world preview."
                  accessibilityState={{ selected: selectedId === item.id }}
                  onPress={() => {
                    setSelectedId(item.id)
                    setErasing(false)
                    setStatus("")
                  }}
                  style={({ pressed }) => [
                    themed($item),
                    selectedId === item.id && themed($selectedBorder),
                    pressed && $pressed,
                  ]}
                >
                  <View style={$art}>
                    <RewardSprite item={item} />
                  </View>
                  <Text text={item.name} weight="semiBold" size="sm" />
                  <Text text={item.category} size="xs" style={themed($muted)} />
                </Pressable>
              ))}
            </View>
            <Text
              text="A collection for future milestone and activity rewards. Earning items is still to come."
              size="xs"
              style={themed($muted)}
            />
          </>
        ) : (
          <>
            <View style={$previewHeading}>
              <Text text="A patch of possibility" preset="subheading" accessibilityRole="header" />
              <Text text={`${filled} of 9 plots filled`} size="xs" style={themed($muted)} />
            </View>
            <Text
              text={
                erasing
                  ? "Tap a filled plot to remove its item."
                  : selected
                    ? `Tap a plot to place ${selected.name}. You can use it more than once.`
                    : "Choose an item from the collection, then tap a plot to place it here."
              }
              size="sm"
              style={themed($muted)}
            />
            <View style={themed($world)}>
              {Array.from({ length: 9 }, (_, index) => {
                const item = rewardItems.find((item) => item.id === placements[index])
                const position = `row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}`
                const disabled = erasing ? !item : !selected
                return (
                  <Pressable
                    key={index}
                    testID={`reward-plot-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      erasing
                        ? `Remove ${item?.name ?? "item"} at ${position}`
                        : `Place ${selected?.name ?? "item"} at ${position}${item ? `, currently ${item.name}` : ", empty"}`
                    }
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    style={({ pressed }) => [
                      themed($plot),
                      {
                        backgroundColor:
                          index % 2 ? colors.rewards.groundAlt : colors.rewards.ground,
                      },
                      pressed && $pressed,
                    ]}
                    onPress={() => {
                      const next = { ...placements }
                      if (erasing) delete next[index]
                      else if (selected) next[index] = selected.id
                      setPlacements(next)
                      if (!Object.keys(next).length) setErasing(false)
                      setStatus(
                        erasing
                          ? `Removed ${item?.name} from ${position}.`
                          : `Placed ${selected?.name} at ${position}.`,
                      )
                    }}
                  >
                    {item ? (
                      <RewardSprite item={item} scale={2} />
                    ) : (
                      <Text text="+" size="lg" style={themed($plotPlus)} />
                    )}
                  </Pressable>
                )
              })}
            </View>
            <View style={$tools}>
              <Button
                text={erasing ? "Done removing" : "Remove items"}
                disabled={!filled}
                disabledStyle={$disabled}
                accessibilityState={{ selected: erasing, disabled: !filled }}
                onPress={() => setErasing(!erasing)}
                style={$tool}
              />
              <Button
                text="Clear patch"
                disabled={!filled}
                disabledStyle={$disabled}
                onPress={() => {
                  setPlacements({})
                  setErasing(false)
                  setStatus("Patch cleared.")
                }}
                style={$tool}
              />
            </View>
            <Text
              text={status}
              size="xs"
              style={themed($accent)}
              accessibilityLiveRegion="polite"
            />
            <Text
              text="Just a preview. Your patch resets when you leave this screen and is not a saved world."
              size="xs"
              style={themed($muted)}
            />
          </>
        )}
      </ScrollView>
      <View style={themed($selectionDock)}>
        <View style={$selectionInfo}>
          {selected && <RewardSprite item={selected} scale={1} />}
          <View style={$selectionText}>
            <Text
              text={selected?.name ?? "Choose a little something"}
              size="sm"
              weight="semiBold"
            />
            <Text
              text={selected ? `${selected.category} · Pixel art` : "Tap an item to select it"}
              size="xs"
              style={themed($muted)}
            />
          </View>
        </View>
        <Button
          text={mode === "collection" ? "Try placing" : "Change item"}
          disabled={mode === "collection" && !selected}
          disabledStyle={$disabled}
          onPress={() => {
            showMode(mode === "collection" ? "preview" : "collection")
            setErasing(false)
          }}
          style={$dockButton}
          textStyle={$dockButtonText}
        />
      </View>
    </Screen>
  )
}

const $screen: ViewStyle = { flex: 1 }
const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.md,
  maxWidth: 600,
  width: "100%",
  alignSelf: "center",
})
const $intro: ViewStyle = { gap: 12, marginBottom: 4 }
const $heading: TextStyle = { fontSize: 28, lineHeight: 34 }
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
const $accent: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.rewards.accent })
const $modeSwitch: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  backgroundColor: colors.separator,
  padding: 4,
  borderRadius: 12,
})
const $modeButton: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minHeight: 44,
  paddingVertical: 10,
  paddingHorizontal: 4,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
})
const $activeMode: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral100,
})
const $categories: ViewStyle = { gap: 8 }
const $category: ThemedStyle<ViewStyle> = ({ colors }) => ({
  minHeight: 44,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.separator,
  justifyContent: "center",
})
const $selectedBorder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.rewards.accent,
  backgroundColor: colors.rewards.selected,
})
const $grid: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "flex-start",
}
const $item: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexBasis: "46%",
  flexGrow: 1,
  borderWidth: 1,
  borderColor: colors.separator,
  borderRadius: 16,
  backgroundColor: colors.palette.neutral100,
  padding: 12,
  gap: 3,
  minHeight: 186,
})
const $art: ViewStyle = {
  alignItems: "center",
  justifyContent: "center",
  height: 112,
  marginBottom: 8,
}
const $pressed: ViewStyle = { opacity: 0.7 }
const $disabled: ViewStyle = { opacity: 0.45 }
const $previewHeading: ViewStyle = { gap: 4, marginTop: 8 }
const $world: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 4,
  padding: 8,
  borderRadius: 12,
  backgroundColor: colors.rewards.groundBorder,
})
const $plot: ThemedStyle<ViewStyle> = () => ({
  flexBasis: "30%",
  flexGrow: 1,
  aspectRatio: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
})
const $plotPlus: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.rewards.accent })
const $tools: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 8 }
const $tool: ViewStyle = { flexGrow: 1, minWidth: 120 }
const $selectionDock: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopWidth: 1,
  borderTopColor: colors.separator,
  backgroundColor: colors.palette.neutral100,
  padding: spacing.md,
  gap: 12,
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
})
const $selectionInfo: ViewStyle = {
  flexDirection: "row",
  gap: 8,
  alignItems: "center",
  flexGrow: 1,
  flexBasis: 160,
}
const $selectionText: ViewStyle = { flex: 1 }
const $dockButton: ViewStyle = { paddingHorizontal: 12, minHeight: 44 }
const $dockButtonText: TextStyle = { fontSize: 14 }
