import * as THREE from 'three';
import type { AudioEngine } from '../core/audio';
import { Easing, type Tweens } from '../core/tween';
import type { StationId, ToolId } from '../data/types';
import { at, box, capsule, cone, cyl, glassMat, group, lathe, mat, mergeStatic, rbox, sphere, torus, tube, umat } from './kit';
import type { Particles } from './particles';
import { FONT, Screen, canvas, tex } from './textures';

export interface Fx {
  tweens: Tweens;
  add: Particles;
  norm: Particles;
  audio: AudioEngine;
  shake(amount: number): void;
  flash(color: string, k: number): void;
  speed: number;
}

const additive = (color: string, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export abstract class Station {
  readonly root = new THREE.Group();
  abstract readonly id: StationId;
  /** local-space point the camera looks at */
  focusLocal = new THREE.Vector3(0, 0.15, 0);
  /** camera offset from the focus point (world axes) */
  camOffset = new THREE.Vector3(0, 0.42, 0.78);
  ring: THREE.Mesh;
  private pulse = 0;
  private hintOn = false;

  constructor() {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 40), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.003;
    this.ring.renderOrder = 3;
    this.ring.userData.dynamic = true;
    this.root.add(this.ring);
  }

  /** Merge static parts into a few draw calls (call after construction). */
  optimize(): void {
    mergeStatic(this.root);
  }

  focusWorld(): THREE.Vector3 {
    return this.root.localToWorld(this.focusLocal.clone());
  }

  setHint(on: boolean): void {
    this.hintOn = on;
  }

  hover(on: boolean): void {
    this.pulse = on ? 1 : 0;
  }

  update(dt: number, t: number): void {
    const m = this.ring.material as THREE.MeshBasicMaterial;
    const target = this.hintOn ? 0.55 + Math.sin(t * 6) * 0.35 : this.pulse * 0.4;
    m.opacity += (target - m.opacity) * Math.min(1, dt * 10);
    this.ring.visible = m.opacity > 0.01;
  }
}

/** Little glass test tube used by drop tests and probes. */
export class TestTube {
  readonly root = new THREE.Group();
  readonly liquidMat: THREE.MeshStandardMaterial;
  readonly liquid: THREE.Mesh;
  constructor(color = '#ffffff') {
    const glass = lathe([[0, 0.012], [0.012, 0.0], [0.02, 0.006], [0.022, 0.02], [0.022, 0.15], [0.025, 0.155]], glassMat(), 20);
    glass.renderOrder = 2;
    this.root.add(glass);
    this.liquidMat = umat(color, { rough: 0.15, opacity: 0.85 });
    this.liquid = lathe([[0, 0.014], [0.011, 0.004], [0.017, 0.01], [0.018, 0.02], [0.018, 0.07], [0, 0.07]], this.liquidMat, 20);
    this.liquid.renderOrder = 1;
    this.root.add(this.liquid);
  }
  setColor(c: string): void {
    this.liquidMat.color.set(c);
  }
  setFill(k: number): void {
    this.liquid.scale.y = Math.max(0.001, k);
  }
}

// ─────────────────────────────── Bunsen burner ───────────────────────────────
export class Burner extends Station {
  readonly id = 'burner' as const;
  private flame = new THREE.Group();
  private inner: THREE.Mesh;
  private outer: THREE.Mesh;
  private outerMat: THREE.MeshBasicMaterial;
  private innerMat: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  readonly loop = new THREE.Group();
  readonly splint = new THREE.Group();
  private ember: THREE.Mesh;
  private flameSize = 1;
  private colorCycle = false;
  private t = 0;

  constructor() {
    super();
    const metal = mat('#c9ced6', { metal: 0.8, rough: 0.3 });
    at(cyl(0.075, 0.09, 0.03, '#3d405b'), 0, 0.015, 0, this.root);
    at(cyl(0.018, 0.018, 0.2, metal), 0, 0.13, 0, this.root);
    at(cyl(0.024, 0.024, 0.03, '#ffb627'), 0, 0.07, 0, this.root);
    this.root.add(tube([new THREE.Vector3(0.02, 0.05, 0), new THREE.Vector3(0.12, 0.03, 0.04), new THREE.Vector3(0.22, 0.01, 0.12)], 0.012, '#ff7b54'));
    this.flame.position.y = 0.235;
    this.root.add(this.flame);
    this.outerMat = additive('#3d7bff', 0.55);
    this.innerMat = additive('#9fe0ff', 0.8);
    this.outer = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 16, 1, true), this.outerMat);
    this.outer.position.y = 0.07;
    this.inner = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 16, 1, true), this.innerMat);
    this.inner.position.y = 0.03;
    this.flame.add(this.outer, this.inner);
    this.light = new THREE.PointLight('#6fa8ff', 0.25, 0.8, 2);
    this.light.position.y = 0.1;
    this.flame.add(this.light);
    // wire-loop holder
    at(cyl(0.006, 0.006, 0.26, metal), 0.14, 0.13, -0.05, this.root);
    at(cyl(0.035, 0.035, 0.012, '#3d405b'), 0.14, 0.006, -0.05, this.root);
    at(this.loop, 0.14, 0.27, -0.05, this.root);
    const wire = cyl(0.003, 0.003, 0.16, metal);
    wire.rotation.z = Math.PI / 2;
    wire.position.x = -0.06;
    this.loop.add(wire);
    const handle = cyl(0.009, 0.009, 0.06, '#2b2d42');
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.04;
    this.loop.add(handle);
    const ring = torus(0.012, 0.003, metal);
    ring.position.x = -0.145;
    this.loop.add(ring);
    // splint
    this.splint.visible = false;
    const stick = box(0.18, 0.008, 0.008, '#d4a373');
    stick.position.x = -0.09;
    this.splint.add(stick);
    this.ember = sphere(0.008, mat('#ff7b00', { emissive: '#ff5500', emissiveIntensity: 2 }), 8);
    this.ember.position.x = -0.18;
    this.splint.add(this.ember);
    at(this.splint, 0.2, 0.3, 0.05, this.root);
    this.focusLocal.set(0, 0.22, 0);
    this.camOffset.set(0.05, 0.25, 0.7);
    this.flame.userData.dynamic = this.loop.userData.dynamic = this.splint.userData.dynamic = true;
  }

  setFlame(color: string, size = 1, innerColor = '#9fe0ff'): void {
    this.outerMat.color.set(color);
    this.innerMat.color.set(innerColor);
    this.light.color.set(color);
    this.flameSize = size;
    this.colorCycle = false;
  }

  resetFlame(): void {
    this.setFlame('#3d7bff', 1);
    this.outerMat.opacity = 0.55;
  }

  rainbow(): void {
    this.colorCycle = true;
  }

  update(dt: number, t: number): void {
    super.update(dt, t);
    this.t += dt;
    const f = 1 + Math.sin(this.t * 31) * 0.06 + Math.sin(this.t * 17) * 0.05;
    this.flame.scale.set(this.flameSize * (1 + Math.sin(this.t * 23) * 0.04), this.flameSize * f, this.flameSize);
    this.light.intensity = 0.25 * this.flameSize * f;
    if (this.colorCycle) this.outerMat.color.setHSL((this.t * 0.8) % 1, 1, 0.55);
  }

  flameTip(): THREE.Vector3 {
    return this.flame.localToWorld(new THREE.Vector3(0, 0.08, 0));
  }

  async moveLoop(intoFlame: boolean, fx: Fx): Promise<void> {
    const from = this.loop.position.clone();
    const to = intoFlame ? new THREE.Vector3(0.155, 0.285, 0.0) : new THREE.Vector3(0.14, 0.27, -0.05);
    await fx.tweens.run(0.35 / fx.speed, (k) => this.loop.position.lerpVectors(from, to, k), Easing.inOutCubic);
  }
}

// ─────────────────────────────── Reagent rack ───────────────────────────────
const REAGENT_ORDER: ToolId[] = ['iodine', 'acid', 'luminol', 'agno3', 'naoh', 'bacl2'];

export class ReagentRack extends Station {
  readonly id = 'reagents' as const;
  readonly bottles = new Map<ToolId, THREE.Group>();
  readonly tube: TestTube;
  private bottleHome = new Map<ToolId, THREE.Vector3>();

  constructor(colors: Record<string, string>) {
    super();
    const wood = mat('#c08552', { rough: 0.8 });
    at(rbox(0.46, 0.03, 0.18, 0.01, wood), 0, 0.015, 0, this.root);
    at(rbox(0.46, 0.14, 0.02, 0.01, wood), 0, 0.085, -0.08, this.root);
    at(rbox(0.46, 0.02, 0.04, 0.008, wood), 0, 0.09, -0.06, this.root);
    REAGENT_ORDER.forEach((id, i) => {
      const g = group(this.root);
      const x = -0.19 + i * 0.076;
      g.position.set(x, 0.03, -0.01);
      const glass = lathe([[0, 0], [0.026, 0], [0.028, 0.006], [0.028, 0.07], [0.014, 0.09], [0.012, 0.1]], umat(colors[id] ?? '#cccccc', { opacity: 0.7, rough: 0.1 }), 18);
      g.add(glass);
      at(cyl(0.013, 0.013, 0.02, '#1d1d28'), 0, 0.11, 0, g);
      at(capsule(0.012, 0.02, '#2b2d42'), 0, 0.135, 0, g);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.02), new THREE.MeshBasicMaterial({ map: reagentLabel(id) }));
      tag.position.set(0, 0.04, 0.0285);
      g.add(tag);
      g.userData.dynamic = true;
      this.bottles.set(id, g);
      this.bottleHome.set(id, g.position.clone());
    });
    // test-tube holder in front
    at(rbox(0.16, 0.05, 0.05, 0.01, wood), 0.0, 0.025, 0.12, this.root);
    this.tube = new TestTube('#ffffff');
    this.tube.setFill(0.001);
    this.tube.root.userData.dynamic = true;
    at(this.tube.root, 0, 0.02, 0.12, this.root);
    this.focusLocal.set(0, 0.12, 0.06);
    this.camOffset.set(0, 0.3, 0.62);
  }

  setVisible(id: ToolId, v: boolean): void {
    const b = this.bottles.get(id);
    if (b) b.visible = v;
  }

  async pour(color: string, fx: Fx): Promise<void> {
    this.tube.setColor(color);
    fx.audio.play('pour');
    await fx.tweens.run(0.35 / fx.speed, (k) => this.tube.setFill(k), Easing.outQuad);
  }

  async liftBottle(id: ToolId, fx: Fx): Promise<void> {
    const b = this.bottles.get(id)!;
    const home = this.bottleHome.get(id)!;
    const target = new THREE.Vector3(0.03, 0.2, 0.1);
    await fx.tweens.run(0.4 / fx.speed, (k) => {
      b.position.lerpVectors(home, target, k);
      b.rotation.z = k * 2.3;
    }, Easing.inOutCubic);
  }

  async returnBottle(id: ToolId, fx: Fx): Promise<void> {
    const b = this.bottles.get(id)!;
    const home = this.bottleHome.get(id)!;
    const from = b.position.clone();
    await fx.tweens.run(0.35 / fx.speed, (k) => {
      b.position.lerpVectors(from, home, k);
      b.rotation.z = (1 - k) * 2.3;
    }, Easing.inOutCubic);
  }

  dropPoint(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(0.0, 0.19, 0.12));
  }

  tubeTop(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(0, 0.1, 0.12));
  }
}

function reagentLabel(id: ToolId): THREE.CanvasTexture {
  const [c, g] = canvas(96, 40);
  g.fillStyle = '#fffdf3';
  g.fillRect(0, 0, 96, 40);
  g.fillStyle = '#2b2d42';
  g.font = `700 20px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const txt: Record<string, string> = { iodine: 'I₂', acid: 'HCl', luminol: 'LUM', agno3: 'AgNO₃', naoh: 'NaOH', bacl2: 'BaCl₂' };
  g.fillText(txt[id] ?? id, 48, 21);
  return tex(c);
}

// ─────────────────────────────── pH box ───────────────────────────────
export class PhBox extends Station {
  readonly id = 'phbox' as const;
  readonly strip = new THREE.Group();
  readonly stripMat: THREE.MeshStandardMaterial;
  private home = new THREE.Vector3(0.0, 0.07, 0.0);

  constructor() {
    super();
    at(rbox(0.12, 0.05, 0.08, 0.008, '#ffd23f'), 0, 0.025, 0, this.root);
    at(rbox(0.122, 0.012, 0.082, 0.004, '#ff6b6b'), 0, 0.053, 0, this.root);
    // colour chart card
    const [c, g] = canvas(256, 80);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 80);
    ['#e53935', '#fb8c00', '#43a047', '#1e88e5', '#7b1fa2'].forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(8 + i * 49, 10, 42, 42);
    });
    g.fillStyle = '#2b2d42';
    g.font = `700 18px ${FONT}`;
    g.fillText('ACID   ←   pH   →   BASE', 20, 72);
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0625), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.7 }));
    chart.rotation.x = -Math.PI / 2 + 0.5;
    chart.position.set(0.0, 0.04, 0.09);
    this.root.add(chart);
    at(box(0.2, 0.06, 0.01, '#ffffff'), 0, 0.02, 0.1, this.root).rotation.x = -0.9;
    this.stripMat = umat('#fff8dc', { rough: 0.8 });
    const s = box(0.012, 0.11, 0.003, this.stripMat);
    s.position.y = 0.055;
    this.strip.add(s);
    this.strip.position.copy(this.home);
    this.strip.visible = false;
    this.strip.userData.dynamic = true;
    this.root.add(this.strip);
    this.focusLocal.set(0, 0.06, 0.05);
    this.camOffset.set(0, 0.32, 0.55);
  }

  async dip(targetWorld: THREE.Vector3, color: string, fx: Fx): Promise<void> {
    this.strip.visible = true;
    this.stripMat.color.set('#fff8dc');
    const start = this.home.clone();
    const above = this.root.worldToLocal(targetWorld.clone().add(new THREE.Vector3(0, 0.16, 0)));
    const inside = this.root.worldToLocal(targetWorld.clone().add(new THREE.Vector3(0, -0.04, 0)));
    await fx.tweens.run(0.45 / fx.speed, (k) => this.strip.position.lerpVectors(start, above, k), Easing.inOutCubic);
    await fx.tweens.run(0.25 / fx.speed, (k) => this.strip.position.lerpVectors(above, inside, k), Easing.inQuad);
    const c0 = new THREE.Color('#fff8dc');
    const c1 = new THREE.Color(color);
    fx.audio.play('bubble');
    await fx.tweens.run(0.35 / fx.speed, (k) => this.stripMat.color.lerpColors(c0, c1, k));
    await fx.tweens.run(0.25 / fx.speed, (k) => this.strip.position.lerpVectors(inside, above, k), Easing.outQuad);
  }

  async putBack(fx: Fx): Promise<void> {
    const from = this.strip.position.clone();
    await fx.tweens.run(0.35 / fx.speed, (k) => this.strip.position.lerpVectors(from, this.home, k), Easing.inOutCubic);
    this.strip.visible = false;
  }
}

// ─────────────────────────────── Conductivity ───────────────────────────────
export class Conductivity extends Station {
  readonly id = 'conductivity' as const;
  readonly beaker: TestTube;
  private bulbMat: THREE.MeshStandardMaterial;
  private bulbLight: THREE.PointLight;
  private probes = new THREE.Group();
  private needle = new THREE.Group();

  constructor() {
    super();
    at(rbox(0.16, 0.08, 0.1, 0.012, '#4b7bec'), 0, 0.04, -0.03, this.root);
    // dial face
    const face = cyl(0.03, 0.03, 0.005, '#ffffff');
    face.rotation.x = Math.PI / 2;
    at(face, -0.035, 0.045, 0.022, this.root);
    at(this.needle, -0.035, 0.035, 0.026, this.root);
    const n = box(0.003, 0.028, 0.002, '#e63946');
    n.position.y = 0.014;
    this.needle.add(n);
    this.needle.rotation.z = 0.8;
    // bulb
    at(cyl(0.012, 0.014, 0.02, '#b0b0b0', 12), 0.04, 0.09, -0.03, this.root);
    this.bulbMat = umat('#fff7d1', { opacity: 0.85, rough: 0.1, emissive: '#000000' });
    at(sphere(0.026, this.bulbMat, 16), 0.04, 0.12, -0.03, this.root);
    this.bulbLight = new THREE.PointLight('#ffe9a3', 0, 0.8, 2);
    this.bulbLight.position.set(0.04, 0.13, -0.03);
    this.root.add(this.bulbLight);
    // probes
    for (const [x, c] of [[-0.012, '#e63946'], [0.012, '#1d1d28']] as [number, string][]) {
      const p = cyl(0.004, 0.004, 0.12, mat(c));
      p.position.set(x, 0, 0);
      this.probes.add(p);
    }
    this.probes.position.set(0.11, 0.2, 0.08);
    this.root.add(this.probes);
    this.root.add(tube([new THREE.Vector3(0.07, 0.06, 0.0), new THREE.Vector3(0.12, 0.2, 0.0), new THREE.Vector3(0.11, 0.26, 0.08)], 0.004, '#e63946'));
    this.beaker = new TestTube('#ffffff');
    this.beaker.root.scale.set(1.6, 0.8, 1.6);
    this.beaker.setFill(0.001);
    this.beaker.root.userData.dynamic = this.probes.userData.dynamic = this.needle.userData.dynamic = true;
    at(this.beaker.root, 0.11, 0.0, 0.08, this.root);
    this.focusLocal.set(0.04, 0.08, 0.03);
    this.camOffset.set(0, 0.3, 0.6);
  }

  async test(level: 'high' | 'low' | 'none', color: string, fx: Fx): Promise<void> {
    this.beaker.setColor(color);
    await fx.tweens.run(0.3 / fx.speed, (k) => this.beaker.setFill(k));
    const from = this.probes.position.clone();
    const to = from.clone().add(new THREE.Vector3(0, -0.12, 0));
    await fx.tweens.run(0.3 / fx.speed, (k) => this.probes.position.lerpVectors(from, to, k), Easing.inOutQuad);
    const intensity = level === 'high' ? 1 : level === 'low' ? 0.3 : 0;
    if (intensity > 0) fx.audio.play('zap');
    if (level === 'high') fx.add.emit({ pos: this.root.localToWorld(new THREE.Vector3(0.11, 0.06, 0.08)), count: 25, color: ['#fff7a0', '#9fe0ff'], speed: 0.6, spread: 1, life: 0.35, size: 0.025, gravity: 1 });
    await fx.tweens.run(0.5 / fx.speed, (k) => {
      this.bulbMat.emissive.set('#ffd34d');
      this.bulbMat.emissiveIntensity = intensity * 2.5 * k;
      this.bulbLight.intensity = intensity * 1.5 * k;
      this.needle.rotation.z = 0.8 - intensity * 1.6 * k;
    });
    await fx.tweens.wait(0.5 / fx.speed);
    await fx.tweens.run(0.3 / fx.speed, (k) => this.probes.position.lerpVectors(to, from, k));
  }

  reset(): void {
    this.bulbMat.emissiveIntensity = 0;
    this.bulbLight.intensity = 0;
    this.needle.rotation.z = 0.8;
    this.beaker.setFill(0.001);
  }
}

// ─────────────────────────────── Microscope ───────────────────────────────
export class Microscope extends Station {
  readonly id = 'microscope' as const;
  private stageLight: THREE.MeshStandardMaterial;
  readonly slide: THREE.Mesh;
  constructor() {
    super();
    const body = mat('#f2f2f2', { rough: 0.4 });
    const dark = mat('#2b2d42', { rough: 0.5 });
    at(rbox(0.16, 0.025, 0.2, 0.01, body), 0, 0.0125, 0, this.root);
    const arm = rbox(0.04, 0.26, 0.05, 0.015, body);
    arm.position.set(0, 0.15, -0.07);
    arm.rotation.x = 0.12;
    this.root.add(arm);
    at(rbox(0.13, 0.012, 0.11, 0.004, dark), 0, 0.1, 0.01, this.root);
    this.stageLight = umat('#ffffff', { emissive: '#000000' });
    at(cyl(0.015, 0.015, 0.004, this.stageLight), 0, 0.107, 0.01, this.root);
    const tubeM = cyl(0.025, 0.025, 0.16, dark);
    tubeM.position.set(0, 0.24, -0.02);
    tubeM.rotation.x = -0.35;
    this.root.add(tubeM);
    at(cyl(0.012, 0.016, 0.04, mat('#c9ced6', { metal: 0.8, rough: 0.3 })), 0, 0.14, 0.01, this.root);
    const eye = cyl(0.018, 0.018, 0.05, dark);
    eye.position.set(0, 0.33, 0.015);
    eye.rotation.x = -0.35;
    this.root.add(eye);
    for (const s of [-1, 1]) {
      const knob = cyl(0.025, 0.025, 0.015, '#ffb627');
      knob.rotation.z = Math.PI / 2;
      at(knob, s * 0.03, 0.16, -0.07, this.root);
    }
    this.slide = box(0.07, 0.003, 0.025, mat('#dff6ff', { opacity: 0.6 }));
    this.slide.visible = false;
    this.slide.userData.dynamic = true;
    at(this.slide, 0, 0.11, 0.01, this.root);
    this.focusLocal.set(0, 0.2, 0);
    this.camOffset.set(0.0, 0.25, 0.5);
  }
  async place(color: string, fx: Fx): Promise<void> {
    this.slide.visible = true;
    (this.slide.material as THREE.MeshStandardMaterial).color.set(color);
    const y0 = 0.3;
    await fx.tweens.run(0.35 / fx.speed, (k) => (this.slide.position.y = y0 + (0.11 - y0) * k), Easing.outBounce);
    this.stageLight.emissive.set('#fff7d1');
    this.stageLight.emissiveIntensity = 2;
  }
  reset(): void {
    this.slide.visible = false;
    this.stageLight.emissiveIntensity = 0;
  }
}

// ─────────────────────────────── Scale ───────────────────────────────
export class Scale extends Station {
  readonly id = 'scale' as const;
  readonly screen = new Screen(256, 96);
  readonly vial: TestTube;
  constructor() {
    super();
    at(rbox(0.2, 0.04, 0.16, 0.01, '#e6e9ef'), 0, 0.02, 0, this.root);
    at(cyl(0.065, 0.065, 0.008, mat('#c9ced6', { metal: 0.8, rough: 0.25 })), 0, 0.044, -0.01, this.root);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.0375), new THREE.MeshBasicMaterial({ map: this.screen.texture }));
    disp.rotation.x = -0.6;
    disp.position.set(0, 0.035, 0.07);
    this.root.add(disp);
    at(rbox(0.11, 0.008, 0.045, 0.003, '#2b2d42'), 0, 0.03, 0.068, this.root).rotation.x = -0.6;
    this.screen.text('0.00', '#7dffb2', 56);
    this.vial = new TestTube('#ffffff');
    this.vial.root.visible = false;
    this.vial.root.userData.dynamic = true;
    at(this.vial.root, 0, 0.05, -0.01, this.root);
    this.focusLocal.set(0, 0.06, 0.02);
    this.camOffset.set(0, 0.3, 0.5);
  }
  async weigh(color: string, finalText: string, fx: Fx): Promise<void> {
    this.vial.root.visible = true;
    this.vial.setColor(color);
    this.vial.setFill(0.9);
    await fx.tweens.run(0.3 / fx.speed, (k) => (this.vial.root.position.y = 0.2 - 0.15 * k), Easing.outBounce);
    let last = 0;
    await fx.tweens.run(0.8 / fx.speed, (k) => {
      if (k - last > 0.08) {
        last = k;
        this.screen.text((Math.random() * 9).toFixed(2), '#7dffb2', 56);
        fx.audio.play('tick');
      }
    });
    this.screen.text(finalText, '#ffd23f', finalText.length > 9 ? 30 : 40);
    fx.audio.play('beep');
  }
  reset(): void {
    this.vial.root.visible = false;
    this.screen.text('0.00', '#7dffb2', 56);
  }
}

// ─────────────────────────────── UV lamp ───────────────────────────────
export class UvLamp extends Station {
  readonly id = 'uvlamp' as const;
  private tubeMat: THREE.MeshStandardMaterial;
  readonly light: THREE.PointLight;
  readonly head = new THREE.Group();
  constructor() {
    super();
    at(cyl(0.06, 0.07, 0.02, '#1d1d28'), 0, 0.01, 0, this.root);
    at(cyl(0.008, 0.008, 0.24, mat('#c9ced6', { metal: 0.8, rough: 0.3 })), 0, 0.13, 0, this.root);
    at(this.head, 0, 0.25, 0.03, this.root);
    this.head.rotation.x = 0.5;
    this.head.add(rbox(0.18, 0.04, 0.06, 0.012, '#1d1d28'));
    this.tubeMat = umat('#b388ff', { emissive: '#7c4dff', emissiveIntensity: 0.2 });
    const tb = cyl(0.01, 0.01, 0.15, this.tubeMat, 12);
    tb.rotation.z = Math.PI / 2;
    tb.position.y = -0.02;
    this.head.add(tb);
    this.light = new THREE.PointLight('#8c5cff', 0, 1.6, 1.5);
    this.light.position.set(0, -0.05, 0.05);
    this.head.add(this.light);
    this.focusLocal.set(0, 0.15, 0.05);
    this.camOffset.set(0, 0.32, 0.62);
  }
  setOn(k: number): void {
    this.tubeMat.emissiveIntensity = 0.2 + 3 * k;
    this.light.intensity = 2.2 * k;
  }
}

// ─────────────────────────────── Geiger counter ───────────────────────────────
export class Geiger extends Station {
  readonly id = 'geiger' as const;
  private needle = new THREE.Group();
  private led: THREE.MeshStandardMaterial;
  private level = -1;
  private clickT = 0;
  private running = false;
  private progress = 0;
  constructor() {
    super();
    at(rbox(0.16, 0.1, 0.1, 0.015, '#ffd23f'), 0, 0.05, 0, this.root);
    at(rbox(0.1, 0.02, 0.02, 0.008, '#2b2d42'), 0, 0.115, 0, this.root);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24, 0, Math.PI), mat('#ffffff'));
    face.position.set(-0.02, 0.045, 0.051);
    this.root.add(face);
    at(this.needle, -0.02, 0.045, 0.053, this.root);
    const n = box(0.003, 0.03, 0.002, '#e63946');
    n.position.y = 0.015;
    this.needle.add(n);
    this.needle.rotation.z = 1.3;
    this.needle.userData.dynamic = true;
    this.led = umat('#2ecc71', { emissive: '#000000' });
    at(sphere(0.008, this.led, 10), 0.045, 0.07, 0.051, this.root);
    // trefoil sticker
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1d1d28';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(32, 32);
      g.arc(32, 32, 28, (i * 2 * Math.PI) / 3 - 0.5, (i * 2 * Math.PI) / 3 + 0.5);
      g.fill();
    }
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(32, 32, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1d1d28';
    g.beginPath();
    g.arc(32, 32, 6, 0, Math.PI * 2);
    g.fill();
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.035), new THREE.MeshBasicMaterial({ map: tex(c) }));
    sticker.position.set(0.045, 0.035, 0.051);
    this.root.add(sticker);
    // wand
    const wand = capsule(0.018, 0.12, '#2b2d42');
    wand.rotation.z = Math.PI / 2;
    at(wand, 0.02, 0.14, -0.02, this.root);
    this.focusLocal.set(0, 0.07, 0.03);
    this.camOffset.set(0, 0.25, 0.5);
  }
  start(level: number): void {
    this.level = level;
    this.running = true;
    this.progress = 0;
  }
  setProgress(k: number): void {
    this.progress = k;
  }
  stop(): void {
    this.running = false;
  }
  reset(): void {
    this.level = -1;
    this.running = false;
    this.needle.rotation.z = 1.3;
    this.led.emissiveIntensity = 0;
  }
  tickAudio(dt: number, audio: AudioEngine): void {
    if (!this.running || this.level < 0) return;
    const rate = [1.2, 5, 16, 45][this.level];
    this.clickT -= dt;
    if (this.clickT <= 0) {
      this.clickT = (Math.random() * 2) / rate;
      audio.play('geiger');
      this.led.emissive.set(['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'][this.level]);
      this.led.emissiveIntensity = 3;
    }
  }
  update(dt: number, t: number): void {
    super.update(dt, t);
    this.led.emissiveIntensity *= Math.exp(-dt * 12);
    if (this.level >= 0) {
      const target = 1.3 - (this.level / 3) * 2.4 * Math.min(1, this.progress * 1.5) + Math.sin(t * 40) * 0.05 * this.level;
      this.needle.rotation.z += (target - this.needle.rotation.z) * Math.min(1, dt * 8);
    }
  }
}

// ─────────────────────────────── Mass spectrometer ───────────────────────────────
export class MassSpec extends Station {
  readonly id = 'massspec' as const;
  readonly screen = new Screen(256, 160);
  private leds: THREE.MeshStandardMaterial[] = [];
  private running = false;
  constructor() {
    super();
    at(rbox(0.42, 0.34, 0.32, 0.03, '#eef1f5'), 0, 0.17, 0, this.root);
    at(rbox(0.43, 0.06, 0.33, 0.02, '#4b7bec'), 0, 0.31, 0, this.root);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1375), new THREE.MeshBasicMaterial({ map: this.screen.texture }));
    disp.position.set(-0.05, 0.19, 0.161);
    this.root.add(disp);
    at(rbox(0.24, 0.155, 0.01, 0.01, '#2b2d42'), -0.05, 0.19, 0.157, this.root);
    for (let i = 0; i < 4; i++) {
      const m = umat(['#ff4d4d', '#ffd23f', '#2ecc71', '#4da6ff'][i], { emissive: '#000000' });
      this.leds.push(m);
      at(sphere(0.008, m, 8), 0.12, 0.24 - i * 0.03, 0.162, this.root);
    }
    at(cyl(0.025, 0.025, 0.03, '#2b2d42'), 0.12, 0.08, 0.16, this.root).rotation.x = Math.PI / 2;
    this.screen.text('READY', '#7dffb2', 48);
    const [c, g] = canvas(512, 96);
    g.fillStyle = '#4b7bec';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#ffffff';
    g.font = `700 52px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SPECTROTRON 3000', 256, 50, 480);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshBasicMaterial({ map: tex(c) }));
    name.position.set(0, 0.31, 0.167);
    this.root.add(name);
    this.focusLocal.set(-0.03, 0.19, 0.1);
    this.camOffset.set(-0.05, 0.25, 0.65);
  }
  start(): void {
    this.running = true;
  }
  stop(): void {
    this.running = false;
    for (const l of this.leds) l.emissiveIntensity = 0;
  }
  reset(): void {
    this.stop();
    this.screen.text('READY', '#7dffb2', 48);
  }
  update(dt: number, t: number): void {
    super.update(dt, t);
    if (this.running) this.leds.forEach((l, i) => {
      l.emissive.copy(l.color);
      l.emissiveIntensity = Math.sin(t * 12 + i * 1.7) > 0.3 ? 2 : 0;
    });
  }
}

// ─────────────────────────────── Magnet ───────────────────────────────
export class Magnet extends Station {
  readonly id = 'magnet' as const;
  readonly mag = new THREE.Group();
  private home = new THREE.Vector3(0, 0.03, 0);
  constructor() {
    super();
    const red = mat('#e63946', { rough: 0.35 });
    const arc = torus(0.05, 0.02, red, Math.PI);
    this.mag.add(arc);
    for (const s of [-1, 1]) {
      at(box(0.04, 0.06, 0.04, red), s * 0.05, -0.03, 0, this.mag);
      at(box(0.041, 0.02, 0.041, mat('#dfe4ea', { metal: 0.9, rough: 0.2 })), s * 0.05, -0.07, 0, this.mag);
    }
    this.mag.rotation.x = -Math.PI / 2;
    this.mag.userData.dynamic = true;
    this.mag.position.copy(this.home);
    this.root.add(this.mag);
    this.focusLocal.set(0, 0.04, 0);
    this.camOffset.set(0, 0.35, 0.55);
  }
  async swingTo(targetWorld: THREE.Vector3, fx: Fx): Promise<void> {
    const start = this.mag.position.clone();
    const target = this.root.worldToLocal(targetWorld.clone().add(new THREE.Vector3(0, 0.2, 0)));
    const r0 = this.mag.rotation.x;
    await fx.tweens.run(0.55 / fx.speed, (k) => {
      this.mag.position.lerpVectors(start, target, k);
      this.mag.position.y += Math.sin(k * Math.PI) * 0.1;
      this.mag.rotation.x = r0 + (0 - r0) * k;
    }, Easing.inOutCubic);
  }
  async goHome(fx: Fx): Promise<void> {
    const start = this.mag.position.clone();
    const r0 = this.mag.rotation.x;
    await fx.tweens.run(0.45 / fx.speed, (k) => {
      this.mag.position.lerpVectors(start, this.home, k);
      this.mag.rotation.x = r0 + (-Math.PI / 2 - r0) * k;
    }, Easing.inOutCubic);
  }
}

export function makeStations(reagentColors: Record<string, string>) {
  return {
    burner: new Burner(),
    reagents: new ReagentRack(reagentColors),
    phbox: new PhBox(),
    conductivity: new Conductivity(),
    microscope: new Microscope(),
    scale: new Scale(),
    uvlamp: new UvLamp(),
    geiger: new Geiger(),
    massspec: new MassSpec(),
    magnet: new Magnet(),
  };
}

export type Stations = ReturnType<typeof makeStations>;

export { cone };
