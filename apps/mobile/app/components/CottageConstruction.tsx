import { useRef, useState } from "react"
import { View, type TextStyle, type ViewStyle } from "react-native"
import {
  COTTAGE_BUILD_STAGES,
  DEFAULT_COTTAGE_BUILD_SECONDS,
  MAX_COTTAGE_BUILD_SECONDS,
  type ApiState,
  type CottageBuildSeconds,
  type CottageLevel,
} from "@beside/api-client"

import { besideApi } from "@/services/api/beside"

import { activityWorldStyles, WorldButton, WorldTextField } from "./ActivityWorld"
import { PixelArtSprite } from "./BesideMark"
import { cottageTime, pocketWatchArt } from "./iso-world/cottageClockArt"
import { Text } from "./Text"

type Draft = Record<keyof CottageBuildSeconds, string>
const labels = { base: "Base", entrance: "Entrance", finished: "Finished" }
const boundsLabel = `Use whole seconds from 1 to ${MAX_COTTAGE_BUILD_SECONDS}.`

export function cottageDurationDraft(seconds = DEFAULT_COTTAGE_BUILD_SECONDS): Draft {
  return {
    base: String(seconds.base),
    entrance: String(seconds.entrance),
    finished: String(seconds.finished),
  }
}

export function readCottageDurations(values: Draft): CottageBuildSeconds | undefined {
  const result = {
    base: Number(values.base),
    entrance: Number(values.entrance),
    finished: Number(values.finished),
  }
  if (
    COTTAGE_BUILD_STAGES.every(
      (stage) =>
        /^\d+$/.test(values[stage].trim()) &&
        result[stage] >= 1 &&
        result[stage] <= MAX_COTTAGE_BUILD_SECONDS,
    )
  )
    return result
  return undefined
}

export function CottageDurationFields({
  values,
  onChange,
  disabled,
}: {
  values: Draft
  onChange: (values: Draft) => void
  disabled?: boolean
}) {
  return (
    <View style={$fields}>
      {COTTAGE_BUILD_STAGES.map((stage) => (
        <WorldTextField
          key={stage}
          label={`${labels[stage]} (seconds)`}
          testID={`cottage-time-${stage}`}
          value={values[stage]}
          onChangeText={(text) => onChange({ ...values, [stage]: text })}
          keyboardType="number-pad"
          maxLength={4}
          editable={!disabled}
          containerStyle={$field}
          style={$secondsInput}
          selectTextOnFocus
        />
      ))}
    </View>
  )
}

export function CottageCountdown({ level, seconds }: { level: CottageLevel; seconds: number }) {
  return (
    <View
      style={$countdown}
      testID="cottage-countdown"
      accessible
      accessibilityLabel={`Building level ${level}. ${seconds} seconds remaining.`}
    >
      <PixelArtSprite art={pocketWatchArt} scale={1} />
      <Text
        text={`Building level ${level} · ${cottageTime(seconds)}`}
        style={activityWorldStyles.muted}
      />
    </View>
  )
}

export function CottageBuildSettings({
  activity,
  onSaved,
}: {
  activity: ApiState["activities"][number]
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const savingRef = useRef(false)
  const current = activity.cottageBuild?.seconds ?? DEFAULT_COTTAGE_BUILD_SECONDS

  async function save() {
    if (!draft || savingRef.current) return
    const seconds = readCottageDurations(draft)
    if (!seconds) {
      setError(boundsLabel)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError("")
    try {
      await besideApi.updateActivity(activity.id, { cottageBuildSeconds: seconds })
      setDraft(undefined)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save construction times.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (!draft)
    return (
      <WorldButton
        text="Construction times"
        testID="cottage-edit-times"
        accessibilityState={{ expanded: false }}
        onPress={() => setDraft(cottageDurationDraft(current))}
      />
    )

  return (
    <View style={$panel}>
      <Text text="Construction times" weight="semiBold" style={activityWorldStyles.sectionTitle} />
      <Text
        text="Changes apply to upgrades not yet queued. A running clock keeps its original finish time."
        style={activityWorldStyles.muted}
      />
      <CottageDurationFields values={draft} onChange={setDraft} disabled={saving} />
      {!!error && <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />}
      <WorldButton
        text="Save times"
        testID="cottage-save-times"
        preset="filled"
        disabled={saving}
        onPress={() => void save()}
      />
      <WorldButton
        text="Cancel"
        disabled={saving}
        onPress={() => {
          setDraft(undefined)
          setError("")
        }}
      />
    </View>
  )
}

const $panel: ViewStyle = { gap: 8 }
const $fields: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 8 }
const $field: ViewStyle = { flex: 1, minWidth: 92 }
// On web a browser input has an intrinsic width larger than these three columns.
const $secondsInput: TextStyle = { minWidth: 0, textAlign: "center" }
const $countdown: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 6 }
