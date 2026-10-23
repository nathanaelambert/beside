# Beside

A pnpm/Turborepo workspace for Beside.

See [the project documentation](docs/README.md) for the working concept, original brainstorming notes, interaction storyboard, and mobile UI concept.

New to the project? Start with the [contributing guide](CONTRIBUTING.md) for local setup, development workflows, and pull request checks.

## Apps and packages

- `apps/website` (`beside-showcase`): the original Vite/React showcase website, with its six interactive chapters, pixel-art world, and project notes.
- `apps/mobile` (`mobile`): the Ignite/React Native app.
- `apps/playground` (`playground`): the Next.js model workbench with local persistence and Mermaid ERDs.
- `packages/rewards`: reward catalog types and pixel art shared by mobile and playground.
- `packages/eslint-config`: shared ESLint configuration.
- `packages/typescript-config`: shared TypeScript configuration.

## Getting started

Use Node.js 24 or newer and the pnpm version specified in `package.json`.

```sh
pnpm install
pnpm dev --filter=beside-showcase
pnpm dev --filter=mobile
pnpm dev --filter=playground
```

The website runs at `http://127.0.0.1:5173`. See [the website README](apps/website/README.md) for its controls and demos. See [the mobile README](apps/mobile/README.md) for Ignite, simulators, and workspace scripts.

Playground runs at `http://localhost:3002`. See [its README](apps/playground/README.md) for experiments, ownership assumptions, trigger simulations, and import/export.

## Build

```sh
pnpm build --filter=beside-showcase
pnpm --filter beside-showcase preview
```

The website's production output is `apps/website/dist`. Run `pnpm build`, `pnpm lint`, or `pnpm check-types` to execute the corresponding available scripts across the workspace.

The website retains its original JavaScript source and Vite scripts; it does not currently define lint or type-check tasks.
