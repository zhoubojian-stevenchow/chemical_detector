import * as THREE from 'three';
import { at, cone, cyl, group, mat, mergeStatic, rbox, sphere, torus, tube } from './kit';

/** Gerald, senior lab rat and moral support. */
export class Gerald {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private tail: THREE.Mesh;
  private ears: THREE.Mesh[] = [];
  private hatSlot = new THREE.Group();
  private t = 0;
  private hop = 0;
  private panic = 0;
  private spin = 0;
  private propeller: THREE.Object3D | null = null;

  constructor() {
    const fur = mat('#b8b2c4', { rough: 0.9 });
    const pink = mat('#ff9fb6', { rough: 0.6 });
    this.root.add(this.body);
    const torso = sphere(0.075, fur, 20);
    torso.scale.set(1, 0.95, 1.25);
    at(torso, 0, 0.07, 0, this.body);
    // tiny lab coat
    const coat = sphere(0.078, mat('#ffffff', { rough: 0.8 }), 20, undefined);
    coat.scale.set(1.02, 0.8, 1.1);
    at(coat, 0, 0.06, 0.005, this.body);
    at(this.head, 0, 0.14, 0.07, this.body);
    const h = sphere(0.055, fur, 18);
    h.scale.set(1, 0.95, 1.1);
    this.head.add(h);
    const snout = cone(0.035, 0.07, fur, 12);
    snout.rotation.x = Math.PI / 2;
    at(snout, 0, -0.012, 0.06, this.head);
    at(sphere(0.012, pink), 0, -0.012, 0.097, this.head);
    for (const s of [-1, 1]) {
      const ear = sphere(0.032, pink, 12);
      ear.scale.set(1, 1, 0.35);
      at(ear, s * 0.04, 0.05, -0.005, this.head);
      this.ears.push(ear);
      at(sphere(0.011, '#111111', 8), s * 0.025, 0.015, 0.045, this.head);
      at(sphere(0.004, '#ffffff', 6), s * 0.025 + 0.004, 0.02, 0.055, this.head);
      // whiskers
      for (const k of [-1, 1]) {
        const w = cyl(0.0015, 0.0015, 0.06, '#eeeeee', 4);
        w.rotation.z = Math.PI / 2 + k * 0.2;
        at(w, s * 0.04, -0.012 + k * 0.006, 0.075, this.head);
      }
      // feet
      at(sphere(0.02, pink, 8), s * 0.04, 0.005, 0.06, this.body).scale.set(1, 0.5, 1.4);
    }
    // goggles on forehead
    for (const s of [-1, 1]) at(torus(0.014, 0.004, '#ffb627'), s * 0.018, 0.045, 0.04, this.head).rotation.x = -0.3;
    this.tail = tube(
      [new THREE.Vector3(0, 0.04, -0.09), new THREE.Vector3(0.03, 0.02, -0.16), new THREE.Vector3(0.08, 0.05, -0.2), new THREE.Vector3(0.1, 0.1, -0.18)],
      0.007,
      pink,
      20,
    );
    this.body.add(this.tail);
    this.hatSlot.position.set(0, 0.05, -0.005);
    this.head.add(this.hatSlot);
    this.root.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    for (const d of [this.head, this.tail, ...this.ears]) d.userData.dynamic = true;
    mergeStatic(this.body);
    this.head.userData.dynamic = false;
    this.hatSlot.userData.dynamic = true;
    mergeStatic(this.head);
  }

  setHat(id: string): void {
    this.hatSlot.clear();
    this.propeller = null;
    const s = this.hatSlot;
    switch (id) {
      case 'hat_party': {
        const c = cone(0.03, 0.08, mat('#ff4d6d'), 14);
        c.position.y = 0.04;
        s.add(c);
        at(sphere(0.012, '#ffd23f'), 0, 0.085, 0, s);
        break;
      }
      case 'hat_chef': {
        at(cyl(0.035, 0.038, 0.05, '#ffffff'), 0, 0.025, 0, s);
        for (let i = 0; i < 4; i++) at(sphere(0.022, '#ffffff', 10), Math.cos(i * 1.6) * 0.017, 0.058, Math.sin(i * 1.6) * 0.017, s);
        break;
      }
      case 'hat_propeller': {
        const d = sphere(0.04, mat('#3fa7ff'), 14);
        d.scale.y = 0.6;
        s.add(d);
        const p = group(s);
        p.position.y = 0.03;
        for (const c of ['#ffd23f', '#21c7a8']) {
          const b = rbox(0.08, 0.004, 0.015, 0.003, c);
          b.rotation.y = c === '#ffd23f' ? 0 : Math.PI / 2;
          p.add(b);
        }
        this.propeller = p;
        break;
      }
      case 'hat_top':
        at(cyl(0.05, 0.05, 0.006, '#1d1d28'), 0, 0.005, 0, s);
        at(cyl(0.03, 0.03, 0.07, '#1d1d28'), 0, 0.04, 0, s);
        at(cyl(0.031, 0.031, 0.012, '#c0392b'), 0, 0.015, 0, s);
        break;
      case 'hat_wizard': {
        at(cyl(0.055, 0.055, 0.005, '#5f27cd'), 0, 0.005, 0, s);
        const c = cone(0.035, 0.1, mat('#5f27cd'), 14);
        c.position.y = 0.055;
        c.rotation.z = 0.2;
        s.add(c);
        at(sphere(0.008, mat('#ffd23f', { emissive: '#ffd23f' })), 0.012, 0.06, 0.03, s);
        break;
      }
      case 'hat_crown': {
        const m = mat('#f2c318', { metal: 0.8, rough: 0.25 });
        at(cyl(0.035, 0.035, 0.03, m, 16, undefined, true), 0, 0.015, 0, s);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          at(cone(0.008, 0.025, m, 6), Math.cos(a) * 0.033, 0.04, Math.sin(a) * 0.033, s);
        }
        at(sphere(0.008, mat('#ff2e63', { emissive: '#ff2e63', emissiveIntensity: 0.4 })), 0, 0.015, 0.036, s);
        break;
      }
    }
    s.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  }

  celebrate(): void {
    this.hop = 1;
    this.spin = 1;
  }
  scare(): void {
    this.panic = 1.6;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    // idle sniffing
    this.head.rotation.x = Math.sin(t * 9) * 0.04 + Math.sin(t * 0.7) * 0.1;
    this.head.rotation.y = Math.sin(t * 0.5) * 0.4;
    this.ears.forEach((e, i) => (e.rotation.z = Math.sin(t * 3 + i) * 0.15));
    this.tail.rotation.y = Math.sin(t * 2) * 0.3;
    this.body.position.y = 0;
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 1.1);
      this.body.position.y = Math.abs(Math.sin((1 - this.hop) * Math.PI * 4)) * 0.06 * this.hop;
    }
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 1.2);
      this.body.rotation.y = (1 - this.spin) * Math.PI * 2;
    } else this.body.rotation.y = 0;
    if (this.panic > 0) {
      this.panic = Math.max(0, this.panic - dt);
      this.body.position.x = Math.sin(t * 60) * 0.008;
      this.body.scale.setScalar(1 + Math.sin(t * 30) * 0.05);
    } else {
      this.body.position.x = 0;
      this.body.scale.setScalar(1);
    }
    if (this.propeller) this.propeller.rotation.y += dt * 18;
  }
}
