import { buildingPrims, farmItemPrims } from '../art/buildingArt';
import { iconSvg, primsToSvg } from '../art/svg';
import { unitPrims } from '../art/unitArt';
import {
  BASE_CAP,
  BUILDINGS,
  BUILD_MENU,
  CASTLE_MAX_LEVEL,
  EXCHANGE_EACH,
  FARM_INFO,
  HOUSE_GOLD,
  LAB_BONUS_PER_LEVEL,
  LOCKED_BUILDINGS,
  LUCKY_DROP_CHANCE,
  STORAGE_CAP,
  WATCHTOWER_DEF_PER_LEVEL,
  buildersForCastle,
  type BuildingType,
} from '../data/buildings';
import { DEV_SPEEDS, RES_PER_CRYSTAL, SHOP_PACKS } from '../data/economy';
import { BASIC } from '../data/resources';
import { MAX_TRAIN_QUEUE, UNITS, UNIT_TYPES } from '../data/units';
import { isCastleTarget, upgradeCost } from '../logic/actions';
import {
  buildTimeMs,
  buildingCost,
  buildingLevel,
  canAfford,
  castleLevel,
  farmOutput,
  levelCap,
  missingPrice,
  multiplyCost,
  overCap,
  rates,
} from '../logic/formulas';
import type { BuildTarget, Castle, GameState } from '../logic/state';
import { costChips, esc, fmtDuration, fmtNum, fmtRate } from './format';

export type Panel =
  | { kind: 'plot'; plot: number }
  | { kind: 'building'; id: string }
  | { kind: 'farm'; index: number }
  | { kind: 'shop' }
  | { kind: 'settings' }
  | { kind: 'army' }
  | { kind: 'log' };

export interface PanelView {
  title: string;
  html: string;
}

interface Ctx {
  accountName: string;
}

/** Everything here is time-independent; countdowns and prices are filled in by live updates. */
export function renderPanel(s: GameState, c: Castle, p: Panel, ctx: Ctx): PanelView | null {
  switch (p.kind) {
    case 'plot':
      return c.buildings.some((b) => b.plot === p.plot) ? null : buildMenu(s, c, p.plot);
    case 'building': {
      const b = c.buildings.find((x) => x.id === p.id);
      return b ? buildingPanel(s, c, b.id) : null;
    }
    case 'farm':
      return farmPanel(s, c, p.index);
    case 'shop':
      return shopPanel(s);
    case 'settings':
      return settingsPanel(s, ctx);
    case 'army':
      return armyPanel(c);
    case 'log':
      return logPanel(s);
  }
}

const gameTime = (s: GameState, ms: number) => fmtDuration(ms / s.devSpeed);

function buildMenu(s: GameState, c: Castle, plot: number): PanelView {
  const lvl = castleLevel(c);
  const items = BUILD_MENU.map((type) => {
    const def = BUILDINGS[type];
    const count = c.buildings.filter((b) => b.type === type).length;
    const cost = buildingCost(type, 1);
    let action: string;
    if (lvl < def.unlockCastle) action = `<span class="locked">Needs Castle Lv ${def.unlockCastle}</span>`;
    else if (count >= def.maxCount) action = `<span class="locked">Built ${count}/${def.maxCount}</span>`;
    else action = actionButtons(c, cost, `data-act="build" data-type="${type}" data-plot="${plot}"`, 'Build');
    return `
      <div class="card">
        <div class="card-art">${primsToSvg(buildingPrims(type, 1), 64)}</div>
        <div class="card-body">
          <div class="card-title">${def.name} ${def.maxCount > 1 ? `<small>${count}/${def.maxCount}</small>` : ''}</div>
          <div class="card-desc">${def.description}</div>
          <div class="chips">${costChips(cost, c)}<span class="chip time">⏱ ${gameTime(s, buildTimeMs(1, false))}</span></div>
          <div class="actions">${action}</div>
        </div>
      </div>`;
  }).join('');
  const locked = LOCKED_BUILDINGS.map(
    (n) => `<div class="card dim"><div class="card-body"><div class="card-title">${n}</div><div class="card-desc">Coming with the world map.</div><div class="actions"><span class="locked">Coming soon</span></div></div></div>`,
  ).join('');
  return { title: 'Build', html: `<div class="cards">${items}${locked}</div>` };
}

/** Primary action button plus, when short on resources, a "use crystals" button. */
function actionButtons(c: Castle, cost: ReturnType<typeof buildingCost>, attrs: string, label: string): string {
  const big = overCap(c, cost);
  if (big) return `<span class="locked">Needs bigger ${big === 'food' ? 'Granary' : 'Storage'}</span>`;
  if (canAfford(c, cost)) return `<button class="btn primary" ${attrs}>${label}</button>`;
  const price = missingPrice(c, cost);
  const buyAttrs = attrs.replace(/data-act="([^"]+)"/, 'data-act="$1" data-buy="1"');
  return `<button class="btn" disabled>${label}</button><button class="btn crystal" ${buyAttrs}>${iconSvg('crystal', 14)} ${price} for missing</button>`;
}

function jobBlock(jobId: string, startMs: number, endMs: number): string {
  return `
    <div class="job">
      <div class="bar big"><i data-start="${startMs}" data-end="${endMs}"></i></div>
      <div class="row">
        <span>Building… <b data-endms="${endMs}"></b></span>
        <button class="btn crystal" data-act="finish" data-job="${jobId}">Finish now <span data-finish-endms="${endMs}"></span></button>
      </div>
    </div>`;
}

function upgradeBlock(s: GameState, c: Castle, target: BuildTarget, level: number): string {
  const job = c.builds.find((j) =>
    target.kind === 'farm' ? j.target.kind === 'farm' && j.target.index === target.index : j.target.kind === 'building' && j.target.id === target.id,
  );
  if (job) return jobBlock(job.id, job.startMs, job.endMs);
  const isCastle = isCastleTarget(c, target);
  const cap = levelCap(c, isCastle);
  if (level >= cap) {
    return `<p class="muted">${isCastle ? `Castle Lv ${CASTLE_MAX_LEVEL} is the Stone Age max in this demo.` : `Max level for now. Upgrade the Castle to go past Lv ${cap}.`}</p>`;
  }
  const cost = upgradeCost(c, target);
  const ref = target.kind === 'farm' ? target.index : target.id;
  const busy = c.builds.length >= buildersForCastle(castleLevel(c));
  return `
    <div class="upgrade">
      <div class="label">Upgrade to Lv ${level + 1}</div>
      <div class="chips">${costChips(cost, c)}<span class="chip time">⏱ ${gameTime(s, buildTimeMs(level + 1, isCastle))}</span></div>
      <div class="actions">${actionButtons(c, cost, `data-act="upgrade" data-kind="${target.kind}" data-ref="${ref}"`, 'Upgrade')}</div>
      ${busy ? '<p class="muted small">All builders are busy — this will fail until one is free.</p>' : ''}
    </div>`;
}

function effectLines(type: BuildingType, level: number): string[] {
  const next = level + 1;
  const arrow = (a: string, b: string) => `${a} <span class="muted">→ ${b}</span>`;
  switch (type) {
    case 'castle':
      return [
        `Builders: ${arrow(String(buildersForCastle(level)), String(buildersForCastle(next)))}`,
        `Max building level: ${arrow(String(level * 2), String(next * 2))}`,
        'Era: Stone Age',
      ];
    case 'house':
      return [`Gold: ${arrow(`${HOUSE_GOLD[level - 1] ?? 0}/h`, `${HOUSE_GOLD[next - 1] ?? '—'}/h`)}`];
    case 'storage':
      return [`Shape & Gold cap: ${arrow(fmtNum(STORAGE_CAP[level - 1] ?? BASE_CAP), fmtNum(STORAGE_CAP[next - 1] ?? 0))}`];
    case 'granary':
      return [`Food cap: ${arrow(fmtNum(STORAGE_CAP[level - 1] ?? BASE_CAP), fmtNum(STORAGE_CAP[next - 1] ?? 0))}`];
    case 'barracks':
      return [`Unlocked: ${UNIT_TYPES.filter((u) => UNITS[u].barracksLevel <= level).map((u) => UNITS[u].name).join(', ') || '—'}`];
    case 'watchtower':
      return [`Defense: ${arrow(String(level * WATCHTOWER_DEF_PER_LEVEL), String(next * WATCHTOWER_DEF_PER_LEVEL))}`];
    case 'exchange':
      return [`Rate: ${EXCHANGE_EACH} of each basic shape → 1 Pentagon`];
    case 'lab':
      return [`Farm bonus: ${arrow(`+${Math.round(level * LAB_BONUS_PER_LEVEL * 100)}%`, `+${Math.round(next * LAB_BONUS_PER_LEVEL * 100)}%`)}`];
  }
}

function buildingPanel(s: GameState, c: Castle, id: string): PanelView {
  const b = c.buildings.find((x) => x.id === id)!;
  const def = BUILDINGS[b.type];
  const target: BuildTarget = { kind: 'building', id };
  let extra = '';
  if (b.level > 0 && b.type === 'barracks') extra = barracksSection(s, c, b.level);
  if (b.level > 0 && b.type === 'exchange') extra = exchangeSection(c);
  const html = `
    <div class="hero">
      <div class="hero-art">${primsToSvg(buildingPrims(b.type, b.level), 96)}</div>
      <div>
        <div class="hero-title">${def.name} <span class="lv">Lv ${b.level}</span></div>
        <div class="muted">${def.description}</div>
        ${b.level > 0 ? `<ul class="effects">${effectLines(b.type, b.level).map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
    ${upgradeBlock(s, c, target, b.level)}
    ${extra}`;
  return { title: def.name, html };
}

function farmPanel(s: GameState, c: Castle, index: number): PanelView {
  const f = c.farms[index];
  const info = FARM_INFO[f.type];
  const lab = buildingLevel(c, 'lab');
  const now = farmOutput(f.level, lab);
  const next = farmOutput(f.level + 1, lab);
  const art = [...farmItemPrims(f.type, 0)];
  const html = `
    <div class="hero">
      <div class="hero-art">${primsToSvg(art, 80)}</div>
      <div>
        <div class="hero-title">${info.name} <span class="lv">Lv ${f.level}</span></div>
        <ul class="effects">
          <li>${iconSvg(f.type, 16)} Production: ${Math.round(now)}/h <span class="muted">→ ${next ? `${Math.round(next)}/h` : '—'}</span></li>
          ${f.type !== 'food' ? `<li>${iconSvg('pentagon', 16)} ${Math.round(LUCKY_DROP_CHANCE * 100)}% chance per hour to find a Pentagon</li>` : ''}
        </ul>
        <p class="muted small">Farm types are fixed by your zone's pattern. You can only upgrade them.</p>
      </div>
    </div>
    ${upgradeBlock(s, c, { kind: 'farm', index }, f.level)}`;
  return { title: info.name, html };
}

function barracksSection(s: GameState, c: Castle, level: number): string {
  const cards = UNIT_TYPES.map((u) => {
    const d = UNITS[u];
    const locked = level < d.barracksLevel;
    const buttons = locked
      ? `<span class="locked">Needs Barracks Lv ${d.barracksLevel}</span>`
      : [1, 5, 10]
          .map((n) => {
            const cost = multiplyCost(d.cost, n);
            if (canAfford(c, cost)) return `<button class="btn primary" data-act="train" data-unit="${u}" data-n="${n}">Train ${n}</button>`;
            if (overCap(c, cost)) return '';
            return `<button class="btn crystal" data-act="train" data-buy="1" data-unit="${u}" data-n="${n}">${n} · ${iconSvg('crystal', 12)}${missingPrice(c, cost)}</button>`;
          })
          .join('');
    return `
      <div class="card${locked ? ' dim' : ''}">
        <div class="card-art unit">${primsToSvg(unitPrims(u), 70)}</div>
        <div class="card-body">
          <div class="card-title">${d.name} <small>×${c.soldiers[u]}</small></div>
          <div class="card-desc">${d.recipe}</div>
          <div class="stats">⚔ ${d.atk} · 🛡 ${d.def} · ❤ ${d.hp} · ${iconSvg('food', 12)} ${d.foodPerHour}/h</div>
          <div class="chips">${costChips(d.cost, c)}<span class="chip time">⏱ ${gameTime(s, d.trainSec * 1000)}</span></div>
          <div class="actions">${buttons}</div>
        </div>
      </div>`;
  }).join('');
  const queue = c.training.length
    ? `<div class="queue">
        <div class="label">Training queue (${c.training.length}/${MAX_TRAIN_QUEUE})</div>
        ${c.training
          .map(
            (j, i) =>
              `<div class="queue-row">${primsToSvg(unitPrims(j.unit), 26)} ${j.count} × ${UNITS[j.unit].name}${
                i === 0 ? ` <span class="muted">next in <b data-endms="${j.nextMs}"></b></span>` : ''
              }</div>`,
          )
          .join('')}
        <button class="btn crystal" data-act="finish-train">Finish all <span data-train-finish></span></button>
      </div>`
    : '';
  return `<h3>Assemble soldiers</h3>${queue}<div class="cards">${cards}</div>`;
}

function exchangeSection(c: Castle): string {
  const each = BASIC.map((r) => `${iconSvg(r, 16)}${EXCHANGE_EACH}`).join(' + ');
  const btns = [1, 5, 10]
    .map((n) => {
      const ok = BASIC.every((r) => c.resources[r] >= EXCHANGE_EACH * n);
      return `<button class="btn primary" data-act="exchange" data-n="${n}" ${ok ? '' : 'disabled'}>Get ${n}</button>`;
    })
    .join('');
  return `
    <h3>Trade for rare shapes</h3>
    <div class="exchange">
      <div class="rate">${each} → ${iconSvg('pentagon', 22)} 1</div>
      <div class="muted">You have ${iconSvg('pentagon', 14)} <b>${c.pentagons}</b> Pentagons.</div>
      <div class="actions">${btns}</div>
      <p class="muted small">Rare shapes can't be bought with Crystals. Later you'll also get them by hunting monsters or trading with players.</p>
    </div>`;
}

function shopPanel(s: GameState): PanelView {
  const packs = SHOP_PACKS.map(
    (p) => `
      <button class="pack" data-act="pack" data-id="${p.id}">
        <div class="pack-icon">${iconSvg('crystal', 40)}</div>
        <div class="pack-amount">${p.crystals}</div>
        <div class="muted">${p.label}</div>
        <div class="price">${p.price}</div>
      </button>`,
  ).join('');
  return {
    title: 'Crystal Shop',
    html: `
      <p>You have ${iconSvg('crystal', 16)} <b>${s.crystals}</b> Crystals.</p>
      <div class="packs">${packs}</div>
      <p class="demo-note">Demo shop — no real payment. Tapping a pack just adds Crystals.</p>
      <ul class="muted small">
        <li>Finish buildings and training instantly (free under 1 minute).</li>
        <li>Top up missing resources: 1 Crystal per ${RES_PER_CRYSTAL}.</li>
      </ul>`,
  };
}

function settingsPanel(s: GameState, ctx: Ctx): PanelView {
  const speeds = DEV_SPEEDS.map(
    (v) => `<button class="btn ${v === s.devSpeed ? 'primary' : ''}" data-act="speed" data-speed="${v}">×${v}</button>`,
  ).join('');
  return {
    title: 'Settings',
    html: `
      <p>Ruler: <b>${esc(ctx.accountName)}</b></p>
      <h3>Dev speed</h3>
      <p class="muted small">Makes all game time run faster, for testing. ×1 is the real game speed.</p>
      <div class="actions">${speeds}</div>
      <h3>Dev tools</h3>
      <p class="muted small">Demo only — for testing. Will not exist in the real game.</p>
      <div class="actions"><button class="btn" data-act="dev-fill">Fill storage</button></div>
      <h3>Account</h3>
      <div class="actions">
        <button class="btn" data-act="logout">Log out</button>
        <button class="btn danger" data-act="reset">Reset save</button>
      </div>`,
  };
}

function armyPanel(c: Castle): PanelView {
  const r = rates(c);
  const barracks = c.buildings.find((b) => b.type === 'barracks' && b.level > 0);
  const rows = UNIT_TYPES.map(
    (u) => `<div class="army-row">${primsToSvg(unitPrims(u), 34)}<span>${UNITS[u].name}</span><b>${c.soldiers[u]}</b><span class="muted">${iconSvg('food', 12)} ${c.soldiers[u] * UNITS[u].foodPerHour}/h</span></div>`,
  ).join('');
  return {
    title: 'Army',
    html: `
      <div class="army">${rows}</div>
      <p>Food: ${Math.round(r.foodProduction)}/h produced − ${r.upkeep}/h eaten = <b class="${r.food < 0 ? 'neg' : ''}">${fmtRate(r.food)}</b></p>
      <p class="muted small">If food runs out while food/hour is negative, soldiers starve until it's balanced again.</p>
      ${barracks ? `<button class="btn primary" data-act="open-building" data-id="${barracks.id}">Go to Barracks</button>` : '<p class="muted">Build a Barracks (Castle Lv 2) to train soldiers.</p>'}`,
  };
}

function logPanel(s: GameState): PanelView {
  const items = [...s.events].reverse().map((e) => `<li class="ev-${e.kind}">${esc(e.text)}</li>`).join('');
  return { title: 'Kingdom log', html: items ? `<ul class="log">${items}</ul>` : '<p class="muted">Nothing yet.</p>' };
}
