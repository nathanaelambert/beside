# Beside mobile

Ignite/React Native app for Beside, generated with [Ignite CLI](https://docs.infinite.red/ignite-cli/) 11.5.0.

From the repository root:

```sh
pnpm install
pnpm dev --filter=mobile
```

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
