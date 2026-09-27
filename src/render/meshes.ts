import * as THREE from 'three';
import { INK, offsetPoly, stickPoly, type Prim, type Pt } from '../art/prims';

// Turns shape primitives into flat Three.js meshes with an ink outline.

const OUTLINE = 0.055;
const materials = new Map<string, THREE.MeshBasicMaterial>();

export function material(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}|${opacity}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: opacity < 1, opacity });
    if (opacity < 1) m.depthWrite = false;
    materials.set(key, m);
  }
  return m;
}

function shapeGeometry(pts: Pt[]): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
}

function primGeometry(p: Prim, grow: number): THREE.BufferGeometry {
  if (p.t === 'circle') {
    const g = new THREE.CircleGeometry(p.r + grow, 32);
    g.translate(p.x, p.y, 0);
    return g;
  }
  if (p.t === 'stick') return shapeGeometry(stickPoly(p, grow));
  return shapeGeometry(grow ? offsetPoly(p.pts, grow) : p.pts);
}

/** Flat shapes in the local XY plane (y up), stacked slightly toward +z. */
export function primsGroup(prims: Prim[], outline = OUTLINE): THREE.Group {
  const g = new THREE.Group();
  if (outline > 0) {
    for (const p of prims) g.add(new THREE.Mesh(primGeometry(p, outline), material(INK)));
  }
  prims.forEach((p, i) => {
    const m = new THREE.Mesh(primGeometry(p, 0), material(p.fill));
    m.position.z = 0.004 * (i + 1);
    g.add(m);
  });
  return g;
}

/** Same as primsGroup but lying flat on the ground (local y → world -z). */
export function flatGroup(prims: Prim[], outline = OUTLINE): THREE.Group {
  const inner = primsGroup(prims, outline);
  inner.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

export function groundShadow(width: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), material('#000000', 0.16));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(width * 0.55, width * 0.3, 1);
  m.position.y = 0.02;
  return m;
}

export function disposeGroup(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
