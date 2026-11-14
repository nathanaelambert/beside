import { Fragment, useCallback, useState } from "react"
import { ActivityIndicator, RefreshControl, TextStyle, View, ViewStyle } from "react-native"
import type { HomebaseRewards } from "@beside/api-client"
import { useFocusEffect } from "@react-navigation/native"

import {
  ActivityWorldHeader,
  activityWorldStyles,
  WorldButton as Button,
} from "@/components/ActivityWorld"
import { PixelArtSprite } from "@/components/BesideMark"
import { aItem, itemLabel, statusLine } from "@/components/pixel-world/garden"
import { catalogue } from "@/components/pixel-world/scene"
import { padlock, RewardTile } from "@/components/RewardTile"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"

type StageState = "built" | "next" | "locked"

function Stage({ itemId, state, label }: { itemId: string; state: StageState; label: string }) {
  const item = catalogue.get(itemId)
  return (
    <View style={$stage} accessible accessibilityLabel={`${itemLabel(itemId)}: ${label}`}>
      <View style={[$stageArt, state === "built" && $built, state === "next" && $next]}>
        {item && (
          <PixelArtSprite
            art={item.artifact}
            scale={1.5}
            style={state === "locked" ? $dim : undefined}
          />
        )}
        {state === "locked" && <PixelArtSprite art={padlock} scale={1.5} style={$lock} />}
      </View>
      <Text text={label} style={[$stageLabel, state === "built" && { color: world.forest }]} />
    </View>
  )
}

export function GardenRewardsScreen({ navigation, route }: AppStackScreenProps<"GardenRewards">) {
  const { connectionId } = route.params
  const [data, setData] = useState<HomebaseRewards>()
  const [baseName, setBaseName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)

  useFocusEffect(
    useCallback(() => {
      void refresh
      let active = true
      setLoading(true)
      setError("")
      Promise.all([besideApi.homebaseRewards(connectionId), besideApi.homebases()])
        .then(([rewards, bases]) => {
          if (!active) return
          setData(rewards)
          setBaseName(bases.find((b) => b.id === connectionId)?.name ?? "")
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : "Could not load rewards.")
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => {
        active = false
      }
    }, [connectionId, refresh]),
  )

  const entry = (itemId: string) => data?.items.find((i) => i.itemId === itemId)
  const buildStages = new Set(data?.builds.flatMap((b) => b.stages))
  const upgrades =
    data?.items.filter((i) => i.status.kind !== "place" && !buildStages.has(i.itemId)) ?? []

  return (
    <View style={activityWorldStyles.root}>
      <ActivityWorldHeader onPress={() => navigation.goBack()} />
      <Screen
        preset="scroll"
        safeAreaEdges={["bottom"]}
        backgroundColor={world.paper}
        contentContainerStyle={activityWorldStyles.content}
        ScrollViewProps={{
          refreshControl: (
            <RefreshControl
              tintColor={world.forest}
              colors={[world.forest]}
              refreshing={loading && !!data}
              onRefresh={() => setRefresh((v) => v + 1)}
            />
          ),
        }}
      >
        <Text
          text={`${baseName || "Home base"} · GARDEN REWARDS`.toUpperCase()}
          style={worldEyebrow}
        />
        <Text text="What you can earn" weight="semiBold" style={activityWorldStyles.title} />
        <Text
          text="Some rewards build on something already in your garden. Earn the first piece together and the next one unlocks. Choose a reward when you plan a milestone."
          style={activityWorldStyles.body}
        />
        {loading && !data && (
          <ActivityIndicator color={world.forest} accessibilityLabel="Loading rewards" />
        )}
        {!!error && (
          <>
            <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
            <Button text="Try again" onPress={() => setRefresh((v) => v + 1)} />
          </>
        )}
        {data?.builds.map((build) => {
          const next = build.stages[build.reached]
          const nextEntry = next ? entry(next) : undefined
          return (
            <View key={build.id} style={$panel} testID={`build-${build.id}`}>
              <View style={$panelHeading}>
                <Text text="BUILD IN STAGES" style={worldEyebrow} />
                <Text
                  text={`${build.reached} of ${build.stages.length} built`}
                  testID={`build-${build.id}-progress`}
                  style={activityWorldStyles.muted}
                />
              </View>
              <Text text={build.name} weight="semiBold" style={activityWorldStyles.sectionTitle} />
              <View style={$track}>
                {build.stages.map((stage, index) => (
                  <Fragment key={stage}>
                    {index > 0 && <Text text="›" style={$arrow} />}
                    <Stage
                      itemId={stage}
                      state={
                        index < build.reached
                          ? "built"
                          : entry(stage)?.status.kind === "locked"
                            ? "locked"
                            : "next"
                      }
                      label={
                        index < build.reached
                          ? "✓ Built"
                          : entry(stage)?.planned
                            ? "Planned"
                            : entry(stage)?.status.kind === "locked"
                              ? "Locked"
                              : "Next"
                      }
                    />
                  </Fragment>
                ))}
              </View>
              <Text
                text={
                  !next
                    ? `Your ${itemLabel(build.stages.at(-1)!)} is finished.`
                    : nextEntry?.planned
                      ? `${itemLabel(next)} is planned. It goes up when everyone completes its milestone.`
                      : nextEntry && nextEntry.status.kind !== "locked"
                        ? `Next up: ${itemLabel(next)}. ${statusLine(nextEntry.status).text}.`
                        : `Plan ${aItem(build.stages[0])} to start building.`
                }
                style={activityWorldStyles.body}
              />
            </View>
          )
        })}
        {upgrades.map((upgrade) => (
          <View key={upgrade.itemId} style={$panel} testID={`upgrade-${upgrade.itemId}`}>
            <Text text="UPGRADE IN PLACE" style={worldEyebrow} />
            <View style={$track}>
              <Stage
                itemId={
                  upgrade.status.kind === "place" ? upgrade.itemId : upgrade.status.precursorId
                }
                state="built"
                label="Needs this"
              />
              <Text text="›" style={$arrow} />
              <Stage
                itemId={upgrade.itemId}
                state={
                  upgrade.inGarden ? "built" : upgrade.status.kind === "locked" ? "locked" : "next"
                }
                label={upgrade.inGarden ? "✓ In garden" : upgrade.planned ? "Planned" : "Becomes"}
              />
            </View>
            <Text text={statusLine(upgrade.status).text} style={activityWorldStyles.body} />
          </View>
        ))}
        {data && (
          <View style={$list}>
            <Text text="ALL REWARDS" style={worldEyebrow} />
            {data.items.map((item) => (
              <RewardTile key={item.itemId} entry={item} testID={`reward-status-${item.itemId}`} />
            ))}
          </View>
        )}
      </Screen>
    </View>
  )
}

const $panel: ViewStyle = {
  backgroundColor: world.meadow,
  borderColor: world.meadowBorder,
  borderWidth: worldShape.border,
  borderRadius: worldShape.radius,
  padding: 16,
  gap: 10,
}
const $panelHeading: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
}
const $track: ViewStyle = { flexDirection: "row", alignItems: "flex-start", gap: 4 }
const $arrow: TextStyle = { color: world.muted, fontSize: 18, lineHeight: 56 }
const $stage: ViewStyle = { alignItems: "center", gap: 4, flexShrink: 1 }
const $stageArt: ViewStyle = {
  width: 56,
  height: 56,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: world.paper,
  borderColor: world.line,
  borderWidth: worldShape.border,
  borderRadius: worldShape.smallRadius,
}
const $built: ViewStyle = {
  borderColor: world.forest,
  borderWidth: 2,
  backgroundColor: world.panel,
}
const $next: ViewStyle = { borderColor: world.leaf, borderStyle: "dashed", borderWidth: 2 }
const $dim: ViewStyle = { opacity: 0.3 }
const $lock: ViewStyle = { position: "absolute", right: 3, bottom: 3 }
const $stageLabel: TextStyle = { color: world.muted, fontSize: 11, lineHeight: 15 }
const $list: ViewStyle = { gap: 10 }
