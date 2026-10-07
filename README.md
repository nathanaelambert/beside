# Beside

A pnpm/Turborepo workspace for Beside.

## Apps and packages

- `apps/website` (`beside-showcase`): the original Vite/React showcase website, with its six interactive chapters, pixel-art world, and project notes.
- `apps/docs` (`docs`): the Next.js documentation starter.
- `packages/ui`: shared React components.
- `packages/eslint-config`: shared ESLint configuration.
- `packages/typescript-config`: shared TypeScript configuration.

## Getting started

Use Node.js 24 or newer and the pnpm version specified in `package.json`.

```sh
pnpm install
pnpm dev --filter=beside-showcase
```

The website runs at `http://127.0.0.1:5173`. See [the website README](apps/website/README.md) for its controls and demos.

## Build

```sh
pnpm build --filter=beside-showcase
pnpm --filter beside-showcase preview
```

The website's production output is `apps/website/dist`. Run `pnpm build`, `pnpm lint`, or `pnpm check-types` to execute the corresponding available scripts across the workspace.

The website retains its original JavaScript source and Vite scripts; it does not currently define lint or type-check tasks.
