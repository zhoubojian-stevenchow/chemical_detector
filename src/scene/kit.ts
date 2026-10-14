import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small procedural modelling kit: cached materials + primitive builders.

const matCache = new Map<string, THREE.Material>();

export interface MatOpts {
  rough?: number;
  metal?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  flat?: boolean;
  side?: THREE.Side;
  env?: number;
}

export function mat(color: string | number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.55}|${o.metal ?? 0}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 1}|${o.opacity ?? 1}|${o.flat ? 1 : 0}|${o.side ?? 0}|${o.env ?? 1}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color as any),
      roughness: o.rough ?? 0.55,
      metalness: o.metal ?? 0,
      flatShading: !!o.flat,
      side: o.side ?? THREE.FrontSide,
      envMapIntensity: o.env ?? 1,
    });
    if (o.emissive) {
      m.emissive = new THREE.Color(o.emissive);
      m.emissiveIntensity = o.emissiveIntensity ?? 1;
    }
    if (o.opacity !== undefined && o.opacity < 1) {
      m.transparent = true;
      m.opacity = o.opacity;
      m.depthWrite = false;
    }
    matCache.set(key, m);
  }
  return m;
}

/** A unique (non-cached) material, for things whose colour animates. */
export function umat(color: string | number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const m = mat(color, o).clone();
  return m;
}

let sharedGlass: THREE.MeshStandardMaterial | null = null;
export const glassMat = () =>
  (sharedGlass ??= new THREE.MeshStandardMaterial({
    color: 0xeaf6ff,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 2.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));

export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = shadow;
  me.receiveShadow = true;
  return me;
}

export function rbox(w: number, h: number, d: number, r: number, color: string | THREE.Material, o?: MatOpts): THREE.Mesh {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
  return mesh(g, typeof color === 'string' ? mat(color, o) : color);
}

export function box(w: number, h: number, d: number, color: string | THREE.Material, o?: MatOpts): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, o) : color);
}

export function cyl(rt: number, rb: number, h: number, color: string | THREE.Material, seg = 24, o?: MatOpts, open = false): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), typeof color === 'string' ? mat(color, o) : color);
}

export function sphere(r: number, color: string | THREE.Material, seg = 20, o?: MatOpts): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.floor(seg * 0.75))), typeof color === 'string' ? mat(color, o) : color);
}

export function torus(r: number, tube: number, color: string | THREE.Material, arc = Math.PI * 2, o?: MatOpts): THREE.Mesh {
  return mesh(new THREE.TorusGeometry(r, tube, 10, 28, arc), typeof color === 'string' ? mat(color, o) : color);
}

export function capsule(r: number, len: number, color: string | THREE.Material, o?: MatOpts): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(r, len, 6, 16), typeof color === 'string' ? mat(color, o) : color);
}

export function cone(r: number, h: number, color: string | THREE.Material, seg = 20, o?: MatOpts): THREE.Mesh {
  return mesh(new THREE.ConeGeometry(r, h, seg), typeof color === 'string' ? mat(color, o) : color);
}

/** Lathe from a list of [radius, height] points (bottom → top). */
export function lathe(points: [number, number][], m: THREE.Material, seg = 28): THREE.Mesh {
  const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const me = mesh(g, m);
  return me;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, parent?: THREE.Object3D): T {
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}

export function group(parent?: THREE.Object3D, name?: string): THREE.Group {
  const g = new THREE.Group();
  if (name) g.name = name;
  parent?.add(g);
  return g;
}

/** Tube along points. */
export function tube(points: THREE.Vector3[], r: number, color: string | THREE.Material, seg = 32): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, seg, r, 8, false), typeof color === 'string' ? mat(color) : color);
}

export function setShadow(o: THREE.Object3D, cast: boolean, receive = true): void {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}

export function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
  return '#' + c.getHexString();
}

/**
 * Merge all static meshes under `root` that share a material into one mesh per material.
 * Objects (or ancestors) flagged with `userData.dynamic = true` are left alone.
 * Cuts draw calls massively (important for low-end phones).
 */
export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; order: number }>();
  const remove: THREE.Mesh[] = [];
  const isDynamic = (o: THREE.Object3D) => {
    let p: THREE.Object3D | null = o;
    while (p && p !== root) {
      if (p.userData.dynamic || !p.visible) return true;
      p = p.parent;
    }
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || isDynamic(m)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.clearGroups();
    g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const b = buckets.get(m.material) ?? { geos: [], cast: false, order: m.renderOrder };
    b.geos.push(g);
    b.cast = b.cast || m.castShadow;
    buckets.set(m.material, b);
    remove.push(m);
  });
  for (const m of remove) m.parent?.remove(m);
  for (const [material, b] of buckets) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    mesh.renderOrder = b.order;
    root.add(mesh);
  }
}
