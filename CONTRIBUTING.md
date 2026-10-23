# Contributing to Beside

Welcome to Beside! This guide covers local setup, where to make changes, and how
to prepare them for review. Run commands from the repository root unless noted.

## Start with the product

Read the [working concept brief](docs/product/concept-brief.md), then use the
[documentation index](docs/README.md) to explore architecture and design. Beside
is still a concept in development: playground behavior and showcase demos are
experiments, and do not automatically establish product requirements.

For model changes, compare the [entity draft](docs/architecture/entities.md) with
the [implemented playground model](docs/architecture/playground-model.md). Raise
unclear product decisions with the team before turning them into implementation
assumptions.

## Set up your checkout

You need Git, **Node.js 24 or newer**, and **pnpm 11.25.0**, as declared in the
root [package.json](package.json). Use pnpm for workspace dependencies.

```sh
# If pnpm is not already installed at the required version:
npm install --global pnpm@11.25.0

git clone https://github.com/nathanaelambert/beside.git
cd beside
node --version
pnpm --version
pnpm install
```

If you already have a checkout, start with the version checks and `pnpm install`.
Install dependencies at the root; internal `@beside/*` packages are linked through
the workspace. Commit `pnpm-lock.yaml` when dependency changes update it.

## Find your way around

- [`apps/website`](apps/website/README.md) (`beside-showcase`): the Vite/React
  showcase, with interactive chapters and local demos. Its source uses JavaScript.
- [`apps/mobile`](apps/mobile/README.md) (`mobile`): the Ignite/Expo React Native app.
- [`apps/playground`](apps/playground/README.md) (`playground`): the Next.js model
  workbench. Demo identities simulate perspective; they are not authentication.
  Experiment data is stored locally in the browser. Use its export feature before
  resetting data or testing imports.
- [`packages/rewards`](packages/rewards/README.md) (`@beside/rewards`): catalog types
  and pixel art shared by mobile and playground; it exports TypeScript source
  directly and has no build step.
- [`packages/eslint-config`](packages/eslint-config) and
  [`packages/typescript-config`](packages/typescript-config): shared tooling.

## Run the app you need

Choose one command for your work; run additional apps in separate terminals.

```sh
# Showcase: http://127.0.0.1:5173
pnpm dev --filter=beside-showcase

# Model playground: http://localhost:3002
pnpm dev --filter=playground

# Mobile: starts Expo for a development client
pnpm dev --filter=mobile
```

Native mobile development needs the appropriate platform tooling: Xcode and an
iOS simulator on macOS, or Android Studio and an emulator/device for Android.
Build and install a development client before connecting to the Expo server; see
the [mobile README](apps/mobile/README.md) for build instructions.

For a browser preview of the mobile reward screen:

```sh
pnpm --filter mobile exec expo start --web --port 8081
```

Open `http://localhost:8081/rewards`. Browser checks do not replace testing on a
native device or simulator when changing native behavior.

### Optional playground AI filling

The ordinary playground works without AI credentials. To work on AI filling, copy
the app-specific example:

```sh
cp apps/playground/.env.example apps/playground/.env.local
```

Privately configure `OPENROUTER_API_KEY` and set `AI_FILL_ENABLED=true`, then restart
the playground. See its [server setup](apps/playground/README.md#server-setup) for
configuration and usage limits. Keep keys server-only and out of source control;
do not add `NEXT_PUBLIC_` prefixes. Leave AI disabled when you do not need it.

## Make a focused change

1. Start a branch from an up-to-date `main`, for example:

   ```sh
   git switch main
   git pull --ff-only
   git switch -c feat/describe-your-change
   ```

2. Follow the patterns and configuration of the app or package you are editing.
   Web apps share ESLint/TypeScript configuration; mobile has its own ESLint and
   Prettier settings. Read applicable `AGENTS.md` instructions when using coding
   agents.
3. Keep the change focused. Add or update tests for behavior changes, and update
   nearby documentation when commands, workflows, or model decisions change.
4. Add dependencies to the workspace that uses them, for example
   `pnpm --filter playground add <package>`. Use `workspace:*` for internal package
   dependencies. Avoid unrelated upgrades or repository-wide formatting changes.

Format only the files you changed, for example:

```sh
pnpm exec prettier --write CONTRIBUTING.md
```

The root `pnpm format` command rewrites matching files across the repository.

## Check your changes

Run checks for the affected app/package. These commands match the current scripts.

```sh
# Playground
pnpm --filter playground lint
pnpm --filter playground check-types
pnpm --filter playground test
pnpm build --filter=playground

# Mobile
pnpm --filter mobile lint:check
pnpm --filter mobile check-types
pnpm --filter mobile test --runInBand

# Shared rewards: also check mobile and playground when changing their shared API
pnpm --filter @beside/rewards check-types

# Showcase
pnpm build --filter=beside-showcase
pnpm --filter beside-showcase preview
```

For changes spanning several workspaces, `pnpm lint`, `pnpm check-types`, and
`pnpm build` run the available tasks through Turborepo. There is no root `test`
script; run the app tests above explicitly. The showcase has no lint, type-check,
or test scripts, and mobile has no generic `build` script. A root build therefore
does not validate the native app.

For UI changes, manually exercise the affected flow at relevant viewport sizes
and on the affected platforms. For documentation-only changes, check formatting,
relative links, and commands against the package scripts.

## Open a pull request

Before requesting review:

- Review `git diff` and `git status`; include only files related to your change.
- Use a descriptive commit message and open a pull request against `main`.
- Explain the problem, resulting behavior, and any product assumptions. Link the
  relevant issue or discussion when one exists.
- List the checks you ran and their results. State any checks you could not run
  and why; include screenshots or a recording for visible UI changes.
- Call out model, storage, or import/export compatibility changes so reviewers can
  assess existing experiments and data.

For a first contribution, a small documentation fix, focused bug fix, or test
improvement is a useful way to learn one part of the project. If you get stuck,
share the command, app/package, Node/pnpm versions, and relevant error output with
the team, with credentials removed.
