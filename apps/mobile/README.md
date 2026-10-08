# Beside mobile

Expo/React Native app for Beside. It uses [Expo Router](https://docs.expo.dev/router/introduction) with file-based routes in `src/app/`.

## Get started

From the repository root:

```sh
pnpm install
pnpm dev --filter=mobile
```

Then open the app in [Expo Go](https://expo.dev/go), an [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), an [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), or a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

You can also start a specific platform:

```sh
pnpm --filter mobile ios
pnpm --filter mobile android
pnpm --filter mobile web
```

Edit screens in `src/app/`. Native `ios/` and `android/` folders are generated on demand; configure native behavior in `app.json` rather than editing those folders by hand.

## Workspace scripts

- `pnpm dev --filter=mobile` — start the Expo bundler
- `pnpm lint --filter=mobile` — lint
- `pnpm check-types --filter=mobile` — type-check

## Fresh start

When you are ready to replace the template screens:

```sh
pnpm --filter mobile reset-project
```
