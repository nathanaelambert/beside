import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native"
import type { ApiState } from "@beside/api-client"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PixelArtSprite } from "@/components/BesideMark"
import { calendarArt } from "@/components/pixel-world/calendar"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { activityScheduleSummary } from "@/services/api/activitySummary"
import { besideApi } from "@/services/api/beside"
import { world, worldEyebrow, worldShape } from "@/theme/world"

type ActivityRow = { activity: ApiState["activities"][number]; summary: string }

export function ActivitiesScreen({ navigation, route }: AppStackScreenProps<"Activities">) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [homeName, setHomeName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(
    useCallback(() => {
      void attempt
      let active = true
      setLoading(true)
      setError("")
      async function load() {
        try {
          const state = await besideApi.state()
          const activities = state.activities.filter(
            (activity) => activity.connectionId === route.params.connectionId,
          )
          const next = await Promise.all(
            activities.map(async (activity) => {
              try {
                const schedules = await besideApi.schedules(activity.id)
                return { activity, summary: activityScheduleSummary(schedules) }
              } catch {
                return {
                  activity,
                  summary: "Schedule unavailable. Open the activity to try again.",
                }
              }
            }),
          )
          if (active) {
            setRows(next)
            setHomeName(
              state.connections.find((base) => base.id === route.params.connectionId)?.name ??
                "Your home base",
            )
          }
        } catch {
          if (active) setError("We couldn’t load your activities. Please try again.")
        } finally {
          if (active) setLoading(false)
        }
      }
      void load()
      return () => {
        active = false
      }
    }, [route.params.connectionId, attempt]),
  )

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable
          testID="activities-back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text text="‹ Home base" style={styles.backText} />
        </Pressable>
        <Text text="THINGS YOU DO TOGETHER" style={worldEyebrow} />
        <Text text="Activities" weight="semiBold" style={styles.title} />
        {!!homeName && <Text text={homeName} style={styles.subtitle} />}
      </View>
      <ScrollView testID="activities-screen" contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={world.forest} />
            <Text text="Opening your activities…" style={styles.body} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text text={error} accessibilityRole="alert" style={styles.error} />
            <Pressable
              accessibilityRole="button"
              style={styles.retry}
              onPress={() => setAttempt((value) => value + 1)}
            >
              <Text text="Try again" style={styles.body} />
            </Pressable>
          </View>
        ) : !rows.length ? (
          <View style={styles.empty}>
            <Text text="No activities yet" weight="semiBold" style={styles.emptyTitle} />
            <Text text="Start something together from your home base." style={styles.body} />
          </View>
        ) : (
          rows.map(({ activity, summary }) => (
            <Pressable
              key={activity.id}
              testID={`activity-row-${activity.id}`}
              accessibilityRole="button"
              onPress={() => navigation.navigate("ActivityDetail", { activityId: activity.id })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.calendar}>
                <PixelArtSprite art={calendarArt} scale={3} />
              </View>
              <View style={styles.rowContent}>
                <Text text={activity.name} weight="semiBold" style={styles.activityName} />
                <Text text={summary} style={styles.summary} />
              </View>
              <Text text="›" style={styles.chevron} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  activityName: { color: world.ink, fontSize: 17, lineHeight: 24 },
  back: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginBottom: 20,
    minHeight: worldShape.control,
  },
  backText: { color: world.text, fontSize: 14, lineHeight: 22 },
  body: { color: world.muted, fontSize: 14, lineHeight: 22 },
  calendar: { alignSelf: "flex-start", paddingTop: 2 },
  chevron: { color: world.muted, fontSize: 24, lineHeight: 30 },
  content: { flexGrow: 1, gap: 12, paddingBottom: 24, paddingHorizontal: 20 },
  empty: { gap: 12, paddingVertical: 48 },
  emptyTitle: { color: world.ink, fontSize: 18, lineHeight: 24 },
  error: { color: world.error, fontSize: 14, lineHeight: 22 },
  header: { paddingBottom: 24, paddingHorizontal: 20 },
  pressed: { opacity: 0.75 },
  retry: {
    alignSelf: "flex-start",
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    justifyContent: "center",
    minHeight: worldShape.control,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "center",
    backgroundColor: world.panel,
    borderColor: world.line,
    borderRadius: worldShape.radius,
    borderWidth: worldShape.border,
    flexDirection: "row",
    gap: 16,
    padding: 16,
  },
  rowContent: { flex: 1, gap: 8 },
  screen: { backgroundColor: world.paper, flex: 1 },
  subtitle: { color: world.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  summary: { color: world.muted, fontSize: 13, lineHeight: 20 },
  title: { color: world.ink, fontSize: 27, lineHeight: 34, marginTop: 8 },
})
