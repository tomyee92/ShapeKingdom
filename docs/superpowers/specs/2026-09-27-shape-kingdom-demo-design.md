# Shape Kingdom — Demo (Stage 1) Design

Date: 2026-09-27
Status: Draft for review
Working title: "Shape Kingdom" (temporary)

## 1. Vision

A persistent online strategy game in the spirit of 方便面三国 / Travian / Clash of Clans. A huge top-down grid world map; each player owns castles in zones. Instead of wood/iron/gold, every resource is a **shape or symbol**. Soldiers and buildings are literally assembled from shapes (a spearman = circle head + stick body + stick shaft + triangle tip), so all unit art is generated from its recipe.

Players progress through eras from Stone Age to Modern. Early eras are **flat 2D** ("Flatland"); later eras gain depth until the Modern era is fully **3D** (circle → sphere, square → cube, triangle → pyramid).

Monetisation (later): sell the premium currency **Crystal ◆**. The demo includes the currency and a fake shop.

## 2. Demo scope (this spec)

A single-player web demo hosted on GitHub Pages to test whether the home-zone loop is fun.

**In scope**
- Local login (name + optional PIN), several accounts per browser.
- One castle in one zone, isometric view, Stone Age only (Castle max level 5).
- 8 farm slots with the fixed newbie pattern; buildings inside the castle area.
- Build/upgrade with timers, builder concurrency, Crystal instant-finish.
- Barracks training four Stone Age soldiers drawn from their recipes.
- Food upkeep with negative food/hour and starvation.
- Shape Exchange (basic → ⬟ Pentagon) and lucky ⬟ drops from farms.
- Fake Crystal shop, dev speed setting, offline progress.
- Automated deploy to GitHub Pages from a public GitHub repo.

**Out of scope (shown as locked / not built)**
- World map, other players, multiple castles, carts/transfers, combat, monsters, market, guilds, later eras, real payments, real server.

The save format and backend layer are designed so these can be added without rewrites (see §8, §9).

## 3. Resources

| Kind | Items | Scope | Source in demo |
|---|---|---|---|
| Basic | │ Stick, ● Circle, ▲ Triangle, ■ Square | Per castle | Farms |
| Food | 🍞 Food | Per castle | Food farms |
| Money | $ Gold | Per castle | Houses |
| Rare | ⬟ Pentagon (Stone Age rare) | Per castle | Shape Exchange, lucky drop |
| Premium | ◆ Crystal | Per account | Starting gift, fake shop |

- Each castle has storage caps: basic shapes and $ capped by **Storage**, food capped by **Granary**. Production stops at the cap (no overflow). ⬟ and ◆ are uncapped.
- Crystals cannot buy rare symbols. Rare symbols (later) come only from hunting, the player market, the Exchange, or lucky drops.

**Starting state (new account):** 300 of each basic shape, 300 🍞, 100 $, 0 ⬟, 500 ◆, Castle level 1, all 8 farms at level 1, no other buildings, no soldiers.

## 4. Zone and farms

- A zone has **8 fixed farm slots**. The farm type in each slot is set by the zone's **pattern**; players cannot change it, only upgrade it.
- **Newbie pattern (first castle, always):** 2 │, 2 ●, 1 ▲, 1 ■, 2 🍞.
- Future castles use random patterns (e.g. "Circle-rich" 1│ 4● 1▲ 0■ 2🍞, "Breadbasket" 1│ 1● 1▲ 1■ 4🍞, "Triangle mine" 1│ 1● 3▲ 1■ 2🍞). Patterns live in a data file; the demo only uses the newbie pattern.

**Farm output per hour, by level**

| Lv | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| /h | 15 | 25 | 40 | 60 | 85 | 120 | 165 | 225 | 300 | 400 |

**Lucky drop:** for every full game-hour of production, each shape farm (not food) has a 1% chance to add 1 ⬟. Uses the save's seeded random generator so results are reproducible.

## 5. Buildings

### 5.1 Builders
Concurrent builds are limited by Castle level (no builder buildings, no paid extra builders):

| Castle Lv | 1–2 | 3–4 | 5+ |
|---|---|---|---|
| Builders | 1 | 2 | 3 |

Farm upgrades also use a builder.

### 5.2 Level caps
- Castle max level in demo: **5**.
- Every other building and farm: max level = **Castle level × 2** (so up to 10 in the demo).

### 5.3 Build timers (time to reach level L)

| Lv | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Time | 5s | 30s | 2m | 10m | 1h | 4h | 12h | 1d | 3d | 7d |

Castle takes 1.5× the listed time. (Farms start at level 1, so their first upgrade is to level 2.)

### 5.4 Upgrade cost
`cost(L) = round(baseCost × 1.8^(L−1))` per resource, where L is the level being built. Base costs:

| Building | │ | ● | ▲ | ■ | 🍞 | $ | Unlock (Castle Lv) | Max count |
|---|---|---|---|---|---|---|---|---|
| Castle (upgrade to 2) | 150 | 150 | 100 | 50 | 50 | 50 | — | 1 |
| Farm (any type) | 40 | 40 | 20 | 10 | 10 | 0 | — | 8 slots |
| House | 50 | 40 | 10 | 0 | 0 | 0 | 1 | 4 |
| Storage | 60 | 40 | 20 | 20 | 0 | 0 | 1 | 1 |
| Granary | 60 | 40 | 20 | 0 | 0 | 0 | 1 | 1 |
| Barracks | 80 | 60 | 40 | 0 | 20 | 20 | 2 | 1 |
| Watchtower | 60 | 40 | 60 | 40 | 0 | 20 | 3 | 1 |
| Shape Exchange | 80 | 80 | 40 | 40 | 0 | 50 | 3 | 1 |
| Shape Lab | 100 | 100 | 80 | 60 | 0 | 80 | 4 | 1 |
| Guild Hall, World Gate | locked ("Coming soon") | | | | | | — | — |

Castle and farms start at level 1, so their first purchase is level 2: for them, `cost(L) = round(baseCost × 1.8^(L−2))`. The Castle row above is its level-2 cost; the Farm row is a farm's level-2 cost.

### 5.5 Building effects

| Building | Effect |
|---|---|
| Castle | Sets builders (§5.1) and level caps (§5.2). |
| House | Gold $ per hour: 5, 10, 18, 28, 40, 55, 75, 100, 130, 170 (Lv 1–10). |
| Storage | Cap for each basic shape and $: 1500, 2500, 4000, 6000, 9000, 13000, 18000, 25000, 35000, 50000. Without Storage: 1000. |
| Granary | Food cap: same table as Storage. Without Granary: 1000. |
| Barracks | Trains soldiers. Lv 1 Clubman, Lv 2 Slinger, Lv 3 Spearman, Lv 4 Shield Bearer. One training queue. |
| Watchtower | Shows a Defense value (Lv × 10). No gameplay effect until combat exists. |
| Shape Exchange | Trade 25 │ + 25 ● + 25 ▲ + 25 ■ → 1 ⬟. Instant. |
| Shape Lab | +5% production for all farms per level. |

## 6. Soldiers

Recipe = cost = drawing. Soldiers belong to a castle.

| Soldier | Recipe (shapes consumed) | Extra | Train time | Food/h | Atk / Def / HP | Barracks Lv |
|---|---|---|---|---|---|---|
| Clubman | 1 ● + 6 │ | 2 $ | 10s | 1 | 5 / 3 / 20 | 1 |
| Slinger | 2 ● + 5 │ | 3 $ | 20s | 1 | 6 / 2 / 15 | 2 |
| Spearman | 1 ● + 6 │ + 1 ▲ | 4 $ | 30s | 1 | 9 / 4 / 22 | 3 |
| Shield Bearer | 1 ● + 5 │ + 1 ■ | 5 $ | 45s | 2 | 3 / 10 / 35 | 4 |

(5 sticks form the body; the 6th stick is the club or spear shaft; the Slinger's second circle is its stone.) Stats are displayed only; no combat in the demo.

Training: pick unit + quantity; cost is paid up front; units come out one at a time. Crystal instant-finish applies to the whole remaining queue.

## 7. Food and starvation

- Net food/hour = food farm output − Σ soldier upkeep. Displayed in red when negative.
- Food stock never goes below 0.
- When food stock reaches **0** while net food/hour is **negative**, soldiers die **at random, one at a time, immediately**, until net food/hour ≥ 0. A warning banner shows whenever net food/hour is negative, with the time until food hits 0.
- Random choice uses the save's seeded random generator.

## 8. Crystals ◆

- **Instant finish** (buildings or training queue) priced by time remaining, interpolated linearly between points; ≤ 60 s remaining is free.

| Remaining | 1m | 10m | 1h | 4h | 12h | 1d | 3d | 7d |
|---|---|---|---|---|---|---|---|---|
| ◆ | 1 | 5 | 20 | 60 | 150 | 260 | 600 | 1000 |

  Above 7d: 1000 + 150 per extra day.
- **Buy missing resources:** 1 ◆ per 50 missing basic shapes/food/$ (rounded up), shown on the cost panel when short.
- **Fake shop:** packs of 100 / 500 / 1200 / 3000 ◆ with display prices; clicking "Buy" adds Crystals with a "Demo — no payment" note.

## 9. Time, offline progress, dev speed

- Game rules are a **pure logic module**: `advance(state, nowMs) → state`. No rendering, no browser APIs. This is what will later run on the server.
- `advance` is event-driven: it moves to the next event (build done, training unit done, a stock reaching cap, food reaching 0), applies it, and repeats until `now`. This makes offline progress exact.
- **Dev speed** (×1 / ×10 / ×100) is stored per account and scales all game time (production, timers, upkeep). Changing it re-anchors game time so nothing jumps. Default ×10 in the demo.
- Game-hours are measured in game time (so at ×100, lucky drops happen 100× as often in real time).

## 10. Login and save layer

A single `Backend` interface is the only code that knows where data lives:

```
listAccounts(), createAccount(name, pin?), logIn(name, pin?), logOut(),
loadSave(accountId), writeSave(accountId, save)
```

- **LocalBackend (demo):** stores accounts and saves in `localStorage`. PIN stored as salted SHA-256 hash (WebCrypto). Clearly labelled "demo login — saved in this browser only". Not real security.
- **ServerBackend (later):** e.g. Supabase auth + database; replaces LocalBackend without game changes.
- **Save format** is versioned (`version: 1`) and already shaped for the full game: `account { id, name, crystals, devSpeed, castles: [ { id, zonePatternId, resources, farms[8], buildings[], builds[], trainingQueue[], soldiers{} } ], rngSeed, lastUpdateMs }`.
- Autosave every 10 s and on page hide.

## 11. Screens

1. **Login** — create account (name + optional PIN) or choose an existing one.
2. **Home zone (isometric)** — Castle in centre, 12 building plots around it, 8 farm slots in an outer ring. Pan by drag, zoom by wheel/pinch. Tap empty plot → build menu; tap building/farm → info panel (level, effect, next-level cost, timer, Upgrade, "Finish now ◆N").
3. **Top bar** — each resource: amount / cap and rate per hour; ⬟; ◆; builders busy (e.g. 1/2). Food rate red when negative.
4. **Barracks panel** — unit cards with recipe drawing, stats, cost, quantity picker, training queue.
5. **Exchange panel**, **Shop**, **Settings** (dev speed, reset save, log out).
6. **World Map button** — locked "Coming soon".

Layout works on phone and desktop browsers.

## 12. Visual style

- Stone Age = **flat 2D**: buildings and farms are compositions of flat coloured shapes standing like paper cut-outs on an isometric tiled ground.
- Rendered with **Three.js** using an orthographic camera at an isometric angle (the world map later uses the same engine looking straight down).
- Soldiers are drawn procedurally from their recipe (SVG in panels).
- No AI-generated images needed for the demo; later AI art is limited to logo, UI frames, textures, and loading screens.

## 13. Architecture

- **Vite + TypeScript**, no UI framework (plain DOM for panels) to keep dependencies small.
- Modules:
  - `data/` — balance tables (buildings, farms, units, patterns, crystal prices). Edit numbers here only.
  - `logic/` — pure rules: `advance`, actions (`startBuild`, `finishNow`, `train`, `exchange`, `buyCrystals`…), each returning a new state or an error. Seeded RNG.
  - `backend/` — `Backend` interface + `LocalBackend`.
  - `render/` — Three.js isometric scene; reads state, emits taps.
  - `ui/` — HTML panels and top bar.
  - `main.ts` — wiring and game loop (advance each second, redraw).
- **Tests:** Vitest on `logic/` and `data/` (costs, timers, builder limits, level caps, offline advance, starvation, lucky drops, crystal pricing).

## 14. Deploy

- Public GitHub repo `ShapeKingdom`.
- GitHub Actions: on push to `main`, run tests, build, publish to GitHub Pages.

## 15. Success criteria

- A new player can log in, upgrade farms and buildings, train all four soldiers, hit negative food and see starvation, use the Exchange, and use Crystals — all on the public GitHub Pages URL, on phone and desktop.
- Closing the tab and returning later shows correct offline progress.
- All logic tests pass in CI.
