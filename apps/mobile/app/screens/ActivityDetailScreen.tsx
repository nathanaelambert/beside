import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, RefreshControl, TextStyle, View, ViewStyle } from "react-native"
import type { ApiState, MilestoneSchedule } from "@beside/api-client"
import { precursorOf } from "@beside/api-client/precursors"
import { useFocusEffect } from "@react-navigation/native"

import {
  ActivityWorldHeader,
  activityWorldStyles,
  WorldButton as Button,
  WorldSchedulePanel,
} from "@/components/ActivityWorld"
import { PixelArtSprite } from "@/components/BesideMark"
import { avatarsForMembers } from "@/components/pixel-world/avatars"
import { aItem, itemLabel } from "@/components/pixel-world/garden"
import { catalogue } from "@/components/pixel-world/scene"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  attendanceMembers,
  attendanceMilestones,
  estimateServerNow,
} from "@/services/api/attendance"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"
import { occurrenceLabels, quantityLabel, scheduleSummary } from "@/utils/milestoneSchedule"

export function ActivityDetailScreen({ navigation, route }: AppStackScreenProps<"ActivityDetail">) {
  const { user } = useAuth()
  const [data, setData] = useState<ApiState>()
  const [schedules, setSchedules] = useState<MilestoneSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [submitting, setSubmitting] = useState<string>()
  const [logError, setLogError] = useState("")
  const [confirmed, setConfirmed] = useState<Record<string, string>>({})
  const [receivedAt, setReceivedAt] = useState(0)
  const [tick, setTick] = useState(() => performance.now())
  const submittingRef = useRef(false)
  const activityId = route.params.activityId
  useFocusEffect(
    useCallback(() => {
      void refresh // Re-fetch on pull-to-refresh and retry.
      let active = true
      setLoading(true)
      setError("")
      const snapshot = besideApi.state().then((state) => ({ state, received: performance.now() }))
      Promise.all([snapshot, besideApi.schedules(activityId)])
        .then(([{ state, received }, rules]) => {
          if (!active) return
          setReceivedAt(received)
          setTick(performance.now())
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
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => setTick(performance.now()), 1000)
      return () => clearInterval(timer)
    }, []),
  )
  const activity = data?.activities.find((a) => a.id === activityId)
  const members =
    data?.memberships
      .filter((membership) => membership.connectionId === activity?.connectionId)
      .map((membership) => data.users.find((user) => user.id === membership.userId))
      .filter((member) => member !== undefined) ?? []
  const memberAvatars = avatarsForMembers(members)
  const timeZone = schedules[0]?.configuration.timeZone ?? "America/Toronto"
  const snapshotTime = Date.parse(data?.serverTime ?? "")
  const now = Number.isFinite(snapshotTime)
    ? estimateServerNow(snapshotTime, receivedAt, tick)
    : Date.now()
  const {
    open: [currentOccurrence, ...otherOpen],
    upcoming,
  } = attendanceMilestones(data?.milestones ?? [], activityId, now)
  const currentAttendance = attendanceMembers(data?.logs ?? [], currentOccurrence?.id)
  const confirmedAttendee = currentOccurrence && confirmed[currentOccurrence.id]
  if (confirmedAttendee) currentAttendance.add(confirmedAttendee)

  async function logAttendance(milestoneId: string) {
    if (!user || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(milestoneId)
    setLogError("")
    try {
      await besideApi.recordLog({
        milestoneId,
        isSuccess: true,
        title: "I was there",
        durationMinutes: 0,
        origin: "manual",
        externalKey: `attendance:${milestoneId}`,
      })
      // The mutation is confirmed even if a subsequent refresh loses its connection.
      setConfirmed((previous) => ({ ...previous, [milestoneId]: user.id }))
      setRefresh((value) => value + 1)
    } catch (e) {
      const reason = e instanceof Error ? e.message : ""
      const closed = reason === "This milestone's logging window has closed."
      const notStarted = reason === "This milestone has not started yet."
      if (closed || notStarted) setRefresh((value) => value + 1)
      setLogError(
        closed
          ? "This session has ended."
          : notStarted
            ? "This session hasn’t started yet."
            : reason || "Could not save your attendance. Please try again.",
      )
    } finally {
      submittingRef.current = false
      setSubmitting(undefined)
    }
  }

  function renderReward(milestone: ApiState["milestones"][number]) {
    const reward = data?.rewards.find((r) => r.id === milestone.rewardId)
    const item = reward && catalogue.get(reward.itemId)
    if (!reward || !item) return null
    const precursor = precursorOf(reward.itemId)
    const object = data?.gardenObjects.find((o) => o.id === reward.gardenObjectId)
    const done = reward.requiredUserIds.filter((id) =>
      data?.logs.some(
        (l) => l.milestoneId === milestone.id && l.authorUserId === id && l.isSuccess,
      ),
    ).length
    // Name the chosen precursor: the starter oak, or the milestone that earns it.
    const targetObject = data?.gardenObjects.find((o) => o.id === reward.targetObjectId)
    const targetReward = data?.rewards.find((r) => r.id === reward.targetRewardId)
    const targetMilestone =
      targetReward && data?.milestones.find((m) => m.rewardId === targetReward.id)
    const buildsOn = !precursor
      ? ""
      : targetObject?.origin === "starter"
        ? ", built on your starter oak"
        : targetMilestone
          ? `, built on the ${itemLabel(precursor)} from “${targetMilestone.name}”`
          : `, built on ${aItem(precursor)}`
    const unplaced = object && object.x === null
    const text = !reward.obtainedAt
      ? `Earns ${item.name}${buildsOn} · ${done} of ${reward.requiredUserIds.length} checked in`
      : !object
        ? `${item.name} earned · waiting for ${aItem(precursor ?? reward.itemId)} to build on`
        : precursor
          ? `✓ ${item.name} earned · your ${targetObject?.origin === "starter" ? "starter oak" : itemLabel(precursor)} was upgraded`
          : unplaced
            ? `✓ ${item.name} earned · choose its spot in your garden`
            : `✓ ${item.name} earned · now in your garden`
    return (
      <View style={$rewardBlock}>
        <View style={$reward} testID={`milestone-reward-${reward.itemId}`}>
          <PixelArtSprite art={item.artifact} scale={1} />
          <Text
            text={text}
            style={[
              activityWorldStyles.muted,
              $flex,
              reward.obtainedAt ? { color: world.forest } : null,
            ]}
          />
        </View>
        {unplaced && activity && (
          <Button
            text="Place it in the garden"
            testID="milestone-place-reward"
            onPress={() =>
              navigation.popTo("HomeBase", {
                connectionId: activity.connectionId,
                placeObjectId: object.id,
              })
            }
          />
        )}
      </View>
    )
  }

  function renderMilestone(milestone: ApiState["milestones"][number], open = false) {
    const { id, name, startAt, endAt, quantity } = milestone
    const primary = id === currentOccurrence?.id
    const { date, time } = occurrenceLabels(startAt, endAt, timeZone)
    const done =
      open &&
      user &&
      (attendanceMembers(data?.logs ?? [], id).has(user.id) || confirmed[id] === user.id)
    const saving = submitting === id
    return (
      <View
        key={id}
        style={[$section, primary && $active]}
        testID={primary ? "activity-active-milestone" : undefined}
      >
        <View style={$occurrenceHeading}>
          <Text text={name} weight="semiBold" style={activityWorldStyles.sectionTitle} />
          {open && <Text text="Open now" style={activityWorldStyles.muted} />}
        </View>
        <Text text={time ? `${date} · ${time}` : date} style={activityWorldStyles.muted} />
        {renderReward(milestone)}
        {quantity > 1 && activity && (
          <Text text={quantityLabel(quantity, activity.unit)} style={activityWorldStyles.muted} />
        )}
        {done ? (
          <View testID="milestone-done" accessibilityLiveRegion="polite">
            <Text
              text="✓ Attendance recorded"
              style={{ ...activityWorldStyles.body, color: world.leaf }}
            />
          </View>
        ) : open && user ? (
          <Button
            text={saving ? "Saving attendance…" : "I was there"}
            testID="milestone-log-success"
            preset="filled"
            disabled={!!submitting}
            onPress={() => void logAttendance(id)}
          />
        ) : null}
      </View>
    )
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
            {currentOccurrence && renderMilestone(currentOccurrence, true)}
            {otherOpen.length > 0 && (
              <View style={$milestoneList}>
                <Text text="ALSO OPEN" style={worldEyebrow} />
                {otherOpen.map((milestone) => renderMilestone(milestone, true))}
              </View>
            )}
            {!!logError && (
              <Text
                text={logError}
                testID="milestone-log-error"
                accessibilityRole="alert"
                style={activityWorldStyles.error}
              />
            )}
            {!!activity.description && (
              <Text text={activity.description} style={activityWorldStyles.body} />
            )}
            <View style={$actions}>
              <Button
                text="Plan a milestone"
                testID="activity-plan-milestone"
                style={$action}
                onPress={() =>
                  navigation.navigate("ActivityCreate", {
                    connectionId: activity.connectionId,
                    activityId: activity.id,
                  })
                }
              />
              <Button
                text="Garden"
                testID="activity-open-garden"
                style={$action}
                onPress={() =>
                  // Return to the garden already in the stack instead of stacking another.
                  navigation.popTo("HomeBase", { connectionId: activity.connectionId })
                }
              />
            </View>
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
            <View style={$milestoneList}>
              <Text text="UPCOMING MILESTONES" style={worldEyebrow} />
              {upcoming.map((milestone) => renderMilestone(milestone))}
              {!upcoming.length && (
                <Text text="No upcoming milestones." style={activityWorldStyles.muted} />
              )}
            </View>
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

const $milestoneList: ViewStyle = { gap: 12 }
const $section: ViewStyle = { borderTopWidth: 1, borderColor: world.line, paddingTop: 16, gap: 8 }
const $active: ViewStyle = {
  backgroundColor: world.panel,
  borderWidth: 1,
  borderRadius: worldShape.radius,
  padding: 16,
}
const $occurrenceHeading: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
}
const $membersSection: ViewStyle = { gap: 12 }
const $members: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 16 }
const $member: ViewStyle = { width: 64, alignItems: "center", gap: 6 }
const $reward: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 }
const $actions: ViewStyle = { flexDirection: "row", gap: 12 }
const $action: ViewStyle = { flex: 1 }
const $rewardBlock: ViewStyle = { gap: 8 }
const $flex: TextStyle = { flex: 1 }
