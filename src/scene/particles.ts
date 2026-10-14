import * as THREE from 'three';
import { dotTexture } from './textures';

export interface EmitOpts {
  pos: THREE.Vector3;
  count: number;
  color: string | string[];
  /** initial speed */
  speed?: number;
  /** cone spread (0 = straight up, 1 = full sphere) */
  spread?: number;
  /** base direction */
  dir?: THREE.Vector3;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  /** grow factor over life (1 = constant) */
  grow?: number;
  /** random position jitter */
  jitter?: number;
}

const VERT = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
}`;

/** One pooled particle system (additive or normal blending). */
export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private grow: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private cursor = 0;
  private alive = 0;
  private geo: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;

  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: dotTexture() }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(viewportHeight: number): void {
    this.material.uniforms.uScale.value = viewportHeight * 0.9;
  }

  emit(o: EmitOpts): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    const c = new THREE.Color();
    const dir = o.dir ?? new THREE.Vector3(0, 1, 0);
    const spread = o.spread ?? 0.4;
    const v = new THREE.Vector3();
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const j = o.jitter ?? 0.02;
      this.pos[i * 3] = o.pos.x + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 1] = o.pos.y + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 2] = o.pos.z + (Math.random() - 0.5) * j;
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(spread);
      v.add(dir).normalize().multiplyScalar((o.speed ?? 1) * (0.6 + Math.random() * 0.7));
      this.vel[i * 3] = v.x;
      this.vel[i * 3 + 1] = v.y;
      this.vel[i * 3 + 2] = v.z;
      c.set(colors[Math.floor(Math.random() * colors.length)]);
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      const life = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.baseSize[i] = (o.size ?? 0.05) * (0.7 + Math.random() * 0.6);
      this.grow[i] = o.grow ?? 1;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0.5;
    }
    this.alive = this.max;
  }

  update(dt: number): void {
    if (!this.alive) return;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.baseSize[i] * (1 + (this.grow[i] - 1) * k);
      this.alpha[i] = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    }
    if (!any) this.alive = 0;
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.pcolor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
  }
}
