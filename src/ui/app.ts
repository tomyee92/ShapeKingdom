import { iconSvg } from '../art/svg';
import type { AccountInfo, Backend } from '../backend/backend';
import type { BuildingType } from '../data/buildings';
import { RESOURCES, type Cost } from '../data/resources';
import { UNITS, type UnitType } from '../data/units';
import * as A from '../logic/actions';
import { advance } from '../logic/advance';
import { builderSlots, buildingCost, caps, finishPrice, multiplyCost, rates, trainingRemainingMs } from '../logic/formulas';
import { HOUR_MS, createGame, getCastle, type BuildTarget, type GameState } from '../logic/state';
import { ZoneScene, type Slot } from '../render/scene';
import { fmtDuration, fmtNum, fmtRate } from './format';
import { renderPanel, type Panel } from './panels';

const TICK_MS = 1000;
const LIVE_MS = 200;
const SAVE_MS = 10_000;

export class GameApp {
  private state: GameState;
  private castleId = 'c1';
  private panel: Panel | null = null;
  private panelHtml = '';
  private scene: ZoneScene;
  private lastEventId: number;
  private timers: number[] = [];
  private el: Record<'top' | 'banner' | 'stage' | 'labels' | 'sheet' | 'sheetTitle' | 'sheetBody' | 'toasts', HTMLElement>;

  constructor(
    private root: HTMLElement,
    private backend: Backend,
    private account: AccountInfo,
    save: GameState,
    private onLogout: () => void,
  ) {
    const before = save;
    this.state = advance(save, Date.now());
    this.lastEventId = before.events.at(-1)?.id ?? 0;

    root.innerHTML = `
      <div class="game">
        <header class="topbar"></header>
        <div class="banner" hidden></div>
        <div class="stage"><div class="labels"></div><div class="toasts"></div></div>
        <nav class="toolbar">
          <button data-open="army"><span>⚔</span>Army</button>
          <button data-open="log"><span>📜</span>Log</button>
          <button data-map><span>🗺</span>World</button>
          <button data-open="shop"><span class="tb-crystal">${iconSvg('crystal', 20)}</span>Shop</button>
          <button data-open="settings"><span>⚙</span>Settings</button>
        </nav>
        <section class="sheet" hidden>
          <div class="sheet-head"><h2></h2><button class="close" aria-label="Close">✕</button></div>
          <div class="sheet-body"></div>
        </section>
      </div>`;
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    this.el = {
      top: q('.topbar'),
      banner: q('.banner'),
      stage: q('.stage'),
      labels: q('.labels'),
      sheet: q('.sheet'),
      sheetTitle: q('.sheet-head h2'),
      sheetBody: q('.sheet-body'),
      toasts: q('.toasts'),
    };
    this.buildTopbar();
    this.scene = new ZoneScene(this.el.stage, this.el.labels, (slot) => this.onSlot(slot));
    this.bindUi();

    // Report what happened while away.
    const away = this.state.events.filter((e) => e.id > this.lastEventId);
    if (away.length) {
      this.toast(`While you were away: ${away.length} thing${away.length > 1 ? 's' : ''} happened. See the Log.`, 'info');
      this.lastEventId = this.state.events.at(-1)!.id;
    }

    this.render();
    this.timers.push(window.setInterval(() => this.tick(), TICK_MS));
    this.timers.push(window.setInterval(() => this.live(), LIVE_MS));
    this.timers.push(window.setInterval(() => this.save(), SAVE_MS));
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
  }

  destroy(): void {
    this.timers.forEach((t) => clearInterval(t));
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    this.scene.dispose();
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden') this.save();
  };

  private get castle() {
    return getCastle(this.state, this.castleId);
  }

  private save(): void {
    void this.backend.writeSave(this.account.id, this.state);
  }

  private tick(): void {
    this.state = advance(this.state, Date.now());
    for (const e of this.state.events) {
      if (e.id > this.lastEventId) this.toast(e.text, e.kind);
    }
    this.lastEventId = this.state.events.at(-1)?.id ?? this.lastEventId;
    this.render();
  }

  /** Run an action against the up-to-date state. Returns true on success. */
  private act(fn: (s: GameState) => A.Result): boolean {
    this.state = advance(this.state, Date.now());
    const r = fn(this.state);
    if (!r.ok) {
      this.toast(r.error, 'error');
      return false;
    }
    this.state = r.state;
    this.save();
    this.tick();
    return true;
  }

  /** Buy the missing resources for `cost`, then run the action. */
  private actWithTopUp(cost: Cost, fn: (s: GameState) => A.Result): boolean {
    return this.act((s) => {
      const topped = A.buyMissing(s, this.castleId, cost);
      return topped.ok ? fn(topped.state) : topped;
    });
  }

  // ---------- rendering ----------

  private buildTopbar(): void {
    const res = RESOURCES.map(
      (r) => `<div class="res" data-res="${r}">${iconSvg(r, 20)}<div><b class="amt"></b><small class="cap"></small><small class="rate"></small></div></div>`,
    ).join('');
    this.el.top.innerHTML = `
      <div class="res-list">${res}</div>
      <div class="top-right">
        <div class="res special" title="Pentagon (rare)">${iconSvg('pentagon', 20)}<b class="pent"></b></div>
        <button class="res special crystal-btn" data-open="shop" title="Crystals">${iconSvg('crystal', 20)}<b class="crys"></b><span class="plus">+</span></button>
        <div class="res special builders" title="Builders busy">🔨<b class="bld"></b></div>
      </div>`;
  }

  private render(): void {
    const c = this.castle;
    const r = rates(c);
    const cap = caps(c);
    for (const res of RESOURCES) {
      const box = this.el.top.querySelector<HTMLElement>(`[data-res="${res}"]`)!;
      box.querySelector('.amt')!.textContent = fmtNum(c.resources[res]);
      box.querySelector('.cap')!.textContent = `/${fmtNum(cap[res])}`;
      const rate = box.querySelector<HTMLElement>('.rate')!;
      rate.textContent = fmtRate(r[res]);
      rate.classList.toggle('neg', r[res] < 0);
      box.classList.toggle('full', c.resources[res] >= cap[res]);
    }
    this.el.top.querySelector('.pent')!.textContent = String(c.pentagons);
    this.el.top.querySelector('.crys')!.textContent = fmtNum(this.state.crystals);
    this.el.top.querySelector('.bld')!.textContent = `${c.builds.length}/${builderSlots(c)}`;

    // Food warning.
    if (r.food < 0 && c.resources.food > 0) {
      const realMs = ((c.resources.food / -r.food) * HOUR_MS) / this.state.devSpeed;
      this.el.banner.hidden = false;
      this.el.banner.innerHTML = `⚠ Food ${fmtRate(r.food)} — runs out in <b>${fmtDuration(realMs)}</b>. Then soldiers starve.`;
    } else {
      this.el.banner.hidden = true;
    }

    this.scene.update(c);
    this.renderPanel();
    this.live();
  }

  private renderPanel(): void {
    if (!this.panel) return;
    const view = renderPanel(this.state, this.castle, this.panel, { accountName: this.account.name });
    if (!view) {
      this.closePanel();
      return;
    }
    this.el.sheetTitle.textContent = view.title;
    if (view.html !== this.panelHtml) {
      const scroll = this.el.sheetBody.scrollTop;
      this.el.sheetBody.innerHTML = view.html;
      this.el.sheetBody.scrollTop = scroll;
      this.panelHtml = view.html;
    }
  }

  /** Update countdowns, progress bars and finish prices between ticks. */
  private live(): void {
    const s = this.state;
    const gameNow = s.gameMs + (Date.now() - s.realMs) * s.devSpeed;
    document.querySelectorAll<HTMLElement>('[data-endms]').forEach((el) => {
      el.textContent = fmtDuration((Number(el.dataset.endms) - gameNow) / s.devSpeed);
    });
    document.querySelectorAll<HTMLElement>('[data-start][data-end]').forEach((el) => {
      const a = Number(el.dataset.start);
      const b = Number(el.dataset.end);
      el.style.width = `${Math.min(100, Math.max(0, ((gameNow - a) / (b - a || 1)) * 100))}%`;
    });
    const priceText = (p: number) => (p === 0 ? 'Free' : `${iconSvg('crystal', 12)}${p}`);
    document.querySelectorAll<HTMLElement>('[data-finish-endms]').forEach((el) => {
      const html = priceText(finishPrice(Number(el.dataset.finishEndms) - gameNow));
      if (el.innerHTML !== html) el.innerHTML = html;
    });
    document.querySelectorAll<HTMLElement>('[data-train-finish]').forEach((el) => {
      const html = priceText(finishPrice(trainingRemainingMs(this.castle, gameNow)));
      if (el.innerHTML !== html) el.innerHTML = html;
    });
  }

  private toast(text: string, kind: string): void {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  // ---------- input ----------

  private openPanel(p: Panel): void {
    this.panel = p;
    this.panelHtml = '';
    this.el.sheet.hidden = false;
    this.el.sheetBody.scrollTop = 0;
    this.renderPanel();
    this.live();
  }

  private closePanel(): void {
    this.panel = null;
    this.panelHtml = '';
    this.el.sheet.hidden = true;
  }

  private onSlot(slot: Slot): void {
    if (slot.kind === 'plot') this.openPanel({ kind: 'plot', plot: slot.plot });
    else if (slot.kind === 'farm') this.openPanel({ kind: 'farm', index: slot.index });
    else this.openPanel({ kind: 'building', id: slot.id });
  }

  private bindUi(): void {
    this.root.querySelector('.close')!.addEventListener('click', () => this.closePanel());
    this.root.querySelectorAll<HTMLElement>('[data-open]').forEach((b) =>
      b.addEventListener('click', () => this.openPanel({ kind: b.dataset.open as 'army' | 'log' | 'shop' | 'settings' })),
    );
    this.root.querySelector('[data-map]')!.addEventListener('click', () =>
      this.toast('World map is coming soon — conquer zones, hunt shape monsters and fight guilds.', 'info'),
    );
    this.el.sheetBody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (btn && !(btn as HTMLButtonElement).disabled) this.onAction(btn.dataset);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePanel();
    });
  }

  private onAction(d: DOMStringMap): void {
    const cid = this.castleId;
    const buy = d.buy === '1';
    switch (d.act) {
      case 'build': {
        const type = d.type as BuildingType;
        const plot = Number(d.plot);
        const fn = (s: GameState) => A.constructBuilding(s, cid, type, plot);
        const done = buy ? this.actWithTopUp(buildingCost(type, 1), fn) : this.act(fn);
        // After placing a building, show its panel so the timer is visible.
        const b = this.castle.buildings.find((x) => x.plot === plot);
        if (done && b) this.openPanel({ kind: 'building', id: b.id });
        break;
      }
      case 'upgrade': {
        const target: BuildTarget = d.kind === 'farm' ? { kind: 'farm', index: Number(d.ref) } : { kind: 'building', id: d.ref! };
        const fn = (s: GameState) => A.upgrade(s, cid, target);
        if (buy) this.actWithTopUp(A.upgradeCost(this.castle, target), fn);
        else this.act(fn);
        break;
      }
      case 'finish': {
        const job = this.castle.builds.find((j) => j.id === d.job);
        if (job && this.confirmSpend(finishPrice(job.endMs - this.state.gameMs))) this.act((s) => A.finishBuild(s, cid, d.job!));
        break;
      }
      case 'train': {
        const unit = d.unit as UnitType;
        const n = Number(d.n);
        const fn = (s: GameState) => A.train(s, cid, unit, n);
        if (buy) this.actWithTopUp(multiplyCost(UNITS[unit].cost, n), fn);
        else this.act(fn);
        break;
      }
      case 'finish-train':
        if (this.confirmSpend(finishPrice(trainingRemainingMs(this.castle, this.state.gameMs)))) this.act((s) => A.finishTraining(s, cid));
        break;
      case 'exchange':
        this.act((s) => A.exchange(s, cid, Number(d.n)));
        break;
      case 'pack':
        this.act((s) => A.buyCrystals(s, d.id!));
        break;
      case 'speed':
        this.act((s) => A.setDevSpeed(s, Number(d.speed)));
        break;
      case 'dev-fill':
        this.act((s) => A.devFill(s, cid));
        break;
      case 'open-building':
        this.openPanel({ kind: 'building', id: d.id! });
        break;
      case 'logout':
        this.save();
        void this.backend.logOut().then(() => this.onLogout());
        break;
      case 'reset':
        if (confirm('Reset your kingdom? All progress on this account will be lost.')) {
          this.state = createGame(Date.now());
          this.lastEventId = 0;
          this.save();
          this.closePanel();
          this.render();
          this.toast('A fresh start. Your kingdom awaits!', 'info');
        }
        break;
    }
  }

  /** Ask before spending a lot of Crystals. */
  private confirmSpend(price: number): boolean {
    return price < 100 || confirm(`Spend ${price} Crystals?`);
  }
}
