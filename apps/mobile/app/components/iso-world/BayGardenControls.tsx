import { StyleSheet, View } from "react-native"
import type { RewardItem } from "@beside/rewards"

import { activityWorldStyles, WorldButton } from "@/components/ActivityWorld"
import { Text } from "@/components/Text"
import { worldEyebrow } from "@/theme/world"

import { hasGrowthArt, treeArtStages, type TreeArtStage } from "./worldDetailArt"

const treeStages = { sprout: "Sprout", young: "Young", mature: "Mature" }
const flowerStages = { sprout: "Sprout", young: "Bud", mature: "In bloom" }

export function BayGardenControls({
  sample,
  position,
  size,
  detailed,
  stage,
  onStep,
  onStage,
}: {
  sample: RewardItem
  position: number
  size: number
  detailed: boolean
  stage: TreeArtStage
  onStep: (step: -1 | 1) => void
  onStage: (stage: TreeArtStage) => void
}) {
  const growth = hasGrowthArt(sample.id)
  const stageLabels = sample.category === "Flowers" ? flowerStages : treeStages
  return (
    <View style={styles.gallery}>
      <Text text="GARDEN COLLECTION" style={worldEyebrow} />
      <Text
        testID="bay-garden-sample"
        accessibilityLiveRegion="polite"
        text={`${position + 1} of ${size} · ${sample.name}`}
        style={activityWorldStyles.sectionTitle}
      />
      <View style={styles.row}>
        <WorldButton testID="bay-garden-previous" text="Previous item" onPress={() => onStep(-1)} />
        <WorldButton testID="bay-garden-next" text="Next item" onPress={() => onStep(1)} />
      </View>
      {growth && (
        <>
          <Text
            text={detailed ? "GROWTH PREVIEW" : "GROWTH PREVIEW · AVAILABLE IN DETAILED ART"}
            style={worldEyebrow}
          />
          <View style={styles.row}>
            {treeArtStages.map((phase) => (
              <WorldButton
                key={phase}
                testID={`bay-growth-${phase}`}
                text={stageLabels[phase]}
                disabled={!detailed}
                preset={stage === phase ? "reversed" : "default"}
                accessibilityState={{ selected: stage === phase, disabled: !detailed }}
                onPress={() => onStage(phase)}
              />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: { gap: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
})
