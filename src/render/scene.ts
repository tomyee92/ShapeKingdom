import * as THREE from 'three';
import { FARM_PATCH_COLOR, buildingPrims, farmItemPrims, scaffoldPrims } from '../art/buildingArt';
import { bounds, ngon, stick, type Prim } from '../art/prims';
import { iconSvg } from '../art/svg';
import { unitPrims } from '../art/unitArt';
import { BUILDINGS, FARM_INFO, INNER_PLOTS } from '../data/buildings';
import { UNIT_TYPES, type UnitType } from '../data/units';
import type { BuildJob, Castle } from '../logic/state';
import { FARM_ITEM_SPOTS, FARM_PATCH_RADIUS, PLOT_RING, ZONE_RADIUS, farmPos, plotPos } from './layout';
import { disposeGroup, flatGroup, groundShadow, material, primsGroup } from './meshes';

export type Slot = { kind: 'building'; id: string } | { kind: 'plot'; plot: number } | { kind: 'farm'; index: number };

// Dimetric camera: 45 deg around, 30 deg down. Billboards turn to face it.
const ELEVATION = Math.PI / 6;
const YAW = Math.PI / 4;
const CAM_DIR = new THREE.Vector3(Math.sin(YAW) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(YAW) * Math.cos(ELEVATION));
const MAX_PAN = ZONE_RADIUS;
const MAX_SOLDIERS_SHOWN = 16;

interface SlotView {
  key: string;
  group: THREE.Group;
  label: HTMLDivElement;
  labelKey: string;
  anchor: THREE.Vector3;
}

function billboard(prims: Prim[], scale: number): THREE.Group {
  const g = primsGroup(prims);
  g.scale.setScalar(scale);
  g.rotation.y = YAW;
  return g;
}

function jobFor(c: Castle, match: (j: BuildJob) => boolean): BuildJob | undefined {
  return c.builds.find(match);
}

export class ZoneScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3(0, 0, 0);
  private slots = new Map<string, SlotView>();
  private soldiers = new THREE.Group();
  private soldierKey = '';
  private raycaster = new THREE.Raycaster();
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number } | null = null;
  private moved = 0;
  private pinchDist = 0;
  private raf = 0;
  private resizeObs: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private labelLayer: HTMLElement,
    private onTap: (slot: Slot) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#d8cba8');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.zoom = 1;
    this.buildGround();
    this.scene.add(this.soldiers);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    // Tall phone screens have spare height: start closer in.
    if (container.clientWidth / (container.clientHeight || 1) < 0.8) this.setZoom(1.35);
    this.bindInput();
    this.loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.innerHTML = '';
  }

  private buildGround(): void {
    const world = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material('#d8cba8'));
    world.rotation.x = -Math.PI / 2;
    this.scene.add(world);
    // The world map is a grid of zones: hint at it with grid lines outside our zone.
    const grid = new THREE.GridHelper(96, 24, '#bfae86', '#c7b891');
    grid.position.y = 0.005;
    this.scene.add(grid);

    const zone = flatGroup([ngon(0, 0, ZONE_RADIUS, 48, '#b7d08c')], 0.12);
    zone.position.y = 0.01;
    this.scene.add(zone);
    const yard = flatGroup([ngon(0, 0, PLOT_RING + 1.5, 40, '#dccb9f')], 0);
    yard.position.y = 0.02;
    this.scene.add(yard);
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    // Fit the whole zone: its width across, its squashed ellipse (plus castle height) vertically.
    const aspect = w / h;
    const halfH = Math.max(ZONE_RADIUS * Math.sin(ELEVATION) + 2, (ZONE_RADIUS + 0.5) / aspect);
    const halfW = halfH * aspect;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(): void {
    this.camera.position.copy(this.target).addScaledVector(CAM_DIR, 60);
    this.camera.lookAt(this.target);
  }

  /** Sync the scene with the castle state. Only rebuilds slots whose look changed. */
  update(c: Castle): void {
    const seen = new Set<string>();

    const castle = c.buildings.find((b) => b.type === 'castle')!;
    const occupied = new Map(c.buildings.filter((b) => b.plot >= 0).map((b) => [b.plot, b]));

    const place = (id: string, slot: Slot, key: string, pos: [number, number], make: () => { group: THREE.Group; height: number }, label: string) => {
      seen.add(id);
      let v = this.slots.get(id);
      if (!v || v.key !== key) {
        if (v) {
          this.scene.remove(v.group);
          disposeGroup(v.group);
        }
        const { group, height } = make();
        group.position.set(pos[0], 0, pos[1]);
        group.traverse((o) => (o.userData.slot = slot));
        this.scene.add(group);
        const el = v?.label ?? document.createElement('div');
        el.className = 'map-label';
        if (!v) this.labelLayer.appendChild(el);
        v = { key, group, label: el, labelKey: '', anchor: new THREE.Vector3(pos[0], height, pos[1]) };
        this.slots.set(id, v);
      }
      if (v.labelKey !== label) {
        v.label.innerHTML = label;
        v.labelKey = label;
      }
    };

    // Castle
    {
      const job = jobFor(c, (j) => j.target.kind === 'building' && j.target.id === castle.id);
      const scale = 1.4 + castle.level * 0.07;
      place(
        castle.id,
        { kind: 'building', id: castle.id },
        `castle:${castle.level}:${!!job}`,
        [0, 0],
        () => this.makeBuilding(buildingPrims('castle', castle.level), scale, !!job),
        buildingLabel(BUILDINGS.castle.name, castle.level, job),
      );
    }

    // Inner plots
    for (let plot = 0; plot < INNER_PLOTS; plot++) {
      const b = occupied.get(plot);
      const pos = plotPos(plot);
      if (!b) {
        place(`plot${plot}`, { kind: 'plot', plot }, 'empty', pos, () => this.makeEmptyPlot(), '');
        continue;
      }
      seen.add(`plot${plot}`); // hide the empty marker below
      const job = jobFor(c, (j) => j.target.kind === 'building' && j.target.id === b.id);
      const scale = 1.25 + Math.max(1, b.level) * 0.04;
      place(
        b.id,
        { kind: 'building', id: b.id },
        `${b.type}:${b.level}:${!!job}`,
        pos,
        () => this.makeBuilding(buildingPrims(b.type, b.level), scale, !!job),
        buildingLabel(BUILDINGS[b.type].name, b.level, job),
      );
    }
    for (let plot = 0; plot < INNER_PLOTS; plot++) {
      if (occupied.has(plot)) this.removeSlot(`plot${plot}`);
    }

    // Farms
    c.farms.forEach((f, index) => {
      const job = jobFor(c, (j) => j.target.kind === 'farm' && j.target.index === index);
      place(
        `farm${index}`,
        { kind: 'farm', index },
        `${f.type}:${f.level}:${!!job}`,
        farmPos(index),
        () => this.makeFarm(f.type, f.level, !!job),
        `${iconSvg(f.type === 'food' ? 'food' : f.type, 14)} ${buildingLabel(FARM_INFO[f.type].name, f.level, job, true)}`,
      );
    });

    for (const id of [...this.slots.keys()]) if (!seen.has(id)) this.removeSlot(id);

    this.updateSoldiers(c);
  }

  private removeSlot(id: string): void {
    const v = this.slots.get(id);
    if (!v) return;
    this.scene.remove(v.group);
    disposeGroup(v.group);
    v.label.remove();
    this.slots.delete(id);
  }

  private makeBuilding(prims: Prim[], scale: number, building: boolean): { group: THREE.Group; height: number } {
    const b = bounds(prims);
    const width = b.maxX - b.minX;
    const g = new THREE.Group();
    g.add(groundShadow(width * scale));
    g.add(billboard(prims, scale));
    if (building) {
      const sc = billboard(scaffoldPrims(width + 0.2, b.maxY * 0.8), scale);
      sc.position.add(new THREE.Vector3().copy(CAM_DIR).setY(0).normalize().multiplyScalar(0.05));
      g.add(sc);
    }
    g.add(this.hitDisc(1.3));
    return { group: g, height: b.maxY * scale * Math.cos(ELEVATION) + 0.6 };
  }

  private makeEmptyPlot(): { group: THREE.Group; height: number } {
    const g = new THREE.Group();
    const plus = '#b9a77e';
    const tile = flatGroup(
      [ngon(0, 0, 0.95, 4, '#efe4c6', Math.PI / 4), // Diagonal in ground space so it reads as "+" from the 45° camera.
       stick(-0.22, -0.22, 0.22, 0.22, plus, 0.12), stick(-0.22, 0.22, 0.22, -0.22, plus, 0.12)],
      0.05,
    );
    tile.position.y = 0.03;
    g.add(tile);
    g.add(this.hitDisc(1.2));
    return { group: g, height: 0.4 };
  }

  private makeFarm(type: Castle['farms'][number]['type'], level: number, building: boolean): { group: THREE.Group; height: number } {
    const g = new THREE.Group();
    const patch = flatGroup([ngon(0, 0, FARM_PATCH_RADIUS, 8, FARM_PATCH_COLOR[type], Math.PI / 8)], 0.08);
    patch.position.y = 0.03;
    g.add(patch);
    const count = Math.min(FARM_ITEM_SPOTS.length, 2 + Math.ceil(level / 2));
    for (let i = 0; i < count; i++) {
      const [x, z] = FARM_ITEM_SPOTS[i];
      const item = billboard(farmItemPrims(type, i), 1.0);
      item.position.set(x, 0.03, z);
      g.add(item);
    }
    if (building) {
      const sc = billboard(scaffoldPrims(1.6, 1.3), 1);
      sc.position.set(0.3, 0, 0.3);
      g.add(sc);
    }
    g.add(this.hitDisc(FARM_PATCH_RADIUS));
    return { group: g, height: 1.4 };
  }

  private hitDisc(r: number): THREE.Mesh {
    // Invisible (fully transparent) but still hit by the raycaster.
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.5, 16), material('#ffffff', 0));
    m.position.y = 1.25;
    return m;
  }

  private updateSoldiers(c: Castle): void {
    const shown = pickShown(c.soldiers);
    const barracks = c.buildings.find((b) => b.type === 'barracks');
    const key = `${shown.join(',')}|${barracks?.plot ?? 'none'}`;
    if (key === this.soldierKey) return;
    this.soldierKey = key;
    disposeGroup(this.soldiers);
    this.soldiers.clear();
    if (!shown.length) return;
    // Formation just outside the barracks (or in front of the castle).
    const [bx, bz] = barracks ? plotPos(barracks.plot) : [0, 0];
    const out = new THREE.Vector2(bx, bz);
    if (out.lengthSq() === 0) out.set(1, 1);
    out.normalize();
    const side = new THREE.Vector2(-out.y, out.x);
    const base = new THREE.Vector2(bx, bz).addScaledVector(out, barracks ? 1.7 : 2.4);
    shown.forEach((u, i) => {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const p = base.clone().addScaledVector(side, (col - 3.5) * 0.42).addScaledVector(out, row * 0.55);
      const fig = billboard(unitPrims(u), 0.45);
      fig.position.set(p.x, 0.03, p.y);
      fig.userData.phase = i * 0.7;
      this.soldiers.add(fig);
    });
  }

  private bindInput(): void {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.downAt = { x: e.clientX, y: e.clientY };
        this.moved = 0;
      } else {
        this.downAt = null;
        this.pinchDist = this.pinchDistance();
      }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, cur);
      if (this.pointers.size === 1) {
        this.moved += Math.hypot(cur.x - prev.x, cur.y - prev.y);
        this.pan(cur.x - prev.x, cur.y - prev.y);
      } else if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        if (this.pinchDist > 0) this.setZoom(this.camera.zoom * (d / this.pinchDist));
        this.pinchDist = d;
      }
    });
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.downAt && this.pointers.size === 0 && this.moved < 8) this.tap(e.clientX, e.clientY);
      if (this.pointers.size === 0) this.downAt = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.camera.zoom * Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private setZoom(z: number): void {
    this.camera.zoom = THREE.MathUtils.clamp(z, 0.6, 3);
    this.camera.updateProjectionMatrix();
  }

  private pan(dx: number, dy: number): void {
    const el = this.renderer.domElement;
    const wpp = (this.camera.right - this.camera.left) / this.camera.zoom / el.clientWidth;
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
    const back = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
    this.target.addScaledVector(right, -dx * wpp);
    this.target.addScaledVector(back, (-dy * wpp) / Math.sin(ELEVATION));
    const flat = new THREE.Vector2(this.target.x, this.target.z);
    if (flat.length() > MAX_PAN) {
      flat.setLength(MAX_PAN);
      this.target.set(flat.x, 0, flat.y);
    }
  }

  private tap(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const groups = [...this.slots.values()].map((v) => v.group);
    const hit = this.raycaster.intersectObjects(groups, true)[0];
    const slot = hit?.object.userData.slot as Slot | undefined;
    if (slot) this.onTap(slot);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    this.placeCamera();
    const t = performance.now() / 1000;
    for (const fig of this.soldiers.children) {
      fig.position.y = 0.03 + Math.abs(Math.sin(t * 3 + fig.userData.phase)) * 0.06;
    }
    this.renderer.render(this.scene, this.camera);
    this.positionLabels();
  };

  private positionLabels(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    for (const s of this.slots.values()) {
      v.copy(s.anchor).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      s.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
}

function buildingLabel(name: string, level: number, job: BuildJob | undefined, compact = false): string {
  const title = compact ? `<span class="lv">Lv ${level}</span>` : `<b>${name}</b> <span class="lv">Lv ${level}</span>`;
  if (!job) return level === 0 ? `<b>${name}</b>` : title;
  return `${level === 0 ? `<b>${name}</b>` : title}<div class="bar"><i data-start="${job.startMs}" data-end="${job.endMs}"></i></div><span class="timer" data-endms="${job.endMs}"></span>`;
}

/** Which soldier figures to draw: up to 16, proportional to the army. */
function pickShown(soldiers: Record<UnitType, number>): UnitType[] {
  const total = UNIT_TYPES.reduce((a, u) => a + soldiers[u], 0);
  if (!total) return [];
  const n = Math.min(MAX_SOLDIERS_SHOWN, total);
  const out: UnitType[] = [];
  for (const u of UNIT_TYPES) {
    const k = soldiers[u] > 0 ? Math.max(1, Math.round((soldiers[u] / total) * n)) : 0;
    for (let i = 0; i < k && out.length < n; i++) out.push(u);
  }
  return out;
}

