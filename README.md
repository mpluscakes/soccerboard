# Soccer Whiteboard

A touch-first tactics board. Drag the ball (or the player who has it) and every
other player moves to where they should be, with a one-line reason a
6-year-old can understand: "you move here because…".

It is an installable, offline web app (PWA): one build runs on an Android
phone, a Fire tablet, an iPad and a laptop.

## Using it

| Action | Touch | Mouse |
| --- | --- | --- |
| Move the ball carrier | Drag the carrier | Drag the carrier |
| Move a loose ball | Drag the ball | Drag the ball |
| Pass | Double-tap a teammate (or tap the carrier, then a teammate) | Double-click (or click, click) |
| Kick to a spot | Double-tap the grass, or drag from the ball and let go | Same |
| Shoot | Kick at the goal mouth. Aim for a corner: the keeper covers the middle | Same |
| Put a player somewhere | Drag them (they are pinned there) | Drag |
| Player menu (You, pin, role, name) | Hold for half a second | Right-click |
| Zoom and pan | Pinch, two-finger drag | Wheel, space-drag or right-drag |
| Undo / redo | Toolbar | Ctrl+Z / Ctrl+Shift+Z |

A short tutorial explains these the first time the app opens. It can be skipped,
and "Don't show this again" is remembered on the device (in `localStorage`).
Settings → "Show the tutorial" brings it back.

On a phone the toolbar is one slim row: unpin all, reset and the settings gear.
Level, Explain, Auto / Hint, Pause, Undo / Redo and View are in the settings
sheet. A Play or Show me button appears in the row whenever the players are
frozen. Laptops and tablets keep the full toolbar.

A shot that gets past the keeper sets off fireworks, then the ball goes back to
the centre spot. The keeper stops anything within 1 m of them, other defenders
within 0.6 m, and defenders right next to the shooter are shot around.

- **Auto / Hint**: in Hint mode players stay put and only their ghost spots
  show, so a child can try first. **Show me** then moves everyone.
- **Pause** freezes the players while the ghosts keep updating.
- **Explain** filters whose reasons and ghosts are shown. The player marked
  **You** is always explained.
- **View** zooms to a half or a third, or lets you draw a box. "Keep play
  inside this view" confines players and their targets to that area (for a 2v1
  in a corner, say).
- **Setup** picks the pitch (4v4 to 11v11 or custom sizes), players per side
  (1 to 11 each), keepers, formations and which way Blue attacks.

The board saves itself on the device and comes back when the app is reopened.

## Running it

```bash
npm install
npm run dev        # dev server
npm test           # engine + model tests (Vitest)
npm run e2e        # touch and mouse flows (Playwright, builds first)
npm run build      # static site in dist/
```

`.github/workflows/ci.yml` runs the tests on every push and pull request, and
publishes `dist/` to GitHub Pages from `main`. One-time step: in the repository
settings set **Pages → Source** to **GitHub Actions**. HTTPS (which Pages
provides) is what makes "Add to Home Screen" install the app.

## How it is built

```
src/
  model/    types, pure reducer, pitch presets, formations, save migration
  engine/   computeTargets (pure): jobs/, terms/, levels/*.json, explain/
  store/    Zustand store, undo history, engine bridge (throttle + glide)
  board/    SVG pitch, tokens, ghosts, gestures, viewport maths
  ui/       toolbar, setup sheet, reason panel, player menu
  persist/  autosave to IndexedDB
  modes/    sandbox/ (v1), lesson/ (stub for phase 3)
tests/
  engine/   10 fixture boards + acceptance specs
  model/    reducer, setup, history, save round trip
  e2e/      Playwright, 390 x 844 touch viewport plus a laptop project
```

Two rules keep it extensible: nothing outside `model/` and `store/` changes
state, and `engine/` imports only from `model/`.

The engine gives each player a **job** (presser, supporter, marker…) and picks
the best spot for that job by scoring nearby points with weighted **terms**
(pass lane, spacing, goal-side…). Jobs and terms are registered in
`engine/registry.ts`; weights live in `engine/levels/level1.json` and
`level2.json`. Adding a principle means adding a file and a weight, not
touching the pipeline. All wording is in `engine/explain/templates.ts`.

## Where this differs from the build spec

These are deliberate; each was needed to make the board behave sensibly.

- **Pass distance is on at level 1** (the spec lists it from level 2). Without
  it the level 1 supporter stays "open" but does not follow the ball.
- **Tokens are drawn smaller than 44 px** (26 to 32 px, never below 1.6 m).
  The *hit area* is always at least 44 x 44 px. At 44 px a presser standing
  1.5 m from the carrier completely covers them.
- **Level 1 markers** line up side by side between the ball and our goal ("like
  a wall"), each in the slot on their own side, about a third of the way back
  to the goal. Dropping straight back made them queue up in a column, which
  also hid the attacker running forward. They are still always goal-side of
  the ball.
- **Level 1 keeps a simple shape**: the player without another job follows the
  play up the pitch instead of staying by their own goal, and the forward
  runner stays in passing range with an open lane rather than running as far
  as possible.
- **The ball's hit area is 68 px across** and wins over a player's wherever the
  two overlap in its favour, so it can be grabbed with a defender standing on
  it.
- **Level 2 markers** only pick up attackers level with or ahead of the ball;
  the rest keep shape. Otherwise defenders chase the other team's back line.
- **Jobs are sticky**: whoever had a job last tick counts as slightly closer,
  so two players at similar distances do not keep swapping jobs.
- **A pass follows its receiver**, who counts as the carrier while the ball is
  in flight, so the team reacts to the pass straight away.
- **A team of one has no keeper**, even with keepers on (so 2v1 works).
- **Dragging a loose ball moves it; dragging a held ball aims a kick.** The
  spec gives both gestures to "drag the ball".
- A `Reason` carries the job sentence and the term's detail line separately
  (`kid` + `kidDetail`), each 15 words or fewer.
- Extra actions beyond the spec's list: `BALL_ARRIVE`, `SET_ROLE`,
  `SET_LABEL`, `SET_ACTIVE_AREA`, `SET_VIEW`, `NEW_BOARD`.
- **Level 3** is in the selector, disabled, until phase 2.

## Acceptance criteria

Every criterion in the spec has an automated test named with its number,
except these:

- **19** (11v11 under 8 ms on a mid-range phone) and **25** (real devices) are
  manual. Setup → "Show engine timing" shows the time per run on the device.
  On the build machine 11v11 takes about 6 ms, and 2 ms on the coarse grid the
  engine falls back to when a run goes over budget.
- **23**: Lighthouse no longer has a PWA category, so the test checks the same
  things directly: manifest, icons, service worker, and that the app opens and
  works with the network off.
