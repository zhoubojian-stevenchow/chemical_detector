import * as THREE from 'three';
import type { Substance } from '../data/types';
import { at, box, cyl, glassMat, group, lathe, mat, rbox, sphere, umat } from './kit';
import { labelTexture } from './textures';

/** Visual sample: container + contents, built from the substance's look. */
export class SampleView {
  readonly root = new THREE.Group();
  readonly contentMats: THREE.MeshStandardMaterial[] = [];
  /** world-space offset of the "mouth" (top) of the container */
  topY = 0.1;
  readonly sub: Substance;

  constructor(sub: Substance, label: string) {
    this.sub = sub;
    const color = sub.color;
    const opacity = sub.opacity ?? 1;
    const isMetal = sub.state === 'metal' || sub.id === 'mercury' || sub.id === 'galinstan';
    const contentMat = umat(color, {
      rough: isMetal ? 0.25 : sub.state === 'gel' ? 0.25 : sub.state === 'liquid' ? 0.1 : 0.85,
      metal: isMetal ? 0.85 : 0,
      opacity: opacity < 1 ? opacity : undefined,
      emissive: sub.glow ? color : undefined,
      emissiveIntensity: sub.glow ? 0.6 : undefined,
    });
    this.contentMats.push(contentMat);

    switch (sub.container) {
      case 'beaker':
      case 'bottle':
      case 'vial':
      case 'flask':
        this.buildLiquidVessel(sub.container, contentMat);
        break;
      case 'jar':
        this.buildJar(contentMat);
        break;
      case 'canister':
        this.buildCanister();
        break;
      default:
        this.buildDish(sub, contentMat);
    }

    // label
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshStandardMaterial({ map: labelTexture(label, { w: 256, h: 96, size: 34 }), roughness: 0.8 }));
    lbl.name = 'label';
    if (sub.container === 'dish') {
      lbl.position.set(0, 0.012, 0.14);
      lbl.rotation.x = -Math.PI / 2 + 0.25;
    } else if (sub.container === 'canister') {
      lbl.position.set(0, 0.16, 0.071);
    } else {
      lbl.position.set(0, Math.min(0.07, this.topY * 0.45), this.frontZ() + 0.002);
    }
    this.root.add(lbl);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  private frontRadius = 0.07;
  private frontZ(): number {
    return this.frontRadius;
  }

  private buildLiquidVessel(kind: string, contentMat: THREE.MeshStandardMaterial): void {
    let outer: [number, number][];
    let fill: number;
    if (kind === 'beaker') {
      outer = [[0, 0], [0.068, 0], [0.07, 0.005], [0.07, 0.17], [0.078, 0.18]];
      fill = 0.11;
      this.frontRadius = 0.071;
      this.topY = 0.18;
    } else if (kind === 'flask') {
      outer = [[0, 0], [0.08, 0], [0.083, 0.01], [0.04, 0.12], [0.025, 0.15], [0.025, 0.2], [0.03, 0.205]];
      fill = 0.07;
      this.frontRadius = 0.06;
      this.topY = 0.2;
    } else if (kind === 'vial') {
      outer = [[0, 0], [0.035, 0], [0.038, 0.01], [0.038, 0.16]];
      fill = 0.1;
      this.frontRadius = 0.039;
      this.topY = 0.17;
    } else {
      outer = [[0, 0], [0.06, 0], [0.062, 0.01], [0.062, 0.14], [0.03, 0.18], [0.025, 0.21]];
      fill = 0.12;
      this.frontRadius = 0.063;
      this.topY = 0.23;
    }
    const glass = lathe(outer, glassMat(), 32);
    glass.renderOrder = 2;
    this.root.add(glass);
    // liquid: lathe of the inner profile up to fill height
    const inner = outer
      .filter(([, y]) => y <= fill)
      .map(([r, y]) => [Math.max(0, r - 0.004), Math.max(0.003, y)] as [number, number]);
    const topR = this.radiusAt(outer, fill) - 0.004;
    inner.push([topR, fill], [0, fill]);
    const liquid = lathe(inner, contentMat, 32);
    liquid.renderOrder = 1;
    this.root.add(liquid);
    if (kind === 'bottle') {
      const cap = cyl(0.03, 0.03, 0.03, '#2b2d42');
      at(cap, 0, 0.225, 0, this.root);
    }
    if (kind === 'vial') {
      const cap = cyl(0.04, 0.04, 0.03, '#e63946');
      at(cap, 0, 0.175, 0, this.root);
    }
    if (this.sub.id === 'oilywater') {
      const sheen = cyl(topR, topR, 0.004, mat('#9b5de5', { opacity: 0.5, metal: 0.6, rough: 0.1 }));
      at(sheen, 0, fill + 0.003, 0, this.root);
    }
  }

  private radiusAt(pts: [number, number][], y: number): number {
    for (let i = 1; i < pts.length; i++) {
      const [r0, y0] = pts[i - 1];
      const [r1, y1] = pts[i];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0));
    }
    return pts[pts.length - 1][0];
  }

  private buildJar(contentMat: THREE.MeshStandardMaterial): void {
    const glass = lathe([[0, 0], [0.075, 0], [0.08, 0.01], [0.08, 0.13], [0.07, 0.14]], glassMat(), 32);
    glass.renderOrder = 2;
    this.root.add(glass);
    const goo = lathe([[0, 0.004], [0.075, 0.004], [0.076, 0.08], [0.06, 0.095], [0.03, 0.1], [0, 0.102]], contentMat, 32);
    goo.renderOrder = 1;
    this.root.add(goo);
    const lid = cyl(0.074, 0.074, 0.02, '#ffb627');
    at(lid, 0.11, 0.01, -0.02, this.root).rotation.z = 0.2;
    this.frontRadius = 0.081;
    this.topY = 0.14;
  }

  private buildCanister(): void {
    const body = cyl(0.07, 0.07, 0.3, mat('#9aa7b8', { metal: 0.7, rough: 0.35 }));
    at(body, 0, 0.15, 0, this.root);
    const dome = sphere(0.07, mat('#9aa7b8', { metal: 0.7, rough: 0.35 }));
    dome.scale.y = 0.5;
    at(dome, 0, 0.3, 0, this.root);
    const band = cyl(0.072, 0.072, 0.07, '#ffd23f');
    at(band, 0, 0.24, 0, this.root);
    at(cyl(0.015, 0.02, 0.05, mat('#c0c4c8', { metal: 0.9, rough: 0.2 })), 0, 0.35, 0, this.root);
    const valve = box(0.06, 0.012, 0.012, '#e63946');
    at(valve, 0, 0.37, 0, this.root);
    this.frontRadius = 0.071;
    this.topY = 0.38;
  }

  private buildDish(sub: Substance, contentMat: THREE.MeshStandardMaterial): void {
    const dish = lathe([[0, 0], [0.12, 0], [0.125, 0.004], [0.125, 0.03]], glassMat(), 36);
    dish.renderOrder = 2;
    this.root.add(dish);
    const base = cyl(0.12, 0.12, 0.004, mat('#ffffff', { opacity: 0.5 }));
    at(base, 0, 0.002, 0, this.root);
    this.frontRadius = 0.125;
    this.topY = 0.05;
    const rnd = mulberry(sub.id.length * 977 + sub.id.charCodeAt(0));
    if (sub.state === 'powder') {
      const pile = sphere(0.1, contentMat, 24);
      pile.scale.set(1, 0.32, 1);
      at(pile, 0, 0.006, 0, this.root);
      for (let i = 0; i < 8; i++) at(sphere(0.02 + rnd() * 0.012, contentMat, 8), (rnd() - 0.5) * 0.14, 0.02, (rnd() - 0.5) * 0.14, this.root);
    } else if (sub.state === 'crystals') {
      const g = group(this.root);
      for (let i = 0; i < 14; i++) {
        const s = 0.02 + rnd() * 0.022;
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), contentMat);
        c.position.set((rnd() - 0.5) * 0.15, s * 0.6, (rnd() - 0.5) * 0.15);
        c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        g.add(c);
      }
    } else if (sub.state === 'metal') {
      for (let i = 0; i < 7; i++) {
        const piece = rbox(0.03 + rnd() * 0.03, 0.012 + rnd() * 0.012, 0.025 + rnd() * 0.02, 0.006, contentMat);
        piece.position.set((rnd() - 0.5) * 0.13, 0.012, (rnd() - 0.5) * 0.13);
        piece.rotation.y = rnd() * 3;
        this.root.add(piece);
      }
    } else {
      // chunk
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 0), contentMat);
      chunk.scale.set(1.15, 0.8, 1);
      chunk.position.y = 0.05;
      chunk.rotation.set(0.3, 0.6, 0.1);
      this.root.add(chunk);
      if (sub.id === 'granite') {
        for (let i = 0; i < 10; i++) at(sphere(0.008, i % 2 ? '#2b2b2b' : '#f4c7c3', 6), (rnd() - 0.5) * 0.1, 0.05 + (rnd() - 0.3) * 0.06, 0.04 + rnd() * 0.02, this.root);
      }
      this.topY = 0.11;
    }
  }

  /** UV / luminol glow. */
  setGlow(color: string | null, k = 1): void {
    for (const m of this.contentMats) {
      if (color) {
        m.emissive.set(color);
        m.emissiveIntensity = 1.6 * k;
      } else if (this.sub.glow) {
        m.emissive.set(this.sub.color);
        m.emissiveIntensity = 0.6;
      } else {
        m.emissive.set('#000000');
        m.emissiveIntensity = 0;
      }
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.contentMats) m.dispose();
    const label = this.root.getObjectByName('label') as THREE.Mesh | undefined;
    if (label) {
      const lm = label.material as THREE.MeshStandardMaterial;
      lm.map?.dispose();
      lm.dispose();
    }
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
