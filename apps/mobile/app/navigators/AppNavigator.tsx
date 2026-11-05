/**
 * The app navigator (formerly "AppNavigator" and "MainNavigator") is used for the primary
 * navigation flows of your app.
 * Generally speaking, it will contain an auth flow (registration, login, forgot password)
 * and a "main" flow which the user will use once logged in.
 */
import { useEffect } from "react"
import { ActivityIndicator, View, ViewStyle } from "react-native"
import * as SplashScreen from "expo-splash-screen"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { BesideMark } from "@/components/BesideMark"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import Config from "@/config"
import { useAuth } from "@/context/AuthContext"
import { ActivitiesScreen } from "@/screens/ActivitiesScreen"
import { ActivityCreateScreen } from "@/screens/ActivityCreateScreen"
import { ActivityDetailScreen } from "@/screens/ActivityDetailScreen"
import { ErrorBoundary } from "@/screens/ErrorScreen/ErrorBoundary"
import { HomeBaseScreen } from "@/screens/HomeBaseScreen"
import { LoginScreen } from "@/screens/LoginScreen"
import { PixelWorldScreen } from "@/screens/PixelWorldScreen"
import { RewardItemsScreen } from "@/screens/RewardItemsScreen"
import { WelcomeScreen } from "@/screens/WelcomeScreen"
import { useAppTheme } from "@/theme/context"

import { DemoNavigator } from "./DemoNavigator"
import type { AppStackParamList, NavigationProps } from "./navigationTypes"
import { navigationRef, useBackButtonHandler } from "./navigationUtilities"

/**
 * This is a list of all the route names that will exit the app if the back button
 * is pressed while in that screen. Only affects Android.
 */
const exitRoutes = Config.exitRoutes

// Documentation: https://reactnavigation.org/docs/stack-navigator/
const Stack = createNativeStackNavigator<AppStackParamList>()

const AppStack = () => {
  const { isAuthenticated, isRestoring, restoreError, retryRestore } = useAuth()

  const {
    theme: { colors },
  } = useAppTheme()

  useEffect(() => {
    if (!isRestoring) SplashScreen.hideAsync().catch(() => undefined)
  }, [isRestoring])

  if (isRestoring || restoreError) {
    return (
      <View style={[$restoring, { backgroundColor: colors.background }]}>
        {isRestoring ? (
          <>
            <BesideMark scale={4} />
            <ActivityIndicator accessibilityLabel="Restoring session" color={colors.tint} />
          </>
        ) : (
          <>
            <Text text={restoreError} accessibilityRole="alert" />
            <Button text="Try again" onPress={retryRestore} />
          </>
        )}
      </View>
    )
  }

  return (
    <Stack.Navigator
      key={isAuthenticated ? "signed-in" : "signed-out"}
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
      initialRouteName={isAuthenticated ? "HomeBase" : "Login"}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="HomeBase" component={HomeBaseScreen} />
          <Stack.Screen name="Activities" component={ActivitiesScreen} />
          <Stack.Screen name="ActivityCreate" component={ActivityCreateScreen} />
          <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />

          <Stack.Screen name="Demo" component={DemoNavigator} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      )}

      {/** 🔥 Your screens go here */}
      <Stack.Screen name="RewardItems" component={RewardItemsScreen} />
      <Stack.Screen name="PixelWorld" component={PixelWorldScreen} />
      {/* IGNITE_GENERATOR_ANCHOR_APP_STACK_SCREENS */}
    </Stack.Navigator>
  )
}

export const AppNavigator = (props: NavigationProps) => {
  const { navigationTheme } = useAppTheme()

  useBackButtonHandler((routeName) => exitRoutes.includes(routeName))

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} {...props}>
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <AppStack />
      </ErrorBoundary>
    </NavigationContainer>
  )
}

const $restoring: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  gap: 16,
}
