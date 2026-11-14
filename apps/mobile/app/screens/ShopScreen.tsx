import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native"
import type { ApiState } from "@beside/api-client"
import { rewardItems } from "@beside/rewards"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AcornAmount, AcornCount } from "@/components/AcornCount"
import { RewardSprite } from "@/components/RewardSprite"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  earnHint,
  entryLabel,
  homebaseAcorns,
  rarityOrder,
  shopCards,
  tierFor,
  type ShopCard,
} from "@/services/api/acorns"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"

const items = new Map(rewardItems.map((item) => [item.id, item]))

export function ShopScreen({ navigation, route }: AppStackScreenProps<"Shop">) {
  const { connectionId } = route.params
  const [state, setState] = useState<ApiState>()
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<string>()

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setError("")
      besideApi
        .state()
        .then((next) => active && setState(next))
        .catch(() => active && setError("We couldn’t open the shop. Please try again."))
      return () => {
        active = false
      }
    }, [attempt]),
  )

  const { balance, history } = useMemo(
    () => (state ? homebaseAcorns(state, connectionId) : { balance: 0, history: [] }),
    [state, connectionId],
  )
  const decorations = useMemo(
    () => state?.decorations.filter((row) => row.homebaseId === connectionId) ?? [],
    [state, connectionId],
  )
  const cards = useMemo(() => shopCards(balance, decorations), [balance, decorations])
  const memberCount =
    state?.memberships.filter((row) => row.connectionId === connectionId).length ?? 1
  const names = useMemo(
    () => new Map(state?.users.map((user) => [user.id, user.name]) ?? []),
    [state],
  )
  const base = state?.connections.find((row) => row.id === connectionId)
  const selected = cards.find((card) => card.itemId === selectedId)
  const selectedItem = selected && items.get(selected.itemId)

  function renderCard(card: ShopCard) {
    const item = items.get(card.itemId)
    if (!item) return null
    const chosen = card.itemId === selectedId
    const progress = Math.min(1, balance / card.price)
    return (
      <Pressable
        key={card.itemId}
        testID={`shop-item-${card.itemId}`}
        accessibilityRole="button"
        accessibilityState={{ selected: chosen, disabled: !card.affordable }}
        accessibilityLabel={`${item.name}, ${tierFor(card.rarity).name}, ${card.price} acorns${
          card.soldOut
            ? ", already in your meadow"
            : card.affordable
              ? ""
              : `, ${card.missing} more needed`
        }`}
        onPress={() => setSelectedId(card.itemId)}
        style={({ pressed }) => [
          styles.card,
          chosen && styles.cardChosen,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.thumb, !card.affordable && styles.locked]}>
          <RewardSprite item={item} scale={2} />
        </View>
        <Text text={item.name} weight="semiBold" style={styles.cardName} numberOfLines={1} />
        <View style={styles.priceRow}>
          <AcornAmount amount={card.price} muted={!card.affordable} />
          {card.soldOut ? (
            <Text text="Owned" style={styles.owned} />
          ) : !card.affordable ? (
            <Text text={`${card.missing} more`} style={styles.short} />
          ) : null}
        </View>
        {!card.affordable && !card.soldOut && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </Pressable>
    )
  }

  return (
    <SafeAreaView
      testID="shop-screen"
      style={styles.screen}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <Pressable
            testID="shop-back"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.back}
          >
            <Text text="‹ Home base" style={styles.smallText} />
          </Pressable>
          <AcornCount amount={balance} size="large" testID="shop-balance" />
        </View>
        <Text text="THE ACORN SHOP" style={worldEyebrow} />
        <Text text="Spend together" weight="semiBold" style={styles.title} />
        <Text
          text={`${base?.name ?? "Your home base"} shares one pool. Anyone can spend it.`}
          style={styles.subtitle}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!state && !error && <ActivityIndicator color={world.forest} />}
        {!!error && (
          <View style={styles.notice}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text text="Try again" style={styles.smallText} />
            </Pressable>
          </View>
        )}
        {state && (
          <>
            <View style={styles.howTo} testID="shop-earning-rules">
              <Text text="HOW ACORNS GROW" style={worldEyebrow} />
              <View style={styles.rule}>
                <AcornAmount amount={2} signed />
                <Text text="each time someone checks in" style={styles.body} />
              </View>
              <View style={styles.rule}>
                <AcornAmount amount={8} signed />
                <Text text="more each, when everyone makes it" style={styles.body} />
              </View>
            </View>
            {rarityOrder.map((rarity) => {
              const tier = tierFor(rarity)
              return (
                <View key={rarity} style={styles.tier}>
                  <View style={styles.tierHeading}>
                    <View style={[styles.badge, { backgroundColor: tier.color }]} />
                    <Text text={tier.name.toUpperCase()} style={[worldEyebrow, styles.tierName]} />
                    {tier.limitPerHomebase === 1 && (
                      <Text text="One per meadow" style={styles.muted} />
                    )}
                  </View>
                  <View style={styles.grid}>
                    {cards.filter((card) => card.rarity === rarity).map(renderCard)}
                  </View>
                </View>
              )
            })}
            <View style={styles.history} testID="shop-history">
              <Text text="ACORN HISTORY" style={worldEyebrow} />
              {!history.length && (
                <Text
                  text="No acorns yet. Check in to a milestone to start the pool."
                  style={styles.muted}
                />
              )}
              {history.slice(0, 12).map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <Text
                    text={entryLabel(entry, names)}
                    style={styles.historyText}
                    numberOfLines={2}
                  />
                  <Text
                    text={entry.amount > 0 ? `+${entry.amount}` : String(entry.amount)}
                    weight="semiBold"
                    style={entry.amount > 0 ? styles.plus : styles.minus}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {selected && selectedItem && (
        <View style={styles.dock} testID="shop-selection">
          <View style={styles.dockRow}>
            <View style={styles.dockThumb}>
              <RewardSprite item={selectedItem} scale={2} />
            </View>
            <View style={styles.dockText}>
              <Text text={selectedItem.name} weight="semiBold" style={styles.dockTitle} />
              <View style={styles.rule}>
                <View style={[styles.badge, { backgroundColor: tierFor(selected.rarity).color }]} />
                <Text text={tierFor(selected.rarity).name} style={styles.muted} />
                <AcornAmount amount={selected.price} />
              </View>
            </View>
          </View>
          {selected.soldOut ? (
            <Text
              text="Already in your meadow. Legendary items are one of a kind."
              style={styles.body}
              testID="shop-sold-out"
            />
          ) : !selected.affordable ? (
            <Text
              testID="shop-cannot-afford"
              accessibilityLiveRegion="polite"
              text={`You need ${selected.missing} more acorns. ${earnHint(selected.missing, memberCount)}`}
              style={styles.body}
            />
          ) : null}
          <View style={styles.actions}>
            <Pressable
              testID="shop-place"
              accessibilityRole="button"
              disabled={!selected.affordable}
              accessibilityState={{ disabled: !selected.affordable }}
              onPress={() =>
                navigation.popTo("HomeBase", { connectionId, placeItemId: selected.itemId })
              }
              style={({ pressed }) => [
                styles.primary,
                !selected.affordable && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                text={
                  selected.soldOut
                    ? "Owned"
                    : selected.affordable
                      ? "Choose a spot"
                      : `Need ${selected.missing} more`
                }
                weight="medium"
                style={styles.primaryText}
              />
            </Pressable>
            {!selected.affordable && !selected.soldOut && (
              <Pressable
                testID="shop-earn"
                accessibilityRole="button"
                onPress={() => navigation.navigate("Activities", { connectionId })}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text text="Earn acorns" weight="medium" style={styles.secondaryText} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 12 },
  back: { justifyContent: "center", minHeight: worldShape.control },
  badge: { borderRadius: 2, height: 8, width: 8 },
  body: { color: world.text, flexShrink: 1, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 6,
    padding: 10,
  },
  cardChosen: { borderColor: world.forest, borderWidth: 2, padding: 9 },
  cardName: { color: world.ink, fontSize: 14, lineHeight: 20 },
  content: { gap: 20, paddingBottom: 24, paddingHorizontal: 20 },
  disabled: { backgroundColor: world.muted, opacity: 0.6 },
  dock: {
    backgroundColor: world.paper,
    borderColor: world.line,
    borderTopWidth: worldShape.border,
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  dockRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  dockText: { flex: 1, gap: 4 },
  dockThumb: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  dockTitle: { color: world.ink, fontSize: 17, lineHeight: 24 },
  error: { color: world.error, fontSize: 13, lineHeight: 20 },
  fill: { backgroundColor: world.leaf, height: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  header: { paddingBottom: 16, paddingHorizontal: 20 },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  history: { gap: 10 },
  historyRow: {
    alignItems: "center",
    borderColor: world.line,
    borderTopWidth: worldShape.border,
    flexDirection: "row",
    gap: 12,
    paddingTop: 10,
  },
  historyText: { color: world.text, flex: 1, fontSize: 13, lineHeight: 19 },
  howTo: {
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    gap: 8,
    padding: 14,
  },
  locked: { opacity: 0.45 },
  minus: { color: world.error, fontSize: 14, lineHeight: 20 },
  muted: { color: world.muted, fontSize: 12, lineHeight: 18 },
  notice: { gap: 8 },
  owned: { color: world.leaf, fontSize: 12, lineHeight: 18 },
  plus: { color: world.forest, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.75 },
  priceRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
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
  rule: { alignItems: "center", flexDirection: "row", gap: 8 },
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
  short: { color: world.muted, fontSize: 12, lineHeight: 18 },
  smallText: { color: world.text, fontSize: 14, lineHeight: 22 },
  subtitle: { color: world.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  thumb: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.smallRadius,
    borderWidth: worldShape.border,
    height: 76,
    justifyContent: "center",
  },
  tier: { gap: 10 },
  tierHeading: { alignItems: "center", flexDirection: "row", gap: 8 },
  tierName: { color: world.ink, flex: 1 },
  title: { color: world.ink, fontSize: 27, lineHeight: 34, marginTop: 6 },
  track: { backgroundColor: world.line, height: 4, overflow: "hidden" },
})
