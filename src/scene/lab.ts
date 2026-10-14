import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { audio } from '../core/audio';
import { Easing, Tweens } from '../core/tween';
import { clamp, lerp } from '../core/util';
import { DT_CAP } from '../config';
import type { ClientDef, StationId, Substance, ToolId } from '../data/types';
import { TOOL_MAP } from '../data/tools';
import { FLAME_INFO } from '../data/tools';
import type { Quality } from '../game/shift';
import type { Reading } from '../game/deduction';
import { Character } from './characters';
import { Gerald } from './gerald';
import { makeStations, type Fx, type Station, type Stations } from './instruments';
import { Particles } from './particles';
import { BENCH_Y, Room } from './room';
import { SampleView } from './sample';

type Pose = 'overview' | 'client' | 'sample' | 'menu' | 'map' | StationId;

const LAYOUT: Record<Exclude<StationId, 'nose'>, [number, number, number]> = {
  burner: [-1.5, -0.38, 0.3],
  reagents: [-0.98, -0.84, 0.18],
  phbox: [-0.62, -0.1, 0.2],
  conductivity: [-0.42, -0.78, 0.1],
  microscope: [0.48, -0.82, -0.25],
  scale: [0.72, -0.1, -0.2],
  uvlamp: [1.08, -0.72, -0.35],
  geiger: [1.42, -0.25, -0.4],
  massspec: [1.85, -0.98, -0.45],
  magnet: [-1.12, 0.03, 0.4],
};

const SAMPLE_POS = new THREE.Vector3(0, BENCH_Y + 0.012, -0.05);
const CLIENT_POS = new THREE.Vector3(0, 0.62, -3.0);

export const TOOL_STATION: Record<ToolId, StationId> = {
  ph: 'phbox', sniff: 'nose', flame: 'burner', splint: 'burner', microscope: 'microscope',
  iodine: 'reagents', acid: 'reagents', luminol: 'reagents', agno3: 'reagents', naoh: 'reagents', bacl2: 'reagents',
  conduct: 'conductivity', magnet: 'magnet', uv: 'uvlamp', density: 'scale', geiger: 'geiger', massspec: 'massspec',
};

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export class LabScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
  readonly tweens = new Tweens();
  readonly room = new Room();
  readonly stations: Stations;
  readonly gerald = new Gerald();
  readonly add = new Particles(700, true);
  readonly norm = new Particles(500, false);
  client: Character | null = null;
  sample: SampleView | null = null;
  onStationClick: (id: StationId) => void = () => {};
  paused = false;
  /** game paused: keep drawing the frame, but hold every animation in place */
  frozen = false;
  speed = 1;

  private container: HTMLElement;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private flashEl: HTMLDivElement;
  private camPos = new THREE.Vector3(0, 2.05, 1.65);
  private camTarget = new THREE.Vector3(0, 1.12, -0.75);
  private pose: Pose = 'menu';
  private orbit = 0;
  private shakeAmt = 0;
  private dim = 0;
  private night = false;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private width = 1;
  private height = 1;
  private last = performance.now();
  private t = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: Station | null = null;
  private down: { x: number; y: number } | null = null;
  private visibleStations = new Set<StationId>();
  private fpsSamples: number[] = [];
  private quality: 'auto' | 'low' | 'high' = 'auto';
  private machineTools = new Map<ToolId, { end: number; dur: number; peak?: number; label?: string }>();
  private fxObj: Fx;
  private uvLight = new THREE.PointLight('#8c5cff', 0, 1.2, 1.5);

  constructor(container: HTMLElement, opts: { antialias?: boolean } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: opts.antialias ?? true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'lab-canvas';
    container.appendChild(this.renderer.domElement);
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'flash';
    container.appendChild(this.flashEl);

    this.scene.background = new THREE.Color('#9fdcff');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    this.hemi = new THREE.HemisphereLight('#ffffff', '#c9b79c', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.0);
    this.sun.position.set(2.5, 5, 3);
    this.sun.target.position.set(0, 1, -0.7);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -3.2;
    sc.right = 3.2;
    sc.top = 2.8;
    sc.bottom = -2.2;
    sc.near = 1;
    sc.far = 14;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.room.root);
    this.stations = makeStations(Object.fromEntries(Object.values(TOOL_MAP).filter((t) => t.reagentColor).map((t) => [t.id, t.reagentColor!])));
    for (const [id, st] of Object.entries(this.stations) as [Exclude<StationId, 'nose'>, Station][]) {
      const [x, z, ry] = LAYOUT[id];
      st.root.position.set(x, BENCH_Y, z);
      st.root.rotation.y = ry;
      st.root.userData.station = id;
      st.optimize();
      st.root.visible = false;
      this.scene.add(st.root);
    }
    this.gerald.root.position.set(0.44, BENCH_Y, -0.36);
    this.gerald.root.rotation.y = -0.45;
    this.gerald.root.scale.setScalar(1.25);
    this.scene.add(this.gerald.root);
    this.scene.add(this.add.points, this.norm.points);
    this.uvLight.position.copy(SAMPLE_POS).add(new THREE.Vector3(0.15, 0.45, 0.25));
    this.scene.add(this.uvLight);

    this.fxObj = {
      tweens: this.tweens,
      add: this.add,
      norm: this.norm,
      audio,
      shake: (a) => this.shake(a),
      flash: (c, k) => this.flash(c, k),
      speed: 1,
    };

    this.setQuality('auto');
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();
    this.bindPointer();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    requestAnimationFrame(() => this.frame());
  }

  get fx(): Fx {
    this.fxObj.speed = this.speed;
    return this.fxObj;
  }

  // ───────────────────────── setup / settings ─────────────────────────

  setQuality(q: 'auto' | 'low' | 'high'): void {
    this.quality = q;
    const low = q === 'low';
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(low ? Math.min(dpr, 1) : Math.min(dpr, q === 'high' ? 2 : 1.5));
    const size = low ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as any).map = null;
    }
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.shadow.radius = low ? 1 : 3;
    this.resize();
  }

  setTheme(colors: [string, string, string, string]): void {
    this.room.applyTheme(colors);
  }

  setHat(id: string): void {
    this.gerald.setHat(id);
  }

  setNight(n: boolean): void {
    this.night = n;
    this.room.setNight(n);
    this.scene.background = new THREE.Color(n ? '#1b1f4a' : '#9fdcff');
  }

  /** Show only the instruments the player owns (with a pop-in animation for new ones). */
  setTools(tools: ToolId[], animateNew = false): void {
    const want = new Set<StationId>(tools.map((t) => TOOL_STATION[t]));
    for (const [id, st] of Object.entries(this.stations) as [StationId, Station][]) {
      const show = want.has(id);
      const was = this.visibleStations.has(id);
      st.root.visible = show;
      if (show && !was && animateNew) {
        st.root.scale.setScalar(0.01);
        void this.tweens.run(0.6, (k) => st.root.scale.setScalar(Math.max(0.01, k)), Easing.outBack);
        this.add.emit({ pos: st.root.position.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 40, color: ['#ffd23f', '#ffffff', '#21c7a8'], speed: 1.2, spread: 1, life: 0.9, size: 0.04, gravity: 1.5 });
      } else if (show) st.root.scale.setScalar(1);
    }
    this.visibleStations = want;
    for (const id of ['iodine', 'acid', 'luminol', 'agno3', 'naoh', 'bacl2'] as ToolId[]) this.stations.reagents.setVisible(id, tools.includes(id));
  }

  setInsets(i: Insets): void {
    const o = this.insets;
    if (o.top === i.top && o.right === i.right && o.bottom === i.bottom && o.left === i.left) return;
    this.insets = i;
    this.resize();
  }

  setClock(k: number): void {
    this.room.setClock(clamp(k, 0, 1));
  }

  setAccidentDays(n: number): void {
    this.room.accidentSign.set(n);
  }

  setHint(station: StationId | null): void {
    for (const st of Object.values(this.stations) as Station[]) st.setHint(st.id === station);
  }

  // ───────────────────────── camera ─────────────────────────

  private poseFor(p: Pose): { pos: THREE.Vector3; target: THREE.Vector3; need: number } {
    switch (p) {
      case 'overview': {
        const narrow = this.safeAspect() < 1.1;
        return { pos: new THREE.Vector3(0.1, 2.0, 1.3), target: new THREE.Vector3(0.1, 1.08, -0.7), need: narrow ? 1.25 : 1.75 };
      }
      case 'client':
        // look slightly above the head so the face sits below the speech box
        return { pos: new THREE.Vector3(0, 2.05, 0.9), target: new THREE.Vector3(0, 1.9, -2.6), need: 1.45 };
      case 'sample':
        // aim a little low so the sample sits above the mini-game panel
        return { pos: new THREE.Vector3(-0.12, 1.5, 0.8), target: SAMPLE_POS.clone().add(new THREE.Vector3(0, 0.02, 0)), need: 0.5 };
      case 'menu': {
        const a = Math.sin(this.orbit * 0.12) * 0.35;
        const target = new THREE.Vector3(0, 1.3, -1.2);
        return { pos: new THREE.Vector3(Math.sin(a) * 3.4, 2.2, Math.cos(a) * 3.4 - 1.2 + 0.4), target, need: 2.3 };
      }
      case 'map':
        return { pos: new THREE.Vector3(-1.2, 2.4, 1.4), target: new THREE.Vector3(0.2, 1.4, -1.6), need: 2.2 };
      case 'nose':
        return this.poseFor('sample');
      default: {
        const st = this.stations[p as Exclude<StationId, 'nose'>];
        // aim below the instrument so it sits in the upper half (the mini-game panel covers the lower part)
        const drop = new THREE.Vector3(0, -0.1, 0);
        let target = st.focusWorld().add(drop);
        // tools that reach over to the sample: frame both the instrument and the sample mat
        if (p === 'phbox' || p === 'magnet') {
          target = target.lerp(SAMPLE_POS.clone().add(new THREE.Vector3(0, 0.0, 0)), 0.5);
          return { pos: target.clone().add(new THREE.Vector3(0, 0.5, 0.85)), target, need: 0.6 };
        }
        return { pos: target.clone().add(st.camOffset), target, need: 0.38 };
      }
    }
  }

  private safeAspect(): number {
    const safeW = Math.max(100, this.width - this.insets.left - this.insets.right);
    const safeH = Math.max(100, this.height - this.insets.top - this.insets.bottom);
    return safeW / safeH;
  }

  /** Scale camera distance so the important part fits the visible (safe) area. */
  private fitPose(p: { pos: THREE.Vector3; target: THREE.Vector3; need: number }): THREE.Vector3 {
    const safeW = Math.max(100, this.width - this.insets.left - this.insets.right);
    const safeH = Math.max(100, this.height - this.insets.top - this.insets.bottom);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const fullH = this.height + Math.abs(this.insets.top - this.insets.bottom);
    const visibleFrac = safeH / fullH;
    const halfH = Math.tan(vfov / 2) * visibleFrac;
    const halfW = halfH * (safeW / safeH);
    const dist = p.pos.distanceTo(p.target);
    const needDist = p.need / Math.max(0.05, halfW);
    const k = Math.max(1, needDist / dist);
    return p.target.clone().add(p.pos.clone().sub(p.target).multiplyScalar(k));
  }

  async focus(p: Pose, dur = 0.7): Promise<void> {
    this.pose = p;
    const tgt = this.poseFor(p);
    const pos = this.fitPose(tgt);
    const p0 = this.camPos.clone();
    const t0 = this.camTarget.clone();
    await this.tweens.run(dur / this.speed, (k) => {
      this.camPos.lerpVectors(p0, pos, k);
      this.camTarget.lerpVectors(t0, tgt.target, k);
    }, Easing.inOutCubic, 0, 'cam');
  }

  snap(p: Pose): void {
    this.pose = p;
    const tgt = this.poseFor(p);
    this.camPos.copy(this.fitPose(tgt));
    this.camTarget.copy(tgt.target);
  }

  shake(a: number): void {
    if (document.body.classList.contains('no-shake')) a *= 0.2;
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  flash(color: string, k: number): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = String(k);
    void this.flashEl.offsetWidth;
    this.flashEl.style.transition = 'opacity 0.6s ease-out';
    this.flashEl.style.opacity = '0';
  }

  async setDim(target: number, dur = 0.4): Promise<void> {
    const from = this.dim;
    await this.tweens.run(dur, (k) => (this.dim = lerp(from, target, k)));
  }

  // ───────────────────────── characters & samples ─────────────────────────

  async clientEnter(def: ClientDef): Promise<void> {
    if (this.client) this.removeClient();
    const c = new Character(def.look);
    c.root.position.copy(CLIENT_POS).add(new THREE.Vector3(0, -1.0, 0));
    this.scene.add(c.root);
    this.client = c;
    audio.play('appear');
    await this.tweens.run(0.55 / this.speed, (k) => (c.root.position.y = CLIENT_POS.y - 1.0 * (1 - k)), Easing.outBack);
    c.react('surprised');
    await this.tweens.wait(0.25);
    c.setExpression('neutral');
  }

  async clientLeave(): Promise<void> {
    const c = this.client;
    if (!c) return;
    const y0 = c.root.position.y;
    const x0 = c.root.position.x;
    audio.play('swoosh');
    await this.tweens.run(0.45 / this.speed, (k) => {
      c.root.position.y = y0 - 1.1 * k;
      c.root.position.x = x0 + 0.6 * k;
    }, Easing.inQuad);
    this.removeClient();
  }

  removeClient(): void {
    if (!this.client) return;
    this.scene.remove(this.client.root);
    this.client.dispose();
    this.client = null;
  }

  clientTalk(sec: number): void {
    this.client?.talk(sec);
  }

  clientReact(kind: 'happy' | 'angry' | 'surprised'): void {
    if (!this.client) return;
    this.client.react(kind);
    if (kind === 'angry') {
      const head = this.client.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      for (const s of [-1, 1]) this.norm.emit({ pos: head.clone().add(new THREE.Vector3(s * 0.2, 0, 0)), count: 14, color: '#ffffff', speed: 0.5, spread: 0.3, dir: new THREE.Vector3(s * 0.5, 1, 0), life: 1, size: 0.09, grow: 2.2 });
    }
    if (kind === 'happy') {
      const head = this.client.root.position.clone().add(new THREE.Vector3(0, 1.3, 0.3));
      this.add.emit({ pos: head, count: 30, color: ['#ffd23f', '#ff7eb6', '#7bed9f', '#4da6ff'], speed: 1.6, spread: 0.9, life: 1.2, size: 0.05, gravity: 2 });
    }
  }

  async showSample(sub: Substance, label: string): Promise<void> {
    this.removeSample();
    const s = new SampleView(sub, label);
    this.sample = s;
    s.root.position.set(0, 1.08, -2.45);
    s.root.userData.station = 'nose';
    this.scene.add(s.root);
    // slide from the drop-off counter onto the sample mat
    const from = s.root.position.clone();
    await this.tweens.run(0.7 / this.speed, (k) => {
      s.root.position.lerpVectors(from, SAMPLE_POS, k);
      s.root.position.y += Math.sin(k * Math.PI) * 0.35;
      s.root.rotation.y = (1 - k) * Math.PI;
    }, Easing.inOutCubic);
    audio.play('pop');
    this.norm.emit({ pos: SAMPLE_POS.clone(), count: 10, color: '#ffffff', speed: 0.4, spread: 1, life: 0.5, size: 0.05 });
  }

  removeSample(): void {
    if (!this.sample) return;
    this.scene.remove(this.sample.root);
    this.sample.dispose();
    this.sample = null;
  }

  async tossSample(): Promise<void> {
    const s = this.sample;
    if (!s) return;
    const from = s.root.position.clone();
    await this.tweens.run(0.4 / this.speed, (k) => {
      s.root.position.set(from.x + 1.4 * k, from.y + Math.sin(k * Math.PI) * 0.3 - 0.2 * k, from.z - 0.2 * k);
      s.root.scale.setScalar(1 - k * 0.9);
    }, Easing.inQuad);
    this.removeSample();
  }

  sampleTop(): THREE.Vector3 {
    const s = this.sample;
    return SAMPLE_POS.clone().add(new THREE.Vector3(0, s ? s.topY : 0.1, 0));
  }

  // ───────────────────────── tests ─────────────────────────

  /** Little "get ready" animation while the mini-game is on screen. */
  async prepTest(tool: ToolId, sub: Substance): Promise<void> {
    const fx = this.fx;
    const st = this.stations;
    switch (tool) {
      case 'flame':
        void st.burner.moveLoop(false, fx);
        break;
      case 'splint':
        st.burner.splint.visible = true;
        break;
      case 'microscope':
        await st.microscope.place(sub.color, fx);
        break;
      case 'iodine': case 'acid': case 'luminol': case 'agno3': case 'naoh': case 'bacl2':
        await st.reagents.pour(sub.color, fx);
        break;
      case 'sniff':
        if (this.sample) {
          const s = this.sample.root;
          const y0 = s.position.y;
          await this.tweens.run(0.4 / this.speed, (k) => (s.position.y = y0 + 0.12 * k), Easing.outQuad);
        }
        break;
      default:
        break;
    }
  }

  /** Plays the visible outcome of a test after the mini-game. */
  async playTest(tool: ToolId, sub: Substance, reading: Reading, q: Quality): Promise<void> {
    const fx = this.fx;
    const st = this.stations;
    const ok = q !== 'miss';
    const p = sub.props;
    switch (tool) {
      case 'ph': {
        await st.phbox.dip(this.sampleTop(), ok ? reading.color : '#8d8d8d', fx);
        await fx.tweens.wait(0.35);
        await st.phbox.putBack(fx);
        break;
      }
      case 'sniff': {
        const top = this.sampleTop().add(new THREE.Vector3(0, 0.12, 0));
        audio.play('sniff');
        for (let i = 0; i < 3; i++) {
          this.norm.emit({ pos: top, count: 6, color: ok ? reading.color : '#9aa3b2', speed: 0.35, spread: 0.5, dir: new THREE.Vector3(0, 1, 0.8), life: 1.1, size: 0.08, grow: 2.5, jitter: 0.06 });
          await fx.tweens.wait(0.18);
        }
        if (p.odor === 'squeaky' && ok) audio.play('squeak');
        if (this.sample) {
          const s = this.sample.root;
          const y0 = s.position.y;
          await this.tweens.run(0.3 / this.speed, (k) => (s.position.y = y0 - (y0 - SAMPLE_POS.y) * k));
        }
        break;
      }
      case 'flame': {
        await st.burner.moveLoop(true, fx);
        const tip = st.burner.flameTip();
        if (!ok) {
          st.burner.setFlame('#ff9a3c', 1.3);
          audio.play('miss');
          await fx.tweens.wait(0.5);
          st.burner.resetFlame();
          await st.burner.moveLoop(false, fx);
          break;
        }
        await this.flameEffect(p.flame, tip, 1);
        await st.burner.moveLoop(false, fx);
        st.burner.resetFlame();
        break;
      }
      case 'splint': {
        const b = st.burner.splint;
        b.visible = true;
        const home = b.position.clone();
        const target = b.parent!.worldToLocal(this.sampleTop().add(new THREE.Vector3(0.17, 0.03, 0)));
        await fx.tweens.run(0.5 / this.speed, (k) => b.position.lerpVectors(home, target, k), Easing.inOutCubic);
        const tip = this.sampleTop().add(new THREE.Vector3(0, 0.03, 0));
        if (ok) await this.splintEffect(p.splint, tip);
        else {
          audio.play('miss');
          this.norm.emit({ pos: tip, count: 10, color: '#888888', speed: 0.3, life: 0.8, size: 0.06, grow: 2 });
          await fx.tweens.wait(0.4);
        }
        await fx.tweens.run(0.4 / this.speed, (k) => b.position.lerpVectors(target, home, k), Easing.inOutCubic);
        b.visible = false;
        break;
      }
      case 'microscope':
        await fx.tweens.wait(0.2);
        st.microscope.reset();
        break;
      case 'iodine': case 'acid': case 'agno3': case 'naoh': case 'bacl2': case 'luminol':
        await this.reagentEffect(tool, sub, reading, ok);
        break;
      case 'conduct':
        await st.conductivity.test(ok ? p.conduct : 'none', sub.color, fx);
        st.conductivity.reset();
        break;
      case 'magnet': {
        await st.magnet.swingTo(this.sampleTop(), fx);
        if (p.magnet && this.sample) {
          audio.play('clank');
          const s = this.sample.root;
          const y0 = s.position.y;
          await this.tweens.run(0.25, (k) => (s.position.y = y0 + Math.sin(k * Math.PI) * 0.07), Easing.outQuad);
          this.shake(0.02);
          this.add.emit({ pos: this.sampleTop(), count: 20, color: ['#ff5a5f', '#ffffff'], speed: 0.8, spread: 1, life: 0.4, size: 0.03 });
        } else await fx.tweens.wait(0.45);
        await st.magnet.goHome(fx);
        break;
      }
      case 'uv': {
        audio.play('hum');
        await this.setDim(1, 0.35);
        st.uvlamp.setOn(1);
        this.uvLight.intensity = 3;
        const smp = this.sample;
        if (ok && p.uv !== 'none' && smp) {
          audio.play('glow');
          await fx.tweens.run(0.5, (k) => smp.setGlow(reading.color, k));
          this.add.emit({ pos: this.sampleTop(), count: 25, color: reading.color, speed: 0.4, spread: 1, life: 1, size: 0.05 });
        }
        await fx.tweens.wait(1.0);
        this.sample?.setGlow(null);
        st.uvlamp.setOn(0);
        this.uvLight.intensity = 0;
        await this.setDim(0, 0.35);
        break;
      }
      case 'density':
        await st.scale.weigh(sub.color, ok ? reading.short : 'ERROR', fx);
        await fx.tweens.wait(0.5);
        break;
      default:
        break;
    }
  }

  private async flameEffect(f: string, tip: THREE.Vector3, k: number): Promise<void> {
    const st = this.stations;
    const color = FLAME_INFO[f]?.color ?? '#3d7bff';
    switch (f) {
      case 'none':
        audio.play('flame');
        await this.tweens.wait(0.7);
        break;
      case 'chars':
        audio.play('flame');
        this.norm.emit({ pos: tip, count: 30, color: ['#333333', '#555555'], speed: 0.5, spread: 0.4, life: 1.4, size: 0.07, grow: 3 });
        st.burner.setFlame('#ff9a3c', 1.2);
        await this.tweens.wait(1.0);
        break;
      case 'burns-blue':
      case 'burns-yellow':
      case 'burns-invisible': {
        audio.play('flame');
        const c = f === 'burns-blue' ? '#3d7bff' : f === 'burns-yellow' ? '#ff9a3c' : '#c8dcff';
        st.burner.setFlame(c, f === 'burns-invisible' ? 1.4 : 1.9, f === 'burns-yellow' ? '#ffd27a' : '#bfe6ff');
        this.add.emit({ pos: tip, count: f === 'burns-invisible' ? 8 : 40, color: c, speed: 0.8, spread: 0.3, life: 0.8, size: 0.06, grow: 1.5 });
        if (f === 'burns-yellow') this.norm.emit({ pos: tip.clone().add(new THREE.Vector3(0, 0.1, 0)), count: 20, color: '#444444', speed: 0.5, life: 1.2, size: 0.06, grow: 3 });
        await this.tweens.wait(1.2);
        break;
      }
      case 'white-flash':
        audio.play('popbang');
        this.flash('#ffffff', 0.85);
        this.add.emit({ pos: tip, count: 60, color: ['#ffffff', '#fff7c2'], speed: 1.6, spread: 1, life: 0.6, size: 0.05 });
        await this.tweens.wait(0.9);
        break;
      case 'sparks':
        audio.play('flame');
        this.add.emit({ pos: tip, count: 70, color: ['#ffb347', '#ffe066', '#ff7b00'], speed: 1.4, spread: 1, life: 0.7, size: 0.025, gravity: 2.5 });
        st.burner.setFlame('#ffb347', 1.2);
        await this.tweens.wait(1.0);
        break;
      case 'pop':
        audio.play('popbang');
        this.flash('#fff3a0', 0.4);
        this.add.emit({ pos: tip, count: 40, color: ['#fff3a0', '#ffffff'], speed: 1.5, spread: 1, life: 0.35, size: 0.05 });
        this.shake(0.03);
        await this.tweens.wait(0.7);
        break;
      case 'rainbow':
        audio.play('glow');
        st.burner.rainbow();
        this.add.emit({ pos: tip, count: 80, color: ['#ff4d4d', '#ffd23f', '#2ecc71', '#4da6ff', '#b388ff'], speed: 1.2, spread: 1, life: 1, size: 0.04 });
        await this.tweens.wait(1.4);
        break;
      default:
        // coloured flame (metal ions)
        audio.play('flame');
        st.burner.setFlame(color, 1.5 * k, color);
        this.add.emit({ pos: tip, count: 45, color, speed: 0.7, spread: 0.35, life: 0.8, size: 0.05 });
        await this.tweens.wait(1.2);
    }
  }

  private async splintEffect(s: string, tip: THREE.Vector3): Promise<void> {
    switch (s) {
      case 'pop':
        audio.play('popbang');
        this.flash('#fff3a0', 0.35);
        this.add.emit({ pos: tip, count: 40, color: ['#fff3a0', '#ffffff'], speed: 1.4, spread: 1, life: 0.35, size: 0.05 });
        this.shake(0.03);
        break;
      case 'relight':
        audio.play('flame');
        this.add.emit({ pos: tip, count: 50, color: ['#ff9a3c', '#ffd23f'], speed: 0.6, spread: 0.4, life: 0.8, size: 0.06 });
        break;
      case 'out':
        audio.play('swoosh');
        this.norm.emit({ pos: tip, count: 16, color: '#9a9a9a', speed: 0.25, life: 1.2, size: 0.06, grow: 2.5 });
        break;
      case 'burns':
        audio.play('flame');
        this.add.emit({ pos: tip, count: 50, color: '#3d7bff', speed: 0.7, spread: 0.3, life: 0.8, size: 0.06 });
        break;
      default:
        audio.play('tick');
    }
    await this.tweens.wait(0.9);
  }

  private async reagentEffect(tool: ToolId, sub: Substance, reading: Reading, ok: boolean): Promise<void> {
    const fx = this.fx;
    const rack = this.stations.reagents;
    await rack.liftBottle(tool, fx);
    const drop = rack.dropPoint();
    for (let i = 0; i < 3; i++) {
      this.add.emit({ pos: drop, count: 1, color: TOOL_MAP[tool].reagentColor ?? '#ffffff', speed: 0.01, dir: new THREE.Vector3(0, -1, 0), spread: 0, life: 0.35, size: 0.03, gravity: 3 });
      audio.play('drop', i);
      await fx.tweens.wait(0.16);
    }
    const tube = rack.tube;
    const top = rack.tubeTop();
    const p = sub.props;
    if (!ok) {
      // overflow!
      audio.play('fizz');
      this.norm.emit({ pos: top, count: 30, color: ['#ffffff', sub.color], speed: 0.6, spread: 0.6, life: 0.8, size: 0.04, gravity: 1.5 });
      await fx.tweens.wait(0.5);
    } else if (tool === 'luminol') {
      await this.setDim(1, 0.3);
      if (p.luminol !== 'none') {
        audio.play('glow');
        tube.liquidMat.emissive.set(reading.color);
        await fx.tweens.run(p.luminol === 'flash' ? 0.25 : 0.6, (k) => (tube.liquidMat.emissiveIntensity = 3 * k));
        this.add.emit({ pos: top, count: 25, color: reading.color, speed: 0.3, spread: 1, life: 1, size: 0.05 });
        if (p.luminol === 'flash') await fx.tweens.run(0.6, (k) => (tube.liquidMat.emissiveIntensity = 3 * (1 - k)));
        else await fx.tweens.wait(0.9);
      } else await fx.tweens.wait(0.9);
      tube.liquidMat.emissiveIntensity = 0;
      await this.setDim(0, 0.3);
    } else if (tool === 'acid') {
      switch (p.acid) {
        case 'fizz':
        case 'vigorous':
          audio.play('fizz');
          for (let i = 0; i < (p.acid === 'vigorous' ? 6 : 3); i++) {
            this.norm.emit({ pos: top.clone().add(new THREE.Vector3(0, -0.05, 0)), count: 12, color: '#ffffff', speed: p.acid === 'vigorous' ? 0.8 : 0.4, spread: 0.3, life: 0.6, size: 0.02, jitter: 0.02 });
            await fx.tweens.wait(0.12);
          }
          break;
        case 'hot':
          audio.play('fizz');
          tube.liquidMat.emissive.set('#ff4d00');
          tube.liquidMat.emissiveIntensity = 0.6;
          this.norm.emit({ pos: top, count: 25, color: '#ffffff', speed: 0.4, life: 1.2, size: 0.06, grow: 2.5 });
          await fx.tweens.wait(0.8);
          tube.liquidMat.emissiveIntensity = 0;
          break;
        case 'toxic-gas':
          audio.play('fizz');
          this.norm.emit({ pos: top, count: 40, color: ['#c5f04a', '#e1ff8a'], speed: 0.35, spread: 0.6, life: 1.6, size: 0.08, grow: 3 });
          await fx.tweens.wait(1.0);
          break;
        case 'stink':
          this.norm.emit({ pos: top, count: 25, color: '#c9b84a', speed: 0.3, life: 1.3, size: 0.07, grow: 3 });
          await fx.tweens.wait(0.8);
          break;
        default:
          await fx.tweens.wait(0.6);
      }
    } else {
      // colour changes / precipitates
      const key = tool === 'iodine' ? p.iodine : tool === 'agno3' ? p.agno3 : tool === 'naoh' ? p.naoh : p.bacl2;
      if (key === 'none') {
        if (tool === 'iodine') {
          const c0 = tube.liquidMat.color.clone();
          const c1 = new THREE.Color('#c17a2c');
          await fx.tweens.run(0.5, (k) => tube.liquidMat.color.lerpColors(c0, c1, k * 0.7));
        } else await fx.tweens.wait(0.6);
      } else if (key === 'ammonia') {
        this.norm.emit({ pos: top, count: 18, color: '#cfeaff', speed: 0.3, life: 1.2, size: 0.07, grow: 2.5 });
        await fx.tweens.wait(0.8);
      } else {
        audio.play('bubble');
        const c0 = tube.liquidMat.color.clone();
        const c1 = new THREE.Color(reading.color);
        await fx.tweens.run(0.7, (k) => tube.liquidMat.color.lerpColors(c0, c1, k));
        this.norm.emit({ pos: top.clone().add(new THREE.Vector3(0, -0.04, 0)), count: 18, color: reading.color, speed: 0.08, spread: 1, life: 1, size: 0.03, jitter: 0.02 });
        await fx.tweens.wait(0.5);
      }
    }
    await rack.returnBottle(tool, fx);
    await fx.tweens.run(0.25, (k) => tube.setFill(1 - k));
  }

  // ───────────────────────── machines ─────────────────────────

  machineStart(tool: ToolId, sub: Substance, dur: number, label: string): void {
    if (tool === 'geiger') {
      this.stations.geiger.start(sub.props.rad);
      audio.play('beep');
    }
    if (tool === 'massspec') {
      this.stations.massspec.start();
      audio.play('machine');
    }
    const m = sub.props.mass;
    const peak = m > 9000 ? 0.92 : clamp(Math.log10(Math.max(2, m)) / 3.2, 0.06, 0.94);
    this.machineTools.set(tool, { end: this.t + dur, dur, peak, label });
  }

  machineCancel(tool: ToolId): void {
    this.machineTools.delete(tool);
    if (tool === 'geiger') this.stations.geiger.reset();
    if (tool === 'massspec') this.stations.massspec.reset();
  }

  machineFinish(tool: ToolId): void {
    const m = this.machineTools.get(tool);
    this.machineTools.delete(tool);
    if (tool === 'geiger') this.stations.geiger.stop();
    if (tool === 'massspec') {
      this.stations.massspec.stop();
      this.stations.massspec.screen.spectrum(m?.peak ?? 0.5, 1, m?.label ?? '');
    }
    audio.play('ding');
  }

  resetMachines(): void {
    for (const t of [...this.machineTools.keys()]) this.machineCancel(t);
    this.stations.geiger.reset();
    this.stations.massspec.reset();
  }

  // ───────────────────────── accidents & celebrations ─────────────────────────

  async accident(kind: 'fire' | 'fumes' | 'gas'): Promise<void> {
    const top = this.sampleTop();
    this.gerald.scare();
    if (kind === 'fire') {
      audio.play('explosion');
      this.flash('#ffb347', 0.9);
      this.shake(0.12);
      this.add.emit({ pos: top, count: 120, color: ['#ff7b00', '#ffd23f', '#ff3d00'], speed: 2.4, spread: 1, life: 0.9, size: 0.09, grow: 1.6 });
      this.norm.emit({ pos: top.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 60, color: ['#2b2b2b', '#4a4a4a'], speed: 1, spread: 1, life: 1.8, size: 0.12, grow: 3 });
    } else if (kind === 'gas') {
      audio.play('fizz');
      audio.play('cough');
      this.flash('#c5f04a', 0.5);
      this.norm.emit({ pos: top, count: 80, color: ['#c5f04a', '#e1ff8a'], speed: 0.8, spread: 1, life: 2, size: 0.15, grow: 3 });
      this.shake(0.04);
    } else {
      audio.play('cough');
      this.flash('#9be15d', 0.55);
      this.norm.emit({ pos: top.clone().add(new THREE.Vector3(0, 0.15, 0.2)), count: 50, color: ['#9be15d', '#d7ff9e'], speed: 0.6, spread: 1, life: 1.6, size: 0.12, grow: 3 });
      this.shake(0.05);
    }
    await this.tweens.wait(1.0);
  }

  celebrate(): void {
    this.gerald.celebrate();
    const p = new THREE.Vector3(0, 1.6, -0.6);
    this.add.emit({ pos: p, count: 90, color: ['#ffd23f', '#ff7eb6', '#7bed9f', '#4da6ff', '#b388ff'], speed: 2.2, spread: 1, life: 1.6, size: 0.05, gravity: 2.5 });
  }

  /** Screen position (CSS px) of a world point. */
  toScreen(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, visible: p.z < 1 };
  }

  geraldScreen(): { x: number; y: number; visible: boolean } {
    return this.toScreen(this.gerald.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
  }

  clientScreen(): { x: number; y: number; visible: boolean } {
    return this.toScreen(CLIENT_POS.clone().add(new THREE.Vector3(0, 1.45, 0)));
  }

  sampleScreen(): { x: number; y: number; visible: boolean } {
    return this.toScreen(this.sampleTop());
  }

  // ───────────────────────── loop ─────────────────────────

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    const { top, right, bottom, left } = this.insets;
    const dx = (left - right) / 2;
    const dy = (top - bottom) / 2;
    const fullW = w + Math.abs(dx) * 2;
    const fullH = h + Math.abs(dy) * 2;
    this.camera.aspect = fullW / fullH;
    this.camera.setViewOffset(fullW, fullH, dx > 0 ? 0 : Math.abs(dx) * 2, dy > 0 ? 0 : Math.abs(dy) * 2, w, h);
    this.camera.updateProjectionMatrix();
    this.add.setScale(h);
    this.norm.setScale(h);
    // keep the current pose framed
    if (this.pose !== 'menu') this.snapKeep();
  }

  private snapKeep(): void {
    const tgt = this.poseFor(this.pose);
    this.camPos.copy(this.fitPose(tgt));
    this.camTarget.copy(tgt.target);
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const pick = (): Station | 'nose' | null => {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const objs: THREE.Object3D[] = [];
      for (const st of Object.values(this.stations) as Station[]) if (st.root.visible) objs.push(st.root);
      if (this.sample) objs.push(this.sample.root);
      const hits = this.raycaster.intersectObjects(objs, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const id = o.userData.station as StationId | undefined;
          if (id === 'nose') return 'nose';
          if (id) return this.stations[id as Exclude<StationId, 'nose'>];
          o = o.parent;
        }
      }
      return null;
    };
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.down) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > 12) return;
      toNdc(e);
      const p = pick();
      if (p === 'nose') this.onStationClick('nose');
      else if (p) this.onStationClick(p.id);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      toNdc(e);
      const p = pick();
      const st = p && p !== 'nose' ? p : null;
      if (st !== this.hovered) {
        this.hovered?.hover(false);
        st?.hover(true);
        this.hovered = st;
        el.style.cursor = p ? 'pointer' : 'default';
      }
    });
  }

  private frame(): void {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.paused) return;
    dt = Math.min(dt, DT_CAP);
    if (!this.frozen) {
      this.t += dt;
      this.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.autoQuality(dt);
  }

  private autoQuality(dt: number): void {
    if (this.quality !== 'auto' || this.fpsSamples.length > 200) return;
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length === 200) {
      const avg = this.fpsSamples.slice(40).reduce((a, b) => a + b, 0) / 160;
      if (avg > 1 / 40) {
        this.renderer.setPixelRatio(1);
        this.sun.shadow.mapSize.set(1024, 1024);
        this.sun.shadow.map?.dispose();
        (this.sun.shadow as any).map = null;
        this.resize();
      }
    }
  }

  private update(dt: number): void {
    this.tweens.update(dt);
    this.orbit += dt;
    if (this.pose === 'menu') {
      const tgt = this.poseFor('menu');
      this.camPos.lerp(this.fitPose(tgt), Math.min(1, dt * 2));
      this.camTarget.lerp(tgt.target, Math.min(1, dt * 2));
    }
    // camera + shake
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.0005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 7);
    }
    this.camera.lookAt(this.camTarget);
    // lights
    const base = this.night ? 0.5 : 1;
    const d = 1 - 0.88 * this.dim;
    this.hemi.intensity = 1.1 * base * d;
    this.sun.intensity = 2.0 * base * d;
    this.room.lampLight.intensity = (this.night ? 9 : 6) * d;
    this.room.windowLight.intensity = (this.night ? 3 : 10) * d;
    // actors
    this.gerald.update(dt);
    this.client?.update(dt, this.camera.position);
    for (const st of Object.values(this.stations) as Station[]) if (st.root.visible) st.update(dt, this.t);
    this.stations.geiger.tickAudio(dt, audio);
    for (const [tool, m] of this.machineTools) {
      const k = clamp(1 - (m.end - this.t) / m.dur, 0, 1);
      if (tool === 'geiger') this.stations.geiger.setProgress(k);
      if (tool === 'massspec') this.stations.massspec.screen.spectrum(m.peak ?? 0.5, k, m.label ?? '');
    }
    // ambient sample fx
    if (this.sample) {
      const s = this.sample.sub;
      if (s.fizzy && Math.random() < dt * 6) this.norm.emit({ pos: this.sampleTop().add(new THREE.Vector3(0, -0.06, 0)), count: 1, color: '#ffffff', speed: 0.15, spread: 0.2, life: 0.6, size: 0.012, jitter: 0.06 });
      if (s.smoky && Math.random() < dt * 10) this.norm.emit({ pos: this.sampleTop(), count: 1, color: '#f4fbff', speed: 0.12, spread: 1, dir: new THREE.Vector3(0, -0.2, 0.3), life: 1.6, size: 0.1, grow: 2.5, jitter: 0.1 });
      if (s.glow && Math.random() < dt * 3) this.add.emit({ pos: this.sampleTop(), count: 1, color: s.color, speed: 0.1, spread: 1, life: 1, size: 0.03, jitter: 0.08 });
    }
    this.add.update(dt);
    this.norm.update(dt);
  }
}
