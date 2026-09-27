# Shape Kingdom (working title)

A strategy game where every resource is a shape. Build your castle, farm sticks, circles, triangles and squares, and assemble soldiers from the shapes themselves — a Spearman is literally a circle head, a five-stick body, a stick shaft and a triangle tip.

This is the **Stone Age demo**: a single-player home zone that runs entirely in the browser. Design: [docs/superpowers/specs/2026-09-27-shape-kingdom-demo-design.md](docs/superpowers/specs/2026-09-27-shape-kingdom-demo-design.md).

## Run it locally

```bash
npm install
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the game at http://localhost:5173 |
| `npm test` | Run the game-rule tests |
| `npm run build` | Type-check and build to `dist/` |

Every push to `main` runs the tests and publishes the game to GitHub Pages.

## Where things live

| Folder | Contents |
|---|---|
| `src/data/` | **Balance numbers** — costs, timers, farm output, soldier recipes, Crystal prices. Tweak the game here. |
| `src/logic/` | Game rules (no graphics). Will also run on the real server later. |
| `src/backend/` | Login and saving. Today: this browser only. Later: a real server. |
| `src/art/` | Buildings, farms and soldiers, drawn from shapes. |
| `src/render/` | The isometric 3D scene (Three.js). |
| `src/ui/` | Menus, panels, top bar. |
| `tests/` | Automated tests for the rules. |
