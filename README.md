# AURAK University Navigator

**No-GPS, turn-by-turn wayfinding for the American University of Ras Al Khaimah campus.**
Built for AURAK's Student Government Association.

**Live:** [nav.ralmasri.tech](https://nav.ralmasri.tech)

GPS doesn't work reliably indoors or between closely-spaced buildings, and AURAK has no official campus app. This one needs neither a GPS fix nor a network request after the first load: pick a start and a destination from a real, hand-traced vector map of the campus, and it plans a walking route and narrates it as big, turn-by-turn arrows.

---

## Features

- **A real vector map, not a photo.** Every path, lawn, parking bay, and building footprint is traced from AURAK's official site plan into plain coordinates — crisp at any zoom, themeable, and small enough to ship as static JSON.
- **Tap-to-route.** Tap any two buildings (or search by name, building code, or legend number) and get a walking route drawn straight onto the map.
- **Guide View.** A full-screen, one-instruction-per-screen turn-by-turn mode: a giant directional arrow, plain-language instructions ("Turn right at the Central Plaza · about 20 m"), and a full-route overview map that stays oriented to where you are in the trip — built for glancing at while walking, not reading.
- **Fuzzy search.** Find a place by its name, alias, building letter ("H"), or legend number ("5") — typo-tolerant, powered by Fuse.js.
- **Runs entirely in the browser.** No backend, no accounts, no location permission. Routing (A\*) runs client-side over a plain JSON campus graph.
- **Mobile-first.** Designed for one-handed use while walking; the map auto-orients to make the most of a portrait phone screen.

## Tech stack

| | |
|---|---|
| Framework | React 19 + TypeScript (strict) + Vite |
| Styling | Tailwind CSS v4, CSS custom-property design tokens (light/dark) |
| Animation | [Motion](https://motion.dev) |
| Map | Hand-rolled SVG renderer — no tile/GIS engine, everything is planar metres |
| Camera | Custom pan/zoom/rotate hook on top of `@use-gesture/react` |
| Search | Fuse.js |
| Data validation | Zod |
| Tests | Vitest + Testing Library |

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm test          # run the test suite
npm run build     # type-check + production build
npm run lint       # oxlint
```

## How the map is built

There's no map-tile provider for a single university campus, so the map is generated from data the project owns:

1. **`tools/campus-editor.html`** — a small standalone hand-tracing tool. It loads AURAK's official site plan as a background image and lets you trace building footprints, walkways, lawns, parking, and the routing graph (nodes + edges) directly on top of it with rectangle/polygon/polyline/point tools. It exports one JSON trace file.
2. **`scripts/import-editor-trace.ts`** — converts that trace into the app's data files (`src/campus-data/aurak/*.json`): buildings, places, the walkway graph, and the renderable map geometry. It resolves building labels fuzzily against the official building legend, derives each place's routing anchor from the nearest traced entrance/door, and validates everything with Zod before the app will boot on it.
3. The React app never touches the reference picture or the trace file — it only ever reads the generated JSON, so re-tracing part of the campus is just: edit in the browser tool, export, re-run the import script.

## Project structure

```
src/
  domain/       pure TypeScript — geometry, A* routing, instruction generation, search. No React.
  data/         CampusRepository — loads and Zod-validates the campus JSON bundle
  features/     home, map, guide (turn-by-turn), location-picker
  campus-data/  aurak/*.json — the generated campus (buildings, places, graph, map geometry)
scripts/        the editor-trace → campus-data import pipeline
tools/          campus-editor.html, the hand-tracing tool
docs/PLAN.md    full architecture & data-model spec
```

`domain/*` is framework-free and unit-tested in isolation; `features/*` is the React layer that renders its output. See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture writeup, data model, and routing design.

## Testing

```bash
npm test
```

Domain logic (A\*, turn classification, instruction phrasing, search, geometry) is covered with unit tests; a few golden-path route snapshots guard against regressions in the generated turn-by-turn instructions.

---

Built for AURAK's Student Government Association · Powered by SGA
