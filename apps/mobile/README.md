# Beside mobile

Ignite/React Native app for Beside, generated with [Ignite CLI](https://docs.infinite.red/ignite-cli/) 11.5.0.

From the repository root:

```sh
pnpm install
pnpm dev --filter=mobile
```

## Skia pixel-world PoC

On the `pixel-world-skia-poc` branch, a fresh launch opens **A little beside**.
Existing navigation state may restore another screen; use **Explore pixel world**
on Login or Welcome, or open `beside://world`. No sign-in is needed.

```sh
# Rebuild the dev client once, because Skia adds native code.
pnpm --filter mobile ios
# Or, with an Android device/emulator:
pnpm --filter mobile android
```

After that first build, `pnpm --filter mobile start` starts Metro for the installed
development client. An older development client will need rebuilding.

- Drag the meadow to pan, and use **Recenter** to return to the starting view.
- Tap a catalogue item, or either friend on the picnic blanket, to read about it.
- Tap **Decorate**, choose any of the eight rewards, and tap an empty patch of lawn.
  The translucent sprite is a preview; **Place here** confirms it and **Cancel**
  discards it. The path, pond, shore, dock, blanket, occupied spots, and the
  woodland border reject placement.
- **Reset scene** restores the original arrangement. **Photo** hides the header
  and tray for a device/simulator screenshot; **Show controls** brings them back.

Everything in the world is drawn by `@shopify/react-native-skia` (Expo SDK 55's
compatible version, 2.4.18) as bitmaps at one texel per world pixel, scaled by an
integer factor with nearest-neighbour sampling, so pixels stay crisp:

- `terrain.ts` paints the 288 × 240 meadow once at runtime (lawn, woodland
  border, winding path, pond with dock, picnic blanket) and records a ground kind
  per pixel. Placement rules read that map, so they always match the art. A
  periodic tile of the same canopy surrounds the world, so tall screens and photo
  mode never show a bare edge.
- `avatars.ts` holds the two hand-drawn 16 × 20 friends, with blink and breathing
  frames. A slow stepped clock (paused under Reduce Motion) drives them and the
  pond glints; the canvas only redraws when a frame changes.
- Reward sprites come straight from `@beside/rewards`. Their shadows are sized
  from each sprite's footprint.

Gesture Handler and Reanimated pan the camera on the UI thread. Ordinary React
Native views provide the text and placement tray. There are no downloaded art
assets, backend calls, purchases, or persistence; the initial arrangement and
memories are mock data. This is a visual/interaction spike, not a world engine or
a performance benchmark.

For the web version:

```sh
pnpm --filter mobile web
# Open http://localhost:8081/world (or the port Expo prints).
```

The web script copies CanvasKit to `public/canvaskit.wasm`, then the web entry
loads it before importing the app. `postinstall` also generates this ignored
file. If invoking Expo directly instead of the web script, run
`pnpm --filter mobile run postinstall` first. Native entry remains synchronous.

Validation commands:

```sh
pnpm --filter mobile check-types
pnpm --filter mobile lint:check
pnpm --filter mobile test --runInBand
pnpm --filter mobile exec expo export --platform all --output-dir /tmp/beside-pixel-world-export
```

The interaction tests cover picking the frontmost sprite, generous hit targets,
selecting either friend, placement snapping, rejection of occupied land, water,
path, blanket, dock, and the map edge, and that every sprite's base lines up with
its shadow. Type checking, lint, and all 26 tests pass. The reworked art was
exercised on an iPhone 16 Pro simulator running iOS 18.3: catalogue and friend
selection, previewing and confirming a placement, panning, and photo mode. The
iOS/Android/web exports and the web flow were checked before the art rework and
have not been re-run since. Android runtime behavior has not been checked.

## Reward items

Open **Preview reward items** on Login, or **Explore reward items** on Welcome.
The dedicated screen also supports the `beside://rewards` deep link. It works
without signing in to the demo.

Browse the same eight items as the playground, filter by category, and select an
item. **Try placing** opens a nine-plot world preview. Tap plots to place or
replace items, use **Remove items** to erase individual placements, or **Clear
patch** to start over. **Change item** returns to the collection while preserving
the patch. Leaving the screen resets the preview. Earning rewards and saved worlds
are not implemented.

The catalog, entity types, and original 32 × 32 pixel data live in
`packages/rewards` (`@beside/rewards`), shared with the playground. `RewardSprite`
renders contiguous pixel runs as native views at integer scales, with no remote
artwork or additional native library. The screen uses the app's light/dark theme,
safe areas, scrollable categories, accessible selection states, and a persistent
selection bar.

For a local mobile-sized browser preview:

```sh
pnpm --filter mobile exec expo start --web --port 8081
```

Open **http://localhost:8081/rewards** and use a phone-sized viewport. This uses the
React Native screen through React Native Web; it is not a simulator.

Validation commands from the repository root:

```sh
pnpm --filter mobile check-types
pnpm --filter mobile lint:check
pnpm --filter mobile test --runInBand
pnpm --filter @beside/rewards check-types
pnpm --filter mobile exec expo export --platform all --output-dir /tmp/beside-mobile-rewards-export
```

The reward screen was checked in Expo web at 320px and 390px, including category
filtering, selection, repeated placement, removal, clearing, navigation, and dark
mode. iOS, Android, and web exports passed. Native runtime testing still needs a
device or simulator.

This is the boilerplate that [Infinite Red](https://infinite.red) uses as a way to test bleeding-edge changes to our React Native stack.

- [Quick start documentation](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/Boilerplate.md)
- [Full documentation](https://github.com/infinitered/ignite/blob/master/docs/README.md)

## Getting Started

```bash
pnpm install
pnpm run start
```

To make things work on your local simulator, or on your phone, you need first to [run `eas build`](https://github.com/infinitered/ignite/blob/master/docs/expo/EAS.md). We have many shortcuts on `package.json` to make it easier:

```bash
pnpm run build:ios:sim # build for ios simulator
pnpm run build:ios:device # build for ios device
pnpm run build:ios:prod # build for ios device
```

### `./assets`

This directory is designed to organize and store various assets, making it easy for you to manage and use them in your application. The assets are further categorized into subdirectories, including `icons` and `images`:

```tree
assets
├── icons
└── images
```

**icons**
This is where your icon assets will live. These icons can be used for buttons, navigation elements, or any other UI components. The recommended format for icons is PNG, but other formats can be used as well.

Ignite comes with a built-in `Icon` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/app/components/Icon.md).

**images**
This is where your images will live, such as background images, logos, or any other graphics. You can use various formats such as PNG, JPEG, or GIF for your images.

Another valuable built-in component within Ignite is the `AutoImage` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/Components-AutoImage.md).

How to use your `icon` or `image` assets:

```typescript
import { Image } from 'react-native';

const MyComponent = () => {
  return (
    <Image source={require('assets/images/my_image.png')} />
  );
};
```

## Running Maestro end-to-end tests

Follow our [Maestro Setup](https://ignitecookbook.com/docs/recipes/MaestroSetup) recipe.

## Next Steps

### Ignite Cookbook

[Ignite Cookbook](https://ignitecookbook.com/) is an easy way for developers to browse and share code snippets (or “recipes”) that actually work.

### Upgrade Ignite boilerplate

Read our [Upgrade Guide](https://ignitecookbook.com/docs/recipes/UpdatingIgnite) to learn how to upgrade your Ignite project.

## Community

⭐️ Help us out by [starring on GitHub](https://github.com/infinitered/ignite), filing bug reports in [issues](https://github.com/infinitered/ignite/issues) or [ask questions](https://github.com/infinitered/ignite/discussions).

💬 Join us on [Slack](https://join.slack.com/t/infiniteredcommunity/shared_invite/zt-1f137np4h-zPTq_CbaRFUOR_glUFs2UA) to discuss.

📰 Make our Editor-in-chief happy by [reading the React Native Newsletter](https://reactnativenewsletter.com/).
