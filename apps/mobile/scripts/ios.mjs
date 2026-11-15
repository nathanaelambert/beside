import { execFileSync, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL, URL } from "node:url"

const require = createRequire(import.meta.url)
const appRoot = fileURLToPath(new URL("../", import.meta.url))

export function selectSimulator(devices) {
  const candidates = Object.entries(devices)
    .filter(([runtime]) => /\.iOS-27(?:-|$)/.test(runtime))
    .flatMap(([, devices]) => devices)
    .filter((device) => device.isAvailable && device.name.startsWith("iPhone"))

  return candidates.find((device) => device.state === "Booted") ?? candidates[0]
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const expoArgs = args.filter((arg) => arg !== "--dry-run")
  const explicitDevice = expoArgs.some(
    (arg) => arg === "--device" || arg === "-d" || arg.startsWith("--device="),
  )

  if (!explicitDevice && !expoArgs.includes("--help") && !expoArgs.includes("-h")) {
    if (process.platform !== "darwin") {
      throw new Error(
        "The default iOS workflow requires macOS and Xcode. Use the android or web script on other platforms.",
      )
    }
    // Read the simulator inventory without booting or changing any device.
    const { devices } = JSON.parse(
      execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], {
        encoding: "utf8",
      }),
    )
    const simulator = selectSimulator(devices)
    if (!simulator) {
      throw new Error(
        "No available iPhone simulator running iOS 27. Install the iOS 27 runtime and create an iPhone simulator in Xcode, or explicitly pass --device.",
      )
    }
    console.log(`Using ${simulator.name} on iOS 27 (${simulator.udid}).`)
    expoArgs.push("--device", simulator.udid)
  }

  const command = ["run:ios", ...expoArgs]
  if (dryRun) {
    console.log(`expo ${command.join(" ")}`)
    return
  }
  const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), ...command], {
    cwd: appRoot,
    stdio: "inherit",
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
