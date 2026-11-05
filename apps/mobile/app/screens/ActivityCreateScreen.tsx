import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import type { ApiState } from "@beside/api-client"

import {
  ActivityWorldHeader,
  activityWorldStyles,
  WorldButton as Button,
  WorldSchedulePanel,
  WorldTextField as TextField,
} from "@/components/ActivityWorld"
import { FormChoice, MilestoneScheduleFields } from "@/components/MilestoneScheduleFields"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow } from "@/theme/world"
import {
  initialScheduleForm,
  scheduleFormToInput,
  scheduleSummary,
} from "@/utils/milestoneSchedule"

export function ActivityCreateScreen({ navigation, route }: AppStackScreenProps<"ActivityCreate">) {
  const [data, setData] = useState<ApiState>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [target, setTarget] = useState("1")
  const [step, setStep] = useState<"activity" | "milestone">("activity")
  const [form, setForm] = useState(initialScheduleForm)
  const [saving, setSaving] = useState(false)
  const [createdActivityId, setCreatedActivityId] = useState<string>()
  const savingRef = useRef(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const template = data?.activityTemplates.find((t) => t.id === templateId)
  const homebase = data?.connections.find((c) => c.id === route.params.connectionId)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    besideApi
      .state()
      .then((state) => {
        if (!active) return
        setData(state)
        setTemplateId(
          (current) =>
            current ||
            state.activityTemplates.find((t) => t.id === "custom-project")?.id ||
            state.activityTemplates[0]?.id ||
            "",
        )
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load activity types.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  function next() {
    if (!name.trim()) {
      setError("Give your activity a name.")
      return
    }
    if (!template || !homebase) {
      setError("Choose an activity type and a home base you belong to.")
      return
    }
    if (!Number.isFinite(Number(target)) || Number(target) <= 0) {
      setError("Enter a personal target greater than zero.")
      return
    }
    setError("")
    setStep("milestone")
  }

  async function save() {
    if (savingRef.current) return
    setError("")
    let input
    try {
      input = scheduleFormToInput(form)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      let activityId = createdActivityId
      if (!activityId) {
        const result = await besideApi.createActivity({
          templateId,
          name: name.trim(),
          description: description.trim(),
          connectionId: route.params.connectionId,
          subjectIds: [],
          target: Number(target),
        })
        activityId = result.entityId
        setCreatedActivityId(activityId)
      }
      await besideApi.createSchedule(activityId, input)
      navigation.replace("ActivityDetail", { activityId })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  let summary = "Choose the dates and times for your milestone."
  try {
    summary = scheduleSummary(scheduleFormToInput(form))
  } catch {
    /* Validation appears on save. */
  }

  return (
    <View style={activityWorldStyles.root}>
      <ActivityWorldHeader
        text={step === "milestone" && !createdActivityId ? "Back" : "Close"}
        onPress={
          saving
            ? undefined
            : () => {
                if (createdActivityId)
                  navigation.replace("ActivityDetail", { activityId: createdActivityId })
                else if (step === "milestone") {
                  setStep("activity")
                  setError("")
                } else navigation.goBack()
              }
        }
      />
      <Screen
        key={step}
        preset="scroll"
        safeAreaEdges={["bottom"]}
        backgroundColor={world.paper}
        contentContainerStyle={activityWorldStyles.content}
      >
        {loading ? (
          <ActivityIndicator color={world.forest} accessibilityLabel="Loading activity types" />
        ) : !data ? (
          <>
            <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
            <Button text="Try again" onPress={() => setLoadAttempt((n) => n + 1)} />
          </>
        ) : step === "activity" ? (
          <>
            <Text
              text={`${homebase?.name ?? "Home base"} · ACTIVITY`.toUpperCase()}
              style={worldEyebrow}
            />
            <Text text="New activity" weight="semiBold" style={activityWorldStyles.title} />
            <Text
              text="Start something together, then plan when to show up."
              style={activityWorldStyles.body}
            />
            <TextField
              label="Activity name"
              testID="activity-name"
              value={name}
              maxLength={200}
              autoCorrect={false}
              spellCheck={false}
              onChangeText={setName}
              placeholder="What will you do together?"
            />
            <FormChoice
              label="Activity type"
              testID="activity-template"
              value={templateId}
              options={data.activityTemplates.map((t) => ({ value: t.id, label: t.name }))}
              onChange={setTemplateId}
            />
            <TextField
              label={`My target (${template?.unit ?? "units"})`}
              testID="activity-target"
              keyboardType="decimal-pad"
              value={target}
              onChangeText={setTarget}
              helper="Your personal goal for this activity."
            />
            <TextField
              label="Description (optional)"
              testID="activity-description"
              value={description}
              maxLength={2000}
              multiline
              onChangeText={setDescription}
            />
            {!!error && (
              <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
            )}
            <Button
              text="Next: plan milestone"
              testID="activity-next"
              preset="reversed"
              onPress={next}
            />
          </>
        ) : (
          <>
            <Text
              text={`${homebase?.name ?? "Home base"} · MILESTONE`.toUpperCase()}
              style={worldEyebrow}
            />
            <Text text="Plan a milestone" weight="semiBold" style={activityWorldStyles.title} />
            <Text text={name.trim()} style={activityWorldStyles.body} />
            {createdActivityId && (
              <Text
                text="Your activity is saved. Finish saving its milestone below, or close to view the activity."
                style={activityWorldStyles.muted}
              />
            )}
            <View pointerEvents={saving ? "none" : "auto"} accessibilityElementsHidden={saving}>
              <MilestoneScheduleFields value={form} onChange={setForm} />
            </View>
            <WorldSchedulePanel
              name={form.name}
              summary={summary}
              timeZone={form.timeZone}
              testID="schedule-summary"
            />
            {!!error && (
              <Text
                text={error}
                testID="activity-save-error"
                accessibilityRole="alert"
                style={activityWorldStyles.error}
              />
            )}
            <Button
              text={saving ? "Saving…" : createdActivityId ? "Save milestone" : "Create activity"}
              testID="activity-save"
              preset="reversed"
              disabled={saving}
              onPress={save}
            />
            {saving && (
              <ActivityIndicator
                color={world.forest}
                accessibilityLabel="Saving activity and milestone"
              />
            )}
          </>
        )}
      </Screen>
    </View>
  )
}
