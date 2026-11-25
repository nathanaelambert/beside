import { useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import {
  ApiError,
  avatarOptions,
  randomAvatarAppearance,
  type AvatarAppearance,
} from "@beside/api-client"

import { ActivityWorldHeader, activityWorldStyles, WorldButton } from "@/components/ActivityWorld"
import { PixelArtSprite, useIdleFrame } from "@/components/BesideMark"
import { customAvatarFrames } from "@/components/pixel-world/avatarCreatorArt"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"

const labels = {
  "moss-jacket": "Moss jacket",
  "indigo-jacket": "Indigo jacket",
  "clay-sweater": "Clay sweater",
  "ochre-sweater": "Ochre sweater",
} as const

type Part = keyof typeof avatarOptions
type Choice = AvatarAppearance[Part]
const choicesForParts: { [K in Part]: readonly AvatarAppearance[K][] } = avatarOptions
const choiceLabel = (value: Choice) =>
  value in labels
    ? labels[value as keyof typeof labels]
    : value.charAt(0).toUpperCase() + value.slice(1)

function PartPicker<K extends Part>({
  part,
  title,
  value,
  disabled,
  onChange,
}: {
  part: K
  title: string
  value: AvatarAppearance[K]
  disabled: boolean
  onChange: (part: K, value: AvatarAppearance[K]) => void
}) {
  const choices = choicesForParts[part]
  return (
    <View style={styles.part}>
      <Text text={title} weight="semiBold" style={activityWorldStyles.sectionTitle} />
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {choices.map((choice) => (
          <WorldButton
            key={choice}
            testID={`avatar-${part}-${choice}`}
            text={choiceLabel(choice)}
            preset={choice === value ? "reversed" : "default"}
            accessibilityRole="radio"
            accessibilityState={{ checked: choice === value, disabled }}
            aria-checked={choice === value}
            disabled={disabled}
            onPress={() => onChange(part, choice)}
            style={styles.chip}
          />
        ))}
      </View>
    </View>
  )
}

function AvatarPreview({ appearance }: { appearance: AvatarAppearance }) {
  const phase = useIdleFrame(true)(0)
  const frames = customAvatarFrames(appearance)
  return (
    <View testID="avatar-live-preview" style={styles.preview}>
      <Text text="LIVE PREVIEW · 48 × 60" style={worldEyebrow} />
      <View style={styles.stage}>
        <View style={styles.shadow} />
        <PixelArtSprite art={frames[phase]} scale={3} />
      </View>
      <View style={styles.islandScale}>
        <PixelArtSprite art={frames[phase]} scale={1} />
        <Text text="On the island · 3× zoom" style={activityWorldStyles.muted} />
      </View>
    </View>
  )
}

export function AvatarEditorScreen({ navigation, route }: AppStackScreenProps<"AvatarEditor">) {
  const { connectionId, homebaseName, appearance } = route.params
  const [draft, setDraft] = useState(() => appearance ?? randomAvatarAppearance())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)
  const { width } = useWindowDimensions()

  function change<K extends Part>(part: K, value: AvatarAppearance[K]) {
    setDraft((current) => ({ ...current, [part]: value }))
  }

  async function save() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      await besideApi.saveHomebaseAvatar(connectionId, draft)
      if (navigation.isFocused()) navigation.goBack()
    } catch (problem) {
      setError(
        problem instanceof ApiError && problem.status === 404
          ? "This home base is no longer available."
          : "We couldn’t save your avatar. Your changes are still here; try again.",
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <View testID="avatar-editor" style={activityWorldStyles.root}>
      <ActivityWorldHeader text="Back to island" onPress={busy ? undefined : navigation.goBack} />
      <Screen
        preset="scroll"
        safeAreaEdges={["bottom"]}
        backgroundColor={world.paper}
        contentContainerStyle={styles.page}
      >
        <View style={styles.heading}>
          <Text text="HOME BASE · AVATAR WORKSHOP" style={worldEyebrow} />
          <Text
            text={appearance ? "Edit your avatar" : "Create your avatar"}
            weight="semiBold"
            style={activityWorldStyles.title}
          />
          <Text
            text={`Just for ${homebaseName}. Other islands keep their own look.`}
            style={activityWorldStyles.body}
          />
        </View>
        <View style={[styles.layout, width >= 790 && styles.wide]}>
          <View style={styles.previewColumn}>
            <AvatarPreview appearance={draft} />
            <WorldButton
              testID="avatar-randomize"
              text="Surprise me"
              disabled={busy}
              onPress={() => setDraft(randomAvatarAppearance())}
            />
          </View>
          <View style={styles.parts}>
            <PartPicker
              part="skin"
              title="Skin tone"
              value={draft.skin}
              disabled={busy}
              onChange={change}
            />
            <PartPicker
              part="hair"
              title="Hair"
              value={draft.hair}
              disabled={busy}
              onChange={change}
            />
            {draft.hair !== "bald" && (
              <PartPicker
                part="hairColor"
                title="Hair color"
                value={draft.hairColor}
                disabled={busy}
                onChange={change}
              />
            )}
            <PartPicker
              part="glasses"
              title="Glasses"
              value={draft.glasses}
              disabled={busy}
              onChange={change}
            />
            <PartPicker
              part="outfit"
              title="Outfit"
              value={draft.outfit}
              disabled={busy}
              onChange={change}
            />
            {error ? (
              <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
            ) : null}
            <WorldButton
              testID="avatar-save"
              text={busy ? "Saving…" : "Save avatar"}
              preset="reversed"
              disabled={busy}
              onPress={save}
            />
          </View>
        </View>
      </Screen>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12 },
  heading: { gap: 4 },
  islandScale: { alignItems: "center", gap: 3, paddingTop: 2 },
  layout: { gap: 20 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  page: { ...activityWorldStyles.content, alignSelf: "center", maxWidth: 960, width: "100%" },
  part: { gap: 5 },
  parts: { flex: 1, gap: 16 },
  preview: {
    alignItems: "center",
    backgroundColor: world.meadow,
    borderColor: world.meadowBorder,
    borderRadius: worldShape.radius,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  previewColumn: { gap: 8, minWidth: 258 },
  shadow: {
    backgroundColor: world.leaf,
    borderRadius: 60,
    bottom: 3,
    height: 14,
    opacity: 0.35,
    position: "absolute",
    width: 119,
  },
  stage: { alignItems: "center", justifyContent: "center", paddingBottom: 8, paddingTop: 7 },
  wide: { alignItems: "flex-start", flexDirection: "row" },
})
