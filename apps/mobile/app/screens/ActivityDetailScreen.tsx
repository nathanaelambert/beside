import { useCallback, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, View, ViewStyle } from "react-native"
import type { ApiState, MilestoneSchedule, RewardAgreement } from "@beside/api-client"
import type { RewardItem } from "@beside/rewards"
import { useFocusEffect } from "@react-navigation/native"

import {
  ActivityWorldHeader,
  activityWorldStyles,
  WorldButton as Button,
  WorldSchedulePanel,
} from "@/components/ActivityWorld"
import { PixelArtSprite } from "@/components/BesideMark"
import { MilestoneReward, RewardChip, RewardLanded } from "@/components/MilestoneReward"
import { homeActivities } from "@/components/iso-world/homeWorld"
import { IsoWorldCanvas } from "@/components/iso-world/IsoWorldCanvas"
import { buildActivityScene, roofForIndex } from "@/components/iso-world/scene"
import { avatarsForMembers } from "@/components/pixel-world/avatars"
import { catalogue } from "@/components/pixel-world/scene"
import { RewardChangeSheet } from "@/components/RewardChangeSheet"
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
import {
  agreedUserIds,
  cadenceFromSchedule,
  firstName,
  meadowCounts,
  rewardStatus,
} from "@/utils/rewardChoice"

type Milestone = ApiState["milestones"][number]

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
  const [agreements, setAgreements] = useState<RewardAgreement[]>([])
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set())
  const [rewardBusy, setRewardBusy] = useState<string>()
  const [rewardError, setRewardError] = useState<{ rewardId: string; message: string }>()
  const [changing, setChanging] = useState<Milestone>()
  const [changeSaving, setChangeSaving] = useState(false)
  const [changeError, setChangeError] = useState("")
  const [landed, setLanded] = useState<string>()
  // Rewards already earned when we last looked, to celebrate only fresh landings.
  const earnedBefore = useRef<Set<string>>(undefined)
  const activityId = route.params.activityId
  useFocusEffect(
    useCallback(() => {
      void refresh // Re-fetch on pull-to-refresh and retry.
      let active = true
      setLoading(true)
      setError("")
      const snapshot = besideApi.state().then((state) => ({ state, received: performance.now() }))
      Promise.all([snapshot, besideApi.schedules(activityId)])
        .then(async ([{ state, received }, rules]) => {
          const connectionId = state.activities.find((a) => a.id === activityId)?.connectionId
          // Reward extras are optional: the activity still works without them.
          const [agreed, garden] = connectionId
            ? await Promise.all([
                besideApi.rewardAgreements(connectionId).catch(() => [] as RewardAgreement[]),
                besideApi.homebaseGarden(connectionId).catch(() => undefined),
              ])
            : [[] as RewardAgreement[], undefined]
          if (!active) return
          const ours = new Set(
            state.milestones
              .filter((m) => m.activityId === activityId && m.rewardId)
              .map((m) => m.rewardId!),
          )
          const earned = new Set(
            state.rewards.filter((r) => r.obtainedAt && ours.has(r.id)).map((r) => r.id),
          )
          const placed = new Set(garden?.rewards.map((r) => r.rewardId) ?? [])
          const fresh = earnedBefore.current
            ? [...earned].find((id) => !earnedBefore.current!.has(id) && !placed.has(id))
            : undefined
          earnedBefore.current = earned
          if (fresh) setLanded(fresh)
          setReceivedAt(received)
          setTick(performance.now())
          setData(state)
          setSchedules(rules)
          setAgreements(agreed)
          setPlacedIds(placed)
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
  const cadence = cadenceFromSchedule(schedules[0]?.configuration)
  const itemFor = (itemId: string): RewardItem | undefined =>
    data?.rewardItems.find((item) => item.id === itemId) ?? catalogue.get(itemId)
  const changeable = (milestone: Milestone) =>
    !(data?.logs ?? []).some((log) => log.milestoneId === milestone.id) &&
    (!milestone.endAt || Date.parse(milestone.endAt) >= now)
  const landedReward = data?.rewards.find((r) => r.id === landed)
  const landedMilestone = data?.milestones.find((m) => m.rewardId === landed)
  const landedItem = landedReward && itemFor(landedReward.itemId)
  const listed = new Set(
    [...(currentOccurrence ? [currentOccurrence] : []), ...otherOpen, ...upcoming].map((m) => m.id),
  )
  const pastRewards =
    data?.milestones.filter(
      (m) =>
        m.activityId === activityId &&
        m.rewardId &&
        !listed.has(m.id) &&
        data.rewards.find((r) => r.id === m.rewardId)?.obtainedAt,
    ) ?? []

  function placeReward(rewardId: string) {
    if (!activity) return
    setLanded(undefined)
    navigation.navigate("HomeBase", { connectionId: activity.connectionId, rewardId, place: true })
  }

  function viewReward(rewardId: string) {
    if (!activity) return
    navigation.navigate("HomeBase", { connectionId: activity.connectionId, rewardId })
  }

  async function agree(rewardId: string) {
    if (rewardBusy) return
    setRewardBusy(rewardId)
    setRewardError(undefined)
    try {
      const rows = await besideApi.agreeToReward(rewardId)
      setAgreements((previous) => [...previous.filter((r) => r.rewardId !== rewardId), ...rows])
    } catch (e) {
      setRewardError({
        rewardId,
        message: e instanceof Error ? e.message : "Could not save your agreement.",
      })
    } finally {
      setRewardBusy(undefined)
    }
  }

  async function changeReward(itemId: string | null) {
    if (!changing || changeSaving) return
    setChangeSaving(true)
    setChangeError("")
    try {
      await besideApi.updateMilestone(changing.id, { itemId })
      setChanging(undefined)
      setRefresh((value) => value + 1)
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : "Could not change the reward.")
    } finally {
      setChangeSaving(false)
    }
  }

  function renderReward(milestone: Milestone, open: boolean) {
    if (!data) return null
    const reward = data.rewards.find((r) => r.id === milestone.rewardId)
    if (!reward)
      return changeable(milestone) ? (
        <Pressable
          accessibilityRole="button"
          testID="reward-add"
          onPress={() => setChanging(milestone)}
          style={$addReward}
        >
          <Text text="＋ Add a reward" style={activityWorldStyles.body} />
        </Pressable>
      ) : null
    const item = itemFor(reward.itemId)
    if (!item) return null
    const status = rewardStatus({
      reward,
      milestone,
      logs: data.logs,
      placedRewardIds: placedIds,
      now,
    })
    const agreed = agreedUserIds(reward, agreements)
    const roster = avatarsForMembers(
      reward.requiredUserIds.map(
        (id) => data.users.find((u) => u.id === id) ?? { id, name: "Member" },
      ),
    )
    if (!open) {
      const detail =
        status === "proposed"
          ? `${agreed.length} of ${roster.length} agreed${changeable(milestone) ? " · Tap to suggest another" : ""}`
          : status === "earned"
            ? "Earned · ready to place"
            : status === "placed"
              ? "In your meadow"
              : status === "missed"
                ? "Not earned"
                : "Locked in"
      const chip = <RewardChip item={item} detail={detail} />
      return changeable(milestone) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reward ${item.name}. ${detail}`}
          onPress={() => setChanging(milestone)}
        >
          {chip}
        </Pressable>
      ) : status === "earned" || status === "placed" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (status === "earned" ? placeReward(reward.id) : viewReward(reward.id))}
        >
          {chip}
        </Pressable>
      ) : (
        chip
      )
    }
    return (
      <MilestoneReward
        item={item}
        status={status}
        roster={roster}
        agreed={agreed}
        checkedIn={attendanceMembers(data.logs, milestone.id)}
        currentUserId={user?.id}
        busy={rewardBusy === reward.id}
        error={rewardError?.rewardId === reward.id ? rewardError.message : undefined}
        onAgree={() => void agree(reward.id)}
        onChange={changeable(milestone) ? () => setChanging(milestone) : undefined}
        onPlace={() => placeReward(reward.id)}
        onView={() => viewReward(reward.id)}
      />
    )
  }
  const confirmedAttendee = currentOccurrence && confirmed[currentOccurrence.id]
  if (confirmedAttendee) currentAttendance.add(confirmedAttendee)
  const roofIndex =
    data && activity
      ? homeActivities(data, activity.connectionId, now).findIndex((a) => a.id === activityId)
      : 0
  const attendeeKey = memberAvatars
    .filter((avatar) => currentAttendance.has(avatar.key))
    .map((avatar) => avatar.key)
    .join(",")
  const lit = !!currentOccurrence
  const plot = useMemo(
    () =>
      buildActivityScene({
        roof: roofForIndex(roofIndex),
        lit,
        attendees: memberAvatars.filter((avatar) => attendeeKey.split(",").includes(avatar.key)),
      }),
    // memberAvatars is rebuilt every render; the attendee keys capture what is drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roofIndex, lit, attendeeKey, data],
  )
  const [plotWidth, setPlotWidth] = useState(0)
  const plotZoom = plotWidth >= plot.frame.width * 3 ? 3 : plotWidth >= plot.frame.width * 2 ? 2 : 1
  const plotHeight = Math.min(plot.frame.height * plotZoom, 240)

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
        {renderReward(milestone, open)}
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
            {landedReward && landedItem && landedMilestone && (
              <RewardLanded
                item={landedItem}
                milestoneName={landedMilestone.name}
                onPlace={() => placeReward(landedReward.id)}
                onDismiss={() => setLanded(undefined)}
              />
            )}
            <View
              testID="activity-plot"
              style={[$plot, { height: plotHeight || 200 }]}
              onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
            >
              {plotWidth > 0 && (
                <IsoWorldCanvas
                  width={plotWidth}
                  height={plotHeight}
                  map={plot.map}
                  frame={plot.frame}
                  drawables={plot.drawables}
                  zoom={plotZoom}
                  focus={{ u: 2.2, v: 1.6 }}
                  interactive={false}
                  accessibilityLabel={`${activity.name} cottage. ${currentAttendance.size} of ${memberAvatars.length} friends here.`}
                />
              )}
              <View pointerEvents="none" style={$plotLabel}>
                <Text
                  testID="activity-plot-caption"
                  text={
                    currentOccurrence
                      ? `${currentAttendance.size} of ${memberAvatars.length} here · lights on`
                      : "Lights off until the next session"
                  }
                  style={$plotLabelText}
                />
              </View>
            </View>
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
            {!!pastRewards.length && (
              <View style={$milestoneList} testID="activity-earned-rewards">
                <Text text="EARNED HERE" style={worldEyebrow} />
                {pastRewards.map((milestone) => (
                  <View key={milestone.id} style={$section}>
                    <Text
                      text={milestone.name}
                      weight="semiBold"
                      style={activityWorldStyles.sectionTitle}
                    />
                    {renderReward(milestone, false)}
                  </View>
                ))}
              </View>
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
      {data && changing && (
        <RewardChangeSheet
          visible
          milestoneName={changing.name}
          items={data.rewardItems}
          initial={data.rewards.find((r) => r.id === changing.rewardId)?.itemId ?? null}
          cadence={cadence}
          counts={meadowCounts(data, activity?.connectionId)}
          rosterNames={members.map((member) => firstName(member.name))}
          saving={changeSaving}
          error={changeError}
          onCancel={() => {
            setChanging(undefined)
            setChangeError("")
          }}
          onSave={(itemId) => void changeReward(itemId)}
        />
      )}
    </View>
  )
}

const $milestoneList: ViewStyle = { gap: 12 }
const $addReward: ViewStyle = {
  minHeight: 44,
  justifyContent: "center",
  paddingHorizontal: 12,
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: world.line,
  borderRadius: worldShape.radius,
}
const $plot: ViewStyle = {
  backgroundColor: world.sea,
  borderRadius: worldShape.radius,
  overflow: "hidden",
}
const $plotLabel: ViewStyle = {
  position: "absolute",
  left: 10,
  top: 10,
  backgroundColor: world.panel,
  borderRadius: worldShape.smallRadius,
  paddingHorizontal: 10,
  paddingVertical: 5,
}
const $plotLabelText = { color: world.text, fontSize: 11, lineHeight: 16 }
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
