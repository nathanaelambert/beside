import "@expo/metro-runtime"
import { registerRootComponent } from "expo"
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web"

// CanvasKit must be ready before importing any module that uses Skia.
LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" }).then(() => {
  const { App } = require("./app/app")
  registerRootComponent(App)
})
