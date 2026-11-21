import { useMemo, useState } from "react"
import { PixelRatio, StyleSheet, View } from "react-native"
import type { CottageSpriteLevel } from "@beside/api-client"

import { ActivityWorldHeader, activityWorldStyles, WorldButton } from "@/components/ActivityWorld"
import { BayGardenControls } from "@/components/iso-world/BayGardenControls"
import {
  addBayCell,
  bayCandidates,
  bayCellAt,
  bayCellKey,
  bayFocus,
  bayGardenItems,
  bayStyles,
  bayTerrain,
  buildBayScene,
  maxBayAdditions,
  readBayAdditions,
  type BayStyle,
  type BayView,
} from "@/components/iso-world/bayWorkshop"
import { IsoWorldCanvas } from "@/components/iso-world/IsoWorldCanvas"
import { worldArtAssets } from "@/components/iso-world/worldArtAssets"
import type { TreeArtStage } from "@/components/iso-world/worldDetailArt"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { load, saveString } from "@/utils/storage"

const stages = ["Foundation", "Frame", "Roof & entry", "Finished"] as const
const growthStages = ["Starter cottage", "Reading wing", "Loft"] as const
const growthChoices = [1, 2, 3] as const
const styles = Object.keys(bayStyles) as BayStyle[]
const choices = [0, 1, 2, 3] as const
const views = { bay: "Bay", garden: "Garden", harbor: "Harbor" } as const
const viewChoices = Object.keys(views) as BayView[]

export function BayWorkshopScreen({ route, navigation }: AppStackScreenProps<"BayWorkshop">) {
  const storageKey = `bay-workshop-v1:${route.params.connectionId}`
  const [additions, setAdditions] = useState(() => readBayAdditions(load<unknown>(storageKey)))
  const [style, setStyle] = useState<BayStyle>("terracotta")
  const [stage, setStage] = useState<CottageSpriteLevel>(3)
  const [detailed, setDetailed] = useState(true)
  const [view, setView] = useState<BayView>("bay")
  const [sampleIndex, setSampleIndex] = useState(0)
  const [treeStage, setTreeStage] = useState<TreeArtStage>("mature")
  const [selection, setSelection] = useState(0)
  const [editing, setEditing] = useState(false)
  const [width, setWidth] = useState(0)
  const [notice, setNotice] = useState("")
  const candidates = useMemo(() => bayCandidates(additions), [additions])
  const preview = editing && view === "bay" ? candidates[selection] : undefined
  const sample = bayGardenItems[sampleIndex]!
  const selectedStage = detailed && stage === 0 ? 1 : stage
  const map = useMemo(
    () => bayTerrain(preview ? [...additions, preview] : additions, style, detailed),
    [additions, preview, style, detailed],
  )
  const islands = useMemo(
    () => [
      buildBayScene(map, style, stage, {
        assets: worldArtAssets,
        view,
        sampleId: sample.id,
        treeStage,
      }),
    ],
    [map, stage, style, view, sample.id, treeStage],
  )
  const ratio = PixelRatio.get()
  const zoom = Math.max(1, Math.round((width > 540 ? 1.25 : 1) * ratio)) / ratio
  const height = width > 540 ? 332 : 276

  function confirm() {
    if (!preview) return
    const updated = addBayCell(additions, preview)
    if (updated === additions) return
    if (!saveString(storageKey, JSON.stringify(updated))) {
      setNotice("Could not save this expansion. Try again.")
      return
    }
    setAdditions(updated)
    setEditing(false)
    setNotice("One tile added to the bay.")
  }

  return (
    <View style={activityWorldStyles.root}>
      <ActivityWorldHeader onPress={() => navigation.goBack()} />
      <Screen
        preset="scroll"
        safeAreaEdges={["bottom"]}
        backgroundColor={world.paper}
        contentContainerStyle={sheet.content}
      >
        <View style={sheet.heading}>
          <Text text="HOME BASE · DESIGN PROTOTYPE" style={worldEyebrow} />
          <Text text="The bay" weight="semiBold" style={activityWorldStyles.title} />
        </View>
        <View style={sheet.row}>
          <WorldButton
            testID="bay-art-original"
            text="Original art"
            preset={detailed ? "default" : "reversed"}
            accessibilityState={{ selected: !detailed }}
            onPress={() => setDetailed(false)}
          />
          <WorldButton
            testID="bay-art-detailed"
            text="Detailed art"
            preset={detailed ? "reversed" : "default"}
            accessibilityState={{ selected: detailed }}
            onPress={() => setDetailed(true)}
          />
        </View>
        <View style={sheet.row}>
          {viewChoices.map((key) => (
            <WorldButton
              key={key}
              testID={`bay-view-${key}`}
              text={views[key]}
              preset={view === key ? "reversed" : "default"}
              accessibilityState={{ selected: view === key }}
              onPress={() => {
                setView(key)
                setEditing(false)
              }}
            />
          ))}
        </View>
        <View
          testID="bay-workshop-world"
          style={[sheet.map, { height }]}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {width > 0 && (
            <IsoWorldCanvas
              islands={islands}
              width={width}
              height={height}
              zoom={zoom}
              focus={bayFocus}
              guideTiles={preview ? candidates : undefined}
              coastGuides
              detailedSea={detailed}
              previewTile={preview}
              accessibilityLabel="Isometric bay, with a cottage, open sea and a wooden pier."
              onTap={({ x, y }) => {
                if (!editing) return
                const key = bayCellKey(bayCellAt(x, y))
                const index = candidates.findIndex((cell) => bayCellKey(cell) === key)
                if (index >= 0) setSelection(index)
              }}
            />
          )}
        </View>
        {view === "bay" && (
          <View style={sheet.expansion}>
            <Text
              testID="bay-land-count"
              accessibilityLiveRegion="polite"
              text={`${additions.length} of ${maxBayAdditions} new tiles · saved on this device`}
              style={activityWorldStyles.body}
            />
            <Text
              testID="bay-selection"
              text={
                preview
                  ? `Preview · coast tile ${selection + 1} of ${candidates.length}`
                  : notice || "The cottage and pier stay where they are."
              }
              style={activityWorldStyles.muted}
            />
            <View style={sheet.row}>
              {preview ? (
                <>
                  <WorldButton
                    testID="bay-next-tile"
                    text="Next tile"
                    onPress={() => setSelection((i) => (i + 1) % candidates.length)}
                  />
                  <WorldButton
                    testID="bay-confirm-tile"
                    text="Add one tile"
                    preset="reversed"
                    onPress={confirm}
                  />
                  <WorldButton
                    testID="bay-cancel"
                    text="Cancel"
                    onPress={() => {
                      setEditing(false)
                      setNotice("")
                    }}
                  />
                </>
              ) : (
                <WorldButton
                  testID="bay-expand"
                  text="Expand the bay"
                  preset="reversed"
                  disabled={!candidates.length}
                  onPress={() => {
                    setSelection(0)
                    setNotice("")
                    setEditing(true)
                  }}
                />
              )}
            </View>
            {preview && !!notice && <Text text={notice} accessibilityRole="alert" />}
          </View>
        )}
        {view === "garden" && (
          <BayGardenControls
            sample={sample}
            position={sampleIndex}
            size={bayGardenItems.length}
            detailed={detailed}
            stage={treeStage}
            onStep={(step) => {
              setSampleIndex((i) => (i + step + bayGardenItems.length) % bayGardenItems.length)
              setTreeStage("mature")
            }}
            onStage={setTreeStage}
          />
        )}
        {view === "harbor" && (
          <Text
            testID="bay-harbor-details"
            text="Harbor collection · pier, rowboat, buoy, sea rock and sign"
            style={activityWorldStyles.body}
          />
        )}
        <View style={sheet.gallery}>
          <Text text="VISUAL STYLES" style={worldEyebrow} />
          <View style={sheet.row}>
            {styles.map((key) => (
              <WorldButton
                key={key}
                testID={`bay-style-${key}`}
                text={bayStyles[key].label}
                preset={style === key ? "reversed" : "default"}
                accessibilityState={{ selected: style === key }}
                onPress={() => setStyle(key)}
              />
            ))}
          </View>
          {view === "bay" && (
            <>
              <Text
                text={detailed ? "COTTAGE GROWTH PREVIEW" : "COTTAGE CONSTRUCTION PREVIEW"}
                style={worldEyebrow}
              />
              <View style={sheet.row}>
                {(detailed ? growthChoices : choices).map((level) => (
                  <WorldButton
                    key={level}
                    testID={`bay-stage-${level}`}
                    text={detailed && level !== 0 ? growthStages[level - 1] : stages[level]}
                    preset={selectedStage === level ? "reversed" : "default"}
                    accessibilityState={{ selected: selectedStage === level }}
                    onPress={() => setStage(level)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </Screen>
    </View>
  )
}

const sheet = StyleSheet.create({
  content: { alignSelf: "center", gap: 14, maxWidth: 740, padding: 16, width: "100%" },
  expansion: { gap: 6, minHeight: 102 },
  gallery: { gap: 6 },
  heading: { gap: 4 },
  map: { backgroundColor: world.sea, borderRadius: worldShape.radius, overflow: "hidden" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
})
