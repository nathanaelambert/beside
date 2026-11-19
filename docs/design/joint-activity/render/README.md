# Local renderer (headless)

Renders the isometric island from `exp/isometric-world` (#19) to PNG without the app, using the branch's own
`iso-world` painting code. Discussion tooling only; nothing here is imported by the app.

```bash
git worktree add ../iso-src origin/exp/isometric-world      # the code being rendered
cd docs/design/joint-activity/render && mkdir -p out
export ISO_ROOT=$(realpath ../../../../../iso-src)            # path to that worktree
node --experimental-strip-types --no-warnings --import ./register.mjs render.ts            # issue 19 as designed
node --experimental-strip-types --no-warnings --import ./register.mjs render.ts toronto    # or kyoto, winter
node --experimental-strip-types --no-warnings --import ./register.mjs split.ts islet       # or zone
python3 to-png.py default toronto split-islet                # needs Pillow
```

- `loader.mjs` maps the `@beside/*` aliases and extensionless imports onto `ISO_ROOT` (Node 22+).
- `themes/*.ts` override `paint.palette`, recolour sprites and add landmark props; `helpers.ts` has the sprite tools.
- `split.ts` draws the two joint-activity concepts (shared islet / fenced zone).
