# The Problem Setter's Journal

A static home page for *The Problem Setter's Journal*.

The repository also contains a browser-only reading edition. It renders shuffled
image fragments into a canvas rather than publishing a full-book PDF.

## Local preview

Open `index.html` in a browser, or from PowerShell run:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Build the browser reading edition

The full source PDF must stay outside this public repository. To generate the
public reader assets from a private source PDF, install Poppler and Pillow, then
run:

```powershell
python scripts/build_reader_assets.py "C:\path\to\benson_problem_setting_journal_b5.pdf"
```

This writes shuffled WebP atlas files and a compact coordinate map to
`assets/book/`. The public viewer in `reader.html` loads only the atlases needed
for the page being read. It is a copying deterrent, not DRM: a determined person
can still inspect the public reader code and browser requests.

## Interactive exercises

Use the **Explore** badge in the reader to open a movable, resizable exercise.
Mechanical Grid is available on displayed pages 36–39, with the two book
examples, shuffled grids, animated rectangle rotations, exact-target and
book-sorting goals, undo, and reset. Introvert Seating is available on page 78,
including the eight-seat exercise and configurable small examples.

Additional task widgets let readers explore ambiguous base-11 numbers
(page 16), step through Cargo Sorting (page 47), and follow locker
cycles in Prisoners’ Gamble (pages 89–91). They run entirely in the browser;
no account, external service, or extra deployment step is needed.

Arctic Technology has an interactive robot exploration on pages 18–19, and
Repetitive Journey has an editable tiled-path explorer on pages 23–27.
The supplied robot, flag, and destroyed-cell illustrations are in
`assets/widgets/`.

Digit Puzzle (pages 28–30 and 32–33) visualizes the full constructive solution:
compact repeated-term groups, animated jumps on a powers-of-nine scale, and
exact digit assignments. It includes the book example, a 104-slot puzzle,
a powers-of-nine example, an impossible case, and a grouped puzzle builder:
positive and negative sides can each contain any mix of 1–6-factor terms.
Run `node scripts/check_digit_puzzle.cjs` for the solver checks and
`node scripts/check_digit_browser.cjs` for its browser checks (requires Playwright
and the local preview). Browser screenshots are written under ignored `tmp/`.

Lift Problem (pages 43–45) is a vertical elevator simulator with manual rides,
animated pickup/travel/reparking, a target column, and ride history. It includes
the three book examples, an eight-lift shuffle, custom challenges, and both
the 3N placement and 4N swapping constructions. Use Explore for your own rides
or Watch solution for animated playback and single-ride stepping.
Run `node scripts/check_lift_model.cjs` for exhaustive small-building checks and
`node scripts/check_lift_browser.cjs` for desktop/mobile integration checks
(requires Playwright and the local preview; screenshots go to ignored `tmp/`).

Faultline of the Earthquake has one four-part exploration lab on page 58:
draw, shorten and smoothly rotate routes; test your own paths against a sensor's
reading; discover the hexagon's corner observation using generated valid paths
and optional corner highlighting; then step through top-to-bottom corner DP.
The DP includes solvable and conflicting examples, editable grid/sensor data,
and a selectable reachability trace. Run `node scripts/check_faultline_model.cjs`
for geometry and brute-force DP checks and `node scripts/check_faultline_browser.cjs`
for desktop/mobile interaction checks (requires Playwright and the local preview).

Piston has an exploration widget on page 62. Its Simulation tab animates permanent
south-facing and temporary east-facing pistons, with editable examples. The
optional Solution tab pairs the physical grid with its boolean array, showing
the permanent scan or temporary DFS stack before moving the group. Play, pause,
step and speed controls support inspecting the algorithm. Run
`node scripts/check_piston_model.cjs` and `node scripts/check_piston_browser.cjs`
for model and desktop/mobile checks.

Challenge of Hanoi has a widget on page 72. Arrange disks by dragging or enter
the rods as text, then select a recursion-tree node or starting command. The
second tab builds a segment tree from command visibility, displaying symbolic
disk rearrangements and size constraints within its nodes and in a detailed
before/after view. Both tabs apply valid subtrees and descend into failed ones;
rod state persists between executions. Examples reproduce the book's five
operations and its net-effect abstraction. The visualizer supports N=1–5 and
up to nine distinct disks. Run `node scripts/check_hanoi_model.cjs` and
`node scripts/check_hanoi_browser.cjs` for independent model and browser checks.

Widgets register with `window.JournalWidgets` and provide `id`, `title`,
`pages` (the zero-based source-PDF chapter scope), `badge` (the one deliberate
`{ page, y, offsetY? }` Explore anchor), and `mount(container)`, which returns
a cleanup function. The shared host owns
the modal, keyboard isolation, resizing, and page badges. Optional `offsetY`
adds a screen-space offset to avoid another badge. Displayed page numbers
are two less than physical PDF page numbers.

Run the Mechanical Grid rule checks with `node scripts/check_mechanical_grid.cjs`.
The new widget rule checks are `scripts/check_undecimal.cjs`,
`scripts/check_cargo.cjs`, and `scripts/check_prisoners.cjs` (also run with Node).
With Playwright available and the preview running on port 8765, run
`node scripts/check_widgets_browser.cjs` for desktop and phone integration
checks. `READER_URL` and `BROWSER_CHANNEL` can override the preview URL and
browser channel (Microsoft Edge by default).
Run `node scripts/check_widget_badges.cjs` to verify that every chapter has
one gutter-aligned Explore anchor and that spoiler-prone widgets are absent
before their designated later page.
