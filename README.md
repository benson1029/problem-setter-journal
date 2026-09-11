# The Problem Setter's Journal

A static home page and browser reading edition for *The Problem Setter's
Journal*.

The reader rebuilds each book page from shuffled image fragments in a canvas.
This is a copying deterrent, not DRM: public client-side assets can still be
retrieved by a determined reader.

## Run locally

Open `index.html`, or serve the folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. The reading edition is at `reader.html`.

## Build reader assets

Keep the source book PDF private. With Poppler and Pillow installed, create the
public image assets with:

```powershell
python scripts/build_reader_assets.py "C:\path\to\benson_problem_setting_journal_b5.pdf"
```

This writes the shuffled atlases and coordinate data under `assets/book/`.

## Reader and widgets

Use the **Explore** badges in the reader for the interactive problem labs.
They run completely in the browser and support direct links such as
`reader.html?widget=faultline`. Reader URLs also accept `?page=72`,
`?page=cover`, and `?page=information`.

Widgets cover the journal's algorithms and games, including Mechanical Grid,
Arctic Technology, Repetitive Journey, Digit Puzzle, Lift Problem, Cargo
Sorting, Faultline, Piston, Challenge of Hanoi, Introvert Seating, Tree
Speculation, and Center of Infinity. Each widget is a small local module under
`widgets/`; register it through `window.JournalWidgets` with a title, page
scope, one Explore badge, and a cleanup-returning `mount` function.

Tree Speculation's Bob's Walk includes a basic five-node-chain lesson and an
extended mode with a hidden five-ID group and permuted chain IDs. Center of
Infinity includes reconstruction lessons plus a map-detective game. Their
direct entry points are `tree-speculation-chain`, `center-of-infinity`,
`infinity-reconstruction`, and `infinity-game`.

## Checks

Run individual model checks with `node scripts/check_<widget>.cjs`. With a
local preview running and Playwright installed, matching `*_browser.cjs` checks
cover desktop and phone interaction. The shared checks are:

```powershell
node scripts/check_widget_badges.cjs
node scripts/check_widgets_browser.cjs
```

`READER_URL` and `BROWSER_CHANNEL` override the preview URL and browser channel.
Browser screenshots and other scratch output stay in ignored `tmp/`.
