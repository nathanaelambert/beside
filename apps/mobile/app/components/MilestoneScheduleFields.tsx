import { useRef, useState } from "react"
import { Pressable, ScrollView, View, ViewStyle } from "react-native"

import { world, worldEyebrow, worldShape } from "@/theme/world"
import {
  dateInZone,
  milestoneHelp,
  overnightHint,
  repeatOptions,
  shortDate,
  timeLabel,
  timeOptions,
  validDate,
  type ScheduleForm,
} from "@/utils/milestoneSchedule"

import {
  activityWorldStyles,
  WorldButton as Button,
  WorldTextField as TextField,
} from "./ActivityWorld"
import { Text } from "./Text"

export function FormChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  testID: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={$group}>
      <Text text={label} style={$label} />
      <Button
        testID={testID}
        text={`${options.find((o) => o.value === value)?.label ?? "Choose"}  ${open ? "⌃" : "⌄"}`}
        onPress={() => setOpen(!open)}
        accessibilityState={{ expanded: open }}
      />
      {open && (
        <View style={$group}>
          {options.map((option) => (
            <Button
              key={option.value}
              testID={`${testID}-${option.value}`}
              text={option.label}
              preset={value === option.value ? "filled" : "default"}
              accessibilityState={{ selected: value === option.value }}
              onPress={() => {
                onChange(option.value)
                setOpen(false)
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}

export function ScheduleDateField({
  label,
  value,
  onChange,
  testID,
  timeZone = "America/Toronto",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  testID: string
  timeZone?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(value.slice(0, 7))
  const today = dateInZone(new Date(), timeZone)
  const date = new Date(`${month}-01T12:00:00Z`)
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  function moveMonth(offset: number) {
    setMonth(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
        .toISOString()
        .slice(0, 7),
    )
  }
  return (
    <View style={$group}>
      <Text text={label} style={$label} />
      <Button
        testID={testID}
        text={shortDate(value)}
        accessibilityLabel={`${label}, ${shortDate(value)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen(!open)
          if (validDate(value)) setMonth(value.slice(0, 7))
        }}
      />
      {open && (
        <View style={$calendar}>
          <View style={$row}>
            <Button
              testID={`${testID}-previous`}
              text="‹"
              accessibilityLabel="Previous month"
              onPress={() => moveMonth(-1)}
            />
            <Text
              style={[$flex, activityWorldStyles.sectionTitle]}
              weight="medium"
              text={new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(date)}
            />
            <Button
              testID={`${testID}-next`}
              text="›"
              accessibilityLabel="Next month"
              onPress={() => moveMonth(1)}
            />
          </View>
          <View style={$grid}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <View style={$day} key={day}>
                <Text size="xs" text={day} style={activityWorldStyles.muted} />
              </View>
            ))}
            {Array.from({ length: date.getUTCDay() }, (_, index) => (
              <View key={`blank-${index}`} style={$day} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = `${month}-${String(index + 1).padStart(2, "0")}`
              return (
                <Pressable
                  key={day}
                  testID={`${testID}-${day}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDate(day)}${day === today ? ", today" : ""}`}
                  accessibilityState={{ selected: value === day }}
                  style={[
                    $day,
                    {
                      backgroundColor: value === day ? world.forest : world.panel,
                    },
                  ]}
                  onPress={() => {
                    onChange(day)
                    setOpen(false)
                  }}
                >
                  {day === today && <View style={$todayDot} />}
                  <Text
                    text={String(index + 1)}
                    style={{
                      color:
                        value === day ? world.onForest : day === today ? world.text : world.text,
                    }}
                  />
                </Pressable>
              )
            })}
          </View>
        </View>
      )}
    </View>
  )
}

function ScheduleTimeField({
  label,
  value,
  onChange,
  testID,
  after,
}: {
  label: string
  value: string
  onChange: (time: string) => void
  testID: string
  after?: string
}) {
  const [open, setOpen] = useState(false)
  const scroll = useRef<ScrollView>(null)
  const options = timeOptions(after)
  const selectedIndex = options.findIndex((option) => option.value === value)
  return (
    <View style={$group}>
      <Text text={label} style={$label} />
      <Button
        text={after && value === "00:00" ? "Midnight" : timeLabel(value)}
        testID={testID}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <ScrollView
          ref={scroll}
          testID={`${testID}-list`}
          nestedScrollEnabled
          style={$timeList}
          onContentSizeChange={() =>
            scroll.current?.scrollTo({ y: Math.max(0, selectedIndex * 44 - 88), animated: false })
          }
        >
          {options.map((option) => (
            <Pressable
              key={option.value}
              testID={`${testID}-${option.value.replace(":", "")}`}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value)
                setOpen(false)
              }}
              style={[
                $timeOption,
                {
                  backgroundColor: option.value === value ? world.forest : world.panel,
                },
              ]}
            >
              <Text
                text={option.label}
                weight={option.value === value ? "semiBold" : "normal"}
                style={{ color: option.value === value ? world.onForest : world.text }}
              />
              {option.value === value && <Text text="✓" style={{ color: world.onForest }} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

export function MilestoneScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleForm
  onChange: (value: ScheduleForm) => void
}) {
  const update = <K extends keyof ScheduleForm>(key: K, next: ScheduleForm[K]) =>
    onChange({ ...value, [key]: next })
  const hint = overnightHint(value)
  return (
    <View style={$fields}>
      <TextField
        label="Milestone name"
        testID="milestone-name"
        maxLength={200}
        autoCorrect={false}
        spellCheck={false}
        value={value.name}
        onChangeText={(v) => update("name", v)}
      />
      <TextField
        label="Quantity per occurrence"
        testID="milestone-quantity"
        value={value.quantity}
        keyboardType="decimal-pad"
        onChangeText={(v) => update("quantity", v)}
      />
      <ScheduleDateField
        label="Starts on"
        testID="schedule-start-date"
        value={value.startDate}
        timeZone={value.timeZone}
        onChange={(v) => update("startDate", v)}
      />
      <FormChoice
        label="Repeats"
        testID="schedule-repeat"
        value={value.repeat}
        options={repeatOptions(value.startDate)}
        onChange={(v) => update("repeat", v)}
      />
      <Text text="LOGGING WINDOW" style={worldEyebrow} />
      <ScheduleTimeField
        label="From"
        testID="schedule-start-time"
        value={value.startTime}
        onChange={(v) => update("startTime", v)}
      />
      <ScheduleTimeField
        label="Until"
        testID="schedule-end-time"
        value={value.endTime}
        after={value.startTime}
        onChange={(v) => update("endTime", v)}
      />
      {!!hint && (
        <Text style={activityWorldStyles.muted} text={hint} testID="schedule-overnight-hint" />
      )}
      <Text
        style={activityWorldStyles.muted}
        testID="schedule-timezone"
        text={`Times in Eastern Time (${value.timeZone})`}
      />
      {value.repeat !== "none" && (
        <>
          <FormChoice
            label="Ends"
            testID="schedule-end"
            value={value.end}
            options={[
              { value: "never", label: "Never" },
              { value: "date", label: "On date" },
              { value: "count", label: "After N occurrences" },
            ]}
            onChange={(v) => update("end", v)}
          />
          {value.end === "date" && (
            <ScheduleDateField
              label="Last possible occurrence date"
              testID="schedule-until"
              value={value.until}
              timeZone={value.timeZone}
              onChange={(v) => update("until", v)}
            />
          )}
          {value.end === "count" && (
            <TextField
              label="Number of occurrences"
              testID="schedule-count"
              value={value.count}
              keyboardType="number-pad"
              onChangeText={(v) => update("count", v)}
            />
          )}
        </>
      )}
      <Text style={activityWorldStyles.muted} text={milestoneHelp(value)} />
    </View>
  )
}

const $flex: ViewStyle = { flex: 1 }
const $label = { color: world.muted, fontSize: 12, lineHeight: 18 }
const $todayDot: ViewStyle = {
  position: "absolute",
  bottom: 4,
  width: 4,
  height: 4,
  borderRadius: 2,
  backgroundColor: world.leaf,
}
const $grid: ViewStyle = { flexDirection: "row", flexWrap: "wrap" }
const $day: ViewStyle = {
  width: "14.2857%",
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: worldShape.radius,
}
const $group: ViewStyle = { gap: 8 }
const $fields: ViewStyle = { gap: 20 }
const $row: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12 }
const $calendar: ViewStyle = {
  backgroundColor: world.panel,
  gap: 12,
  borderWidth: worldShape.border,
  borderColor: world.line,
  borderRadius: worldShape.radius,
  padding: 12,
}
const $timeOption: ViewStyle = {
  height: 44,
  paddingHorizontal: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
}
const $timeList: ViewStyle = {
  backgroundColor: world.panel,
  maxHeight: 220,
  borderWidth: worldShape.border,
  borderColor: world.line,
  borderRadius: worldShape.radius,
}
