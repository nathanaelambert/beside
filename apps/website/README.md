# beside — showcase site

The original Vite/React website, imported without changes to its source or assets.

A single pinned-viewport editorial introduction to beside, a project in development. Six chapters move one camera across a shared pixel-art world (`public/assets/shared-world.png`).

## Run

```bash
pnpm install                                      # from the repository root
pnpm --filter beside-showcase dev --port 5173       # http://127.0.0.1:5173
pnpm --filter beside-showcase build                 # production build in apps/website/dist/
pnpm --filter beside-showcase preview
```

## Controls

- **Wheel / trackpad**: one gesture moves one chapter (momentum is ignored until the gesture ends).
- **Keyboard**: arrow keys, PageUp/PageDown and Space move between chapters; Home and End jump to the first and last chapter.
- **Touch**: swipe left or right anywhere, or up and down on the illustration.
- **Buttons**: the chapter navigation at the top, previous/next at the bottom left.
- **Motion**: "Reduce motion" in the header disables camera moves and looping animation. It starts off when the OS prefers reduced motion.
- **Project notes**: opens the contributor panel (Esc closes it). Page navigation pauses while it is open.

## Demos (all illustrative, kept only in the page)

- **One world**: the plans from the opening chat land in the garden as Reading, Moving and Cooking markers. Click one to zoom in and open a small preview; click it again, use the close button, or press Esc to close.
- **Notes**: "Log chapter 4" opens Noor's note; then choose one of three replies. Reset clears both.
- **Grow**: from an illustrative shared pool of 100 seeds, pick a tree (50), lantern (30) or flowers (20), then tap a glowing spot in the garden. Cancel or Esc backs out; "Remove last" undoes. Up to three spots.
- **Keepsakes**: the closing overview shows your decorations, a list of what your visit left behind, and the finished book's history (including your reply). The cover button opens and closes the history.

Demo state survives moving back and forth between chapters; Replay resets everything. Scrolling inside the preview, note, keepsake or notes panel never changes chapter.

## Files

- `src/main.jsx`: app shell, navigation, input handling
- `src/content.js`: chapter copy, palettes, camera positions
- `src/Copy.jsx`: left-hand editorial copy and chapter demos
- `src/Stage.jsx`: the illustration camera and per-chapter overlays
- `src/Notes.jsx`: project notes / contributor panel
- `src/style.css`: all styling
