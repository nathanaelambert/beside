import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, View, ViewStyle } from "react-native"
import type { ApiState, MilestoneSchedule } from "@beside/api-client"
import { useFocusEffect } from "@react-navigation/native"

import {
  ActivityWorldHeader,
  activityWorldStyles,
  WorldButton as Button,
  WorldSchedulePanel,
} from "@/components/ActivityWorld"
import { PixelArtSprite } from "@/components/BesideMark"
import { avatarsForMembers } from "@/components/pixel-world/avatars"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { attendanceMembers } from "@/services/api/attendance"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import {
  isWindowOpen,
  occurrenceLabels,
  quantityLabel,
  scheduleSummary,
} from "@/utils/milestoneSchedule"

export function ActivityDetailScreen({ navigation, route }: AppStackScreenProps<"ActivityDetail">) {
  const { user } = useAuth()
  const [data, setData] = useState<ApiState>()
  const [schedules, setSchedules] = useState<MilestoneSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [submitting, setSubmitting] = useState<string>()
  const [logError, setLogError] = useState<{ milestoneId: string; message: string }>()
  const [confirmed, setConfirmed] = useState<Record<string, string>>({})
  const submittingRef = useRef(false)
  const activityId = route.params.activityId
  useFocusEffect(
    useCallback(() => {
      void refresh // Re-fetch on pull-to-refresh and retry.
      let active = true
      setLoading(true)
      setError("")
      Promise.all([besideApi.state(), besideApi.schedules(activityId)])
        .then(([state, rules]) => {
          if (!active) return
          setData(state)
          setSchedules(rules)
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : "Could not load the activity.")
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => {
        active = false
      }
    }, [activityId, refresh]),
  )
  const activity = data?.activities.find((a) => a.id === activityId)
  const members =
    data?.memberships
      .filter((membership) => membership.connectionId === activity?.connectionId)
      .map((membership) => data.users.find((user) => user.id === membership.userId))
      .filter((member) => member !== undefined) ?? []
  const memberAvatars = avatarsForMembers(members)
  const timeZone = schedules[0]?.configuration.timeZone ?? "America/Toronto"
  const milestones =
    data?.milestones
      .filter(
        (m) =>
          m.activityId === activityId &&
          m.kind === "achievement" &&
          (!m.endAt || Date.parse(m.endAt) >= Date.now()),
      )
      .sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? "")) ?? []
  const currentOccurrence = milestones.find((m) => isWindowOpen(m.startAt, m.endAt))
  const currentAttendance = attendanceMembers(data?.logs ?? [], currentOccurrence?.id)
  if (currentOccurrence && confirmed[currentOccurrence.id])
    currentAttendance.add(confirmed[currentOccurrence.id])

  async function logAttendance(milestoneId: string) {
    if (!user || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(milestoneId)
    setLogError(undefined)
    try {
      await besideApi.recordLog({
        milestoneId,
        isSuccess: true,
        title: "I was there",
        durationMinutes: 0,
        occurredAt: new Date().toISOString(),
        origin: "manual",
        externalKey: `attendance:${milestoneId}`,
      })
      // The mutation is confirmed even if a subsequent refresh loses its connection.
      setConfirmed((previous) => ({ ...previous, [milestoneId]: user.id }))
      setRefresh((value) => value + 1)
    } catch (e) {
      setLogError({
        milestoneId,
        message:
          e instanceof Error ? e.message : "Could not save your attendance. Please try again.",
      })
    } finally {
      submittingRef.current = false
      setSubmitting(undefined)
    }
  }
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
        {loading && !data && (
          <ActivityIndicator color={world.forest} accessibilityLabel="Loading activity" />
        )}
        {!!error && (
          <>
            <Text text={error} accessibilityRole="alert" style={activityWorldStyles.error} />
            <Button text="Try again" onPress={() => setRefresh((v) => v + 1)} />
          </>
        )}
        {activity ? (
          <>
            <Text
              text={`${data?.connections.find((c) => c.id === activity.connectionId)?.name ?? "Project Beside"} · ACTIVITY`.toUpperCase()}
              style={worldEyebrow}
            />
            <Text
              text={activity.name}
              weight="semiBold"
              style={activityWorldStyles.title}
              testID="activity-detail-name"
            />
            {!!activity.description && (
              <Text text={activity.description} style={activityWorldStyles.body} />
            )}
            {schedules.map((schedule) => (
              <WorldSchedulePanel
                key={schedule.id}
                name={schedule.configuration.name}
                summary={scheduleSummary(schedule.configuration)}
                timeZone={schedule.configuration.timeZone}
                testID="activity-schedule-summary"
              />
            ))}
            <View style={$membersSection} testID="activity-members-section">
              <Text text="WHO'S IN" style={worldEyebrow} />
              <View style={$members}>
                {memberAvatars.map((avatar) => (
                  <View key={avatar.key} style={$member} accessibilityLabel={avatar.name}>
                    <PixelArtSprite art={avatar.frames.idle} scale={3} />
                    <Text
                      text={avatar.name.trim().split(/\s+/)[0]}
                      style={activityWorldStyles.muted}
                    />
                    {currentAttendance.has(avatar.key) && (
                      <Text
                        text="✓ Done"
                        testID={`member-done-${avatar.key}`}
                        style={{ ...activityWorldStyles.muted, color: world.leaf }}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
            <Text text="UPCOMING MILESTONES" style={worldEyebrow} />
            {milestones.map((milestone, index) => {
              const labels = occurrenceLabels(milestone.startAt, milestone.endAt, timeZone)
              const done =
                !!user &&
                (attendanceMembers(data?.logs ?? [], milestone.id).has(user.id) ||
                  confirmed[milestone.id] === user.id)
              return (
                <View
                  key={milestone.id}
                  style={$section}
                  testID={index === 0 ? "activity-next-occurrence" : undefined}
                >
                  <View style={$occurrenceHeading}>
                    <Text
                      text={labels.date}
                      weight="semiBold"
                      style={activityWorldStyles.sectionTitle}
                    />
                    {isWindowOpen(milestone.startAt, milestone.endAt) && (
                      <View testID="occurrence-open-now" style={$openChip}>
                        <View style={$leafDot} />
                        <Text text="Open now" style={activityWorldStyles.muted} />
                      </View>
                    )}
                  </View>
                  {!!labels.time && <Text text={labels.time} style={activityWorldStyles.muted} />}
                  {milestone.quantity > 1 && (
                    <Text
                      text={quantityLabel(milestone.quantity, activity.unit)}
                      style={activityWorldStyles.muted}
                    />
                  )}
                  {done ? (
                    <View
                      testID="milestone-done"
                      style={$doneChip}
                      accessibilityLiveRegion="polite"
                    >
                      <Text
                        text="✓ Done"
                        weight="medium"
                        style={{ ...activityWorldStyles.body, color: world.leaf }}
                      />
                    </View>
                  ) : user && isWindowOpen(milestone.startAt, milestone.endAt) ? (
                    <Pressable
                      testID="milestone-log-success"
                      accessibilityRole="button"
                      accessibilityLabel="I was there"
                      accessibilityState={{
                        busy: submitting === milestone.id,
                        disabled: !!submitting,
                      }}
                      disabled={!!submitting}
                      onPress={() => void logAttendance(milestone.id)}
                      style={({ pressed }) => [$logButton, { opacity: pressed ? 0.75 : 1 }]}
                    >
                      {submitting === milestone.id ? (
                        <ActivityIndicator
                          color={world.onForest}
                          accessibilityLabel="Saving attendance"
                        />
                      ) : (
                        <Text
                          text="I was there"
                          weight="medium"
                          style={{ ...activityWorldStyles.body, color: world.onForest }}
                        />
                      )}
                    </Pressable>
                  ) : null}
                  {logError?.milestoneId === milestone.id && (
                    <Text
                      text={logError.message}
                      testID="milestone-log-error"
                      accessibilityRole="alert"
                      style={activityWorldStyles.error}
                    />
                  )}
                </View>
              )
            })}
            {!milestones.length && (
              <Text
                text="No upcoming milestones yet. Recurring milestones appear as their dates approach."
                style={activityWorldStyles.muted}
              />
            )}
            {!!schedules.length && (
              <Text
                text="Occurrences are generated up to 35 days ahead. Pull to refresh for the latest milestones."
                style={activityWorldStyles.muted}
              />
            )}
          </>
        ) : !loading && !error ? (
          <Text text="Activity not found." style={activityWorldStyles.body} />
        ) : null}
      </Screen>
    </View>
  )
}

const $section: ViewStyle = { borderTopWidth: 1, borderColor: world.line, paddingTop: 16, gap: 8 }
const $logButton: ViewStyle = {
  backgroundColor: world.forest,
  borderRadius: worldShape.radius,
  minHeight: worldShape.control,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
}
const $doneChip: ViewStyle = {
  alignSelf: "flex-start",
  backgroundColor: world.meadow,
  borderRadius: worldShape.radius,
  paddingHorizontal: 12,
  paddingVertical: 6,
}
const $membersSection: ViewStyle = { gap: 12 }
const $members: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 16 }
const $member: ViewStyle = { width: 64, alignItems: "center", gap: 6 }
const $occurrenceHeading: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
}
const $leafDot: ViewStyle = { width: 4, height: 4, borderRadius: 2, backgroundColor: world.leaf }
const $openChip: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: world.panel,
  borderColor: world.line,
  borderWidth: 1,
  borderRadius: worldShape.radius,
  paddingHorizontal: 8,
  paddingVertical: 3,
}
