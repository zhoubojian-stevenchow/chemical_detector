import * as THREE from 'three';
import type { Look } from '../data/types';
import { at, box, capsule, cone, cyl, group, mat, mergeStatic, rbox, shade, sphere, torus, umat } from './kit';

export type Expression = 'neutral' | 'happy' | 'angry' | 'surprised' | 'sick' | 'talk';

/** A cartoon "bean" client, built from primitives. */
export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private pupils: THREE.Mesh[] = [];
  private brows: THREE.Mesh[] = [];
  private mouthSmile: THREE.Mesh;
  private mouthFrown: THREE.Mesh;
  private mouthO: THREE.Mesh;
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private skinMat: THREE.MeshStandardMaterial;
  private propeller: THREE.Object3D | null = null;
  private t = Math.random() * 10;
  private blinkT = 2;
  private expr: Expression = 'neutral';
  private talking = 0;
  private shake = 0;
  private jump = 0;
  private baseSkin: THREE.Color;

  constructor(look: Look) {
    const skin = look.skin;
    this.skinMat = umat(skin, { rough: 0.6 });
    this.baseSkin = this.skinMat.color.clone();
    const scale = look.body === 'small' ? 0.82 : 1;
    const wide = look.body === 'wide' ? 1.22 : 1;
    const tall = look.body === 'tall' ? 1.1 : 1;
    this.root.add(this.body);
    this.body.scale.set(scale * wide, scale * tall, scale);

    // torso
    const torso = capsule(0.27, 0.42, look.shirt, { rough: 0.7 });
    at(torso, 0, 0.45, 0, this.body);
    // neck shadow / collar
    const collar = cyl(0.17, 0.2, 0.07, shade(look.shirt, 0.8));
    at(collar, 0, 0.86, 0, this.body);
    // arms
    for (const [side, g] of [[-1, this.armL], [1, this.armR]] as [number, THREE.Group][]) {
      at(g, side * 0.3, 0.72, 0, this.body);
      const arm = capsule(0.075, 0.3, look.shirt, { rough: 0.7 });
      arm.position.y = -0.2;
      g.add(arm);
      const hand = sphere(0.08, this.skinMat);
      hand.position.y = -0.42;
      g.add(hand);
      g.rotation.z = side * 0.18;
    }

    // head
    at(this.head, 0, 1.12, 0.02, this.body);
    const headMesh = sphere(0.26, this.skinMat, 28);
    headMesh.scale.set(1, 0.98, 0.95);
    this.head.add(headMesh);
    // ears
    for (const s of [-1, 1]) at(sphere(0.06, this.skinMat), s * 0.255, 0, 0, this.head).scale.set(0.6, 1, 0.8);
    // eyes
    const eyeXs = look.threeEyes ? [-0.11, 0, 0.11] : [-0.09, 0.09];
    for (const ex of eyeXs) {
      const eg = group(this.head);
      eg.position.set(ex, 0.04 + (look.threeEyes && ex === 0 ? 0.07 : 0), 0.215);
      const white = sphere(0.058, '#ffffff', 16, { rough: 0.3 });
      white.scale.z = 0.6;
      eg.add(white);
      const pupil = sphere(0.032, '#1d1d28', 12, { rough: 0.2 });
      pupil.position.z = 0.03;
      eg.add(pupil);
      const shine = sphere(0.011, '#ffffff', 8);
      shine.position.set(0.012, 0.014, 0.055);
      eg.add(shine);
      this.eyes.push(eg);
      this.pupils.push(pupil);
    }
    // brows
    for (const s of [-1, 1]) {
      const b = rbox(0.09, 0.022, 0.02, 0.01, look.hair?.color ?? shade(skin, 0.45));
      b.position.set(s * 0.09, 0.135, 0.225);
      this.head.add(b);
      this.brows.push(b);
    }
    // nose
    at(sphere(0.035, mat(shade(skin, 0.9))), 0, -0.02, 0.255, this.head);
    // mouths
    this.mouthSmile = torus(0.06, 0.014, '#5a2430', Math.PI);
    this.mouthSmile.rotation.z = Math.PI;
    this.mouthSmile.position.set(0, -0.085, 0.228);
    this.head.add(this.mouthSmile);
    this.mouthFrown = torus(0.05, 0.014, '#5a2430', Math.PI);
    this.mouthFrown.position.set(0, -0.125, 0.225);
    this.head.add(this.mouthFrown);
    this.mouthO = sphere(0.04, '#5a2430', 12);
    this.mouthO.scale.set(1, 1.2, 0.4);
    this.mouthO.position.set(0, -0.1, 0.23);
    this.head.add(this.mouthO);

    const face = look.face ?? [];
    if (face.includes('blush')) for (const s of [-1, 1]) at(sphere(0.045, mat('#ff8fa3', { opacity: 0.55 })), s * 0.15, -0.05, 0.2, this.head).scale.set(1, 0.6, 0.3);
    if (face.includes('freckles')) for (let i = 0; i < 6; i++) at(sphere(0.008, '#9c5a3c', 6), (i % 3) * 0.025 - 0.025 + (i < 3 ? -0.13 : 0.105), -0.035 - Math.floor(i / 3) * 0.0, 0.235, this.head);
    if (face.includes('mustache')) {
      const mc = look.hair?.color ?? '#3b2a20';
      for (const s of [-1, 1]) {
        const m = capsule(0.022, 0.07, mc);
        m.rotation.z = s * 1.2;
        m.position.set(s * 0.045, -0.055, 0.245);
        this.head.add(m);
      }
    }
    if (face.includes('beard')) {
      const bc = look.hair?.color ?? '#3b2a20';
      const beard = sphere(0.22, mat(bc, { rough: 0.9 }), 20);
      beard.scale.set(1.05, 0.7, 0.9);
      beard.position.set(0, -0.13, 0.03);
      this.head.add(beard);
      this.mouthSmile.position.z = 0.25;
      this.mouthFrown.position.z = 0.25;
      this.mouthO.position.z = 0.25;
    }
    if (face.includes('stubble')) {
      const goatee = sphere(0.045, mat(look.hair?.color ?? shade(skin, 0.45), { rough: 0.9 }), 12);
      goatee.scale.set(1.1, 0.8, 0.6);
      goatee.position.set(0, -0.19, 0.18);
      this.head.add(goatee);
    }
    if (face.includes('lashes')) for (const s of [-1, 1]) at(box(0.07, 0.012, 0.01, '#1d1d28'), s * 0.09, 0.09, 0.24, this.head).rotation.z = s * -0.25;

    if (look.hair) this.buildHair(look.hair.style, look.hair.color, !!look.hat);
    if (look.hat) this.buildHat(look.hat, look.hatColor ?? '#333333');
    if (look.eyewear) this.buildEyewear(look.eyewear);
    for (const e of look.extra ?? []) this.buildExtra(e, look.shirt);
    this.setExpression('neutral');
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    // merge static parts: fewer draw calls per character
    for (const d of [...this.eyes, ...this.brows, this.mouthSmile, this.mouthFrown, this.mouthO, this.armL, this.armR, this.head]) d.userData.dynamic = true;
    if (this.propeller) this.propeller.userData.dynamic = true;
    mergeStatic(this.body);
    this.head.userData.dynamic = false;
    mergeStatic(this.head);
  }

  private buildHair(style: string, color: string, hasHat: boolean): void {
    const m = mat(color, { rough: 0.85 });
    const cap = () => {
      const c = sphere(0.27, m, 24);
      c.scale.set(1.02, 0.75, 1.02);
      c.position.set(0, 0.07, -0.03);
      this.head.add(c);
      return c;
    };
    switch (style) {
      case 'bun':
        cap();
        at(sphere(0.12, m), 0, 0.27, -0.12, this.head);
        break;
      case 'short':
        cap();
        break;
      case 'side': {
        const c = cap();
        c.rotation.z = 0.15;
        break;
      }
      case 'spiky':
        cap();
        if (!hasHat) for (let i = 0; i < 6; i++) {
          const s = cone(0.06, 0.16, m, 8);
          const a = (i / 6) * Math.PI * 2;
          s.position.set(Math.cos(a) * 0.12, 0.26, Math.sin(a) * 0.12 - 0.02);
          s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          this.head.add(s);
        }
        break;
      case 'long': {
        cap();
        const back = capsule(0.2, 0.28, m);
        back.position.set(0, -0.12, -0.1);
        back.scale.set(1.25, 1, 0.7);
        this.head.add(back);
        break;
      }
      case 'ponytail': {
        cap();
        const tail = capsule(0.07, 0.25, m);
        tail.position.set(0, 0.0, -0.3);
        tail.rotation.x = 0.5;
        this.head.add(tail);
        break;
      }
      case 'curly':
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          at(sphere(0.085, m, 10), Math.cos(a) * 0.2, 0.17 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.2 - 0.04, this.head);
        }
        at(sphere(0.13, m), 0, 0.25, -0.03, this.head);
        break;
      case 'wild':
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const r = 0.22 + (i % 3) * 0.03;
          at(sphere(0.09, m, 10), Math.cos(a) * r, 0.12 + (i % 4) * 0.04, Math.sin(a) * r - 0.06, this.head);
        }
        break;
      case 'mohawk':
        for (let i = 0; i < 5; i++) {
          const s = cone(0.05, 0.2, m, 8);
          s.position.set(0, 0.27, 0.12 - i * 0.08);
          this.head.add(s);
        }
        break;
    }
  }

  private buildHat(kind: string, color: string): void {
    const h = group(this.head);
    h.position.y = 0.16;
    const m = mat(color, { rough: 0.6 });
    switch (kind) {
      case 'cap': {
        const dome = sphere(0.27, m, 24);
        dome.scale.set(1, 0.55, 1);
        h.add(dome);
        const brim = cyl(0.17, 0.17, 0.02, m);
        brim.scale.z = 0.8;
        brim.position.set(0, -0.01, 0.22);
        h.add(brim);
        break;
      }
      case 'police':
      case 'chief':
      case 'military': {
        const top = cyl(0.3, 0.25, 0.14, m);
        top.position.y = 0.07;
        h.add(top);
        const band = cyl(0.255, 0.255, 0.05, kind === 'chief' ? '#f2c318' : '#111111');
        band.position.y = 0.02;
        h.add(band);
        const visor = cyl(0.16, 0.16, 0.02, '#111111');
        visor.scale.z = 0.7;
        visor.position.set(0, -0.01, 0.2);
        h.add(visor);
        at(sphere(0.035, '#f2c318'), 0, 0.08, 0.27, h);
        break;
      }
      case 'chef': {
        const tall = cyl(0.2, 0.22, 0.3, '#ffffff');
        tall.position.y = 0.14;
        h.add(tall);
        for (let i = 0; i < 5; i++) at(sphere(0.11, '#ffffff'), Math.cos(i * 1.25) * 0.1, 0.32, Math.sin(i * 1.25) * 0.1, h);
        break;
      }
      case 'fedora':
      case 'cowboy': {
        const brim = cyl(0.42, 0.42, 0.02, m);
        h.add(brim);
        const crown = cyl(0.2, 0.25, 0.18, m);
        crown.position.y = 0.09;
        h.add(crown);
        at(cyl(0.252, 0.252, 0.04, '#222222'), 0, 0.03, 0, h);
        break;
      }
      case 'hardhat':
      case 'miner': {
        const dome = sphere(0.29, m, 24);
        dome.scale.set(1, 0.65, 1.05);
        h.add(dome);
        const brim = cyl(0.33, 0.33, 0.02, m);
        brim.position.y = -0.01;
        h.add(brim);
        at(rbox(0.04, 0.2, 0.3, 0.02, m), 0, 0.17, 0, h);
        if (kind === 'miner') {
          const lamp = cyl(0.06, 0.06, 0.06, '#dddddd');
          lamp.rotation.x = Math.PI / 2;
          at(lamp, 0, 0.08, 0.28, h);
          at(sphere(0.05, mat('#fff7b0', { emissive: '#fff4a0', emissiveIntensity: 2 })), 0, 0.08, 0.31, h);
        }
        break;
      }
      case 'propeller': {
        const dome = sphere(0.27, m, 24);
        dome.scale.set(1, 0.55, 1);
        h.add(dome);
        const stripe = sphere(0.272, '#ff4d6d', 24);
        stripe.scale.set(0.35, 0.56, 1.0);
        h.add(stripe);
        const p = group(h);
        p.position.y = 0.17;
        at(cyl(0.012, 0.012, 0.08, '#888888'), 0, -0.02, 0, p);
        for (const c of ['#ffd23f', '#21c7a8']) {
          const blade = rbox(0.24, 0.012, 0.05, 0.01, c);
          blade.rotation.y = c === '#ffd23f' ? 0 : Math.PI / 2;
          p.add(blade);
        }
        this.propeller = p;
        break;
      }
      case 'top': {
        const brim = cyl(0.36, 0.36, 0.02, m);
        h.add(brim);
        const crown = cyl(0.22, 0.22, 0.38, m);
        crown.position.y = 0.19;
        h.add(crown);
        at(cyl(0.225, 0.225, 0.06, '#c0392b'), 0, 0.05, 0, h);
        break;
      }
      case 'straw':
      case 'beekeeper': {
        const brim = cyl(0.46, 0.46, 0.02, mat(color, { rough: 0.9 }));
        h.add(brim);
        const crown = cyl(0.2, 0.25, 0.15, mat(color, { rough: 0.9 }));
        crown.position.y = 0.075;
        h.add(crown);
        if (kind === 'beekeeper') {
          const veil = cyl(0.42, 0.42, 0.45, mat('#ffffff', { opacity: 0.25, side: THREE.DoubleSide }), 24, undefined, true);
          veil.position.y = -0.23;
          h.add(veil);
        } else {
          at(cyl(0.252, 0.252, 0.04, '#e76f51'), 0, 0.03, 0, h);
        }
        break;
      }
      case 'beret': {
        const b = sphere(0.28, m, 20);
        b.scale.set(1.05, 0.35, 1.05);
        b.position.set(0.04, 0.03, -0.02);
        b.rotation.z = -0.2;
        h.add(b);
        break;
      }
      case 'space': {
        const helmet = sphere(0.4, mat('#cfefff', { opacity: 0.25, rough: 0.05, env: 2 }), 28);
        helmet.position.y = -0.16;
        h.add(helmet);
        const ring = torus(0.3, 0.04, '#e0e0e0');
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.48;
        h.add(ring);
        break;
      }
      case 'bucket': {
        const crown = cyl(0.22, 0.27, 0.16, m);
        crown.position.y = 0.06;
        h.add(crown);
        const brim = cyl(0.36, 0.3, 0.06, m, 24, undefined, true);
        brim.position.y = -0.02;
        h.add(brim);
        break;
      }
      case 'headband': {
        const band = torus(0.262, 0.03, m);
        band.rotation.x = Math.PI / 2;
        band.position.y = -0.06;
        h.add(band);
        break;
      }
      case 'hairnet': {
        const net = sphere(0.285, mat('#f4f4f4', { opacity: 0.6 }), 20);
        net.scale.set(1, 0.6, 1);
        net.position.y = -0.04;
        h.add(net);
        break;
      }
      case 'wizard': {
        const brim = cyl(0.4, 0.4, 0.02, m);
        h.add(brim);
        const c = cone(0.24, 0.5, m, 20);
        c.position.y = 0.25;
        c.rotation.z = 0.15;
        h.add(c);
        break;
      }
    }
  }

  private buildEyewear(kind: string): void {
    const g = group(this.head);
    g.position.set(0, 0.04, 0.245);
    switch (kind) {
      case 'glasses':
        for (const s of [-1, 1]) at(torus(0.06, 0.009, '#3d3d3d'), s * 0.09, 0, 0, g);
        at(box(0.06, 0.01, 0.01, '#3d3d3d'), 0, 0.01, 0, g);
        break;
      case 'sunglasses':
        for (const s of [-1, 1]) at(rbox(0.12, 0.075, 0.02, 0.02, mat('#111111', { rough: 0.15, metal: 0.4 })), s * 0.09, 0, 0.01, g);
        at(box(0.07, 0.015, 0.015, '#111111'), 0, 0.02, 0.01, g);
        break;
      case 'goggles':
        for (const s of [-1, 1]) {
          at(torus(0.065, 0.02, '#ffb627'), s * 0.09, 0, 0.005, g);
          at(sphere(0.06, mat('#8fe3ff', { opacity: 0.45, rough: 0.1 }), 14), s * 0.09, 0, 0.0, g).scale.z = 0.4;
        }
        {
          const strap = torus(0.27, 0.018, '#333333');
          strap.rotation.x = Math.PI / 2;
          strap.position.set(0, -0.0, -0.245);
          g.add(strap);
        }
        break;
      case 'monocle':
        at(torus(0.065, 0.01, '#f2c318'), 0.09, 0, 0.01, g);
        at(sphere(0.06, mat('#dff6ff', { opacity: 0.35 }), 12), 0.09, 0, 0, g).scale.z = 0.3;
        break;
    }
  }

  private buildExtra(kind: string, shirt: string): void {
    const b = this.body;
    switch (kind) {
      case 'tie': {
        const t = box(0.07, 0.3, 0.02, '#c0392b');
        at(t, 0, 0.66, 0.27, b);
        break;
      }
      case 'bowtie':
        for (const s of [-1, 1]) at(cone(0.05, 0.08, '#e63946', 4), s * 0.04, 0.84, 0.25, b).rotation.z = (s * Math.PI) / 2;
        break;
      case 'badge':
        at(cyl(0.05, 0.05, 0.02, mat('#f2c318', { metal: 0.6, rough: 0.3 })), -0.12, 0.68, 0.26, b).rotation.x = Math.PI / 2;
        break;
      case 'vest': {
        const v = capsule(0.28, 0.32, mat('#ff8c1a', { rough: 0.6 }));
        v.scale.set(1.02, 0.85, 1.04);
        at(v, 0, 0.43, 0, b);
        for (const y of [0.45, 0.6]) at(box(0.58, 0.035, 0.6, '#f5f5f5', { emissive: '#ffffff', emissiveIntensity: 0.2 }), 0, y, 0, b);
        break;
      }
      case 'medals':
        for (let i = 0; i < 3; i++) at(cyl(0.03, 0.03, 0.015, ['#f2c318', '#c0c0c0', '#cd7f32'][i]), -0.18 + i * 0.07, 0.66, 0.255, b).rotation.x = Math.PI / 2;
        break;
      case 'sash': {
        const s = box(0.1, 0.75, 0.6, '#c0392b');
        s.rotation.z = 0.6;
        s.scale.z = 0.95;
        at(s, 0, 0.5, 0, b);
        break;
      }
      case 'antenna':
        for (const s of [-1, 1]) {
          const a = cyl(0.01, 0.01, 0.25, '#4caf50');
          a.rotation.z = s * -0.3;
          at(a, s * 0.08, 0.32, 0, this.head);
          at(sphere(0.035, mat('#d4ff00', { emissive: '#aaff00', emissiveIntensity: 0.8 })), s * 0.115, 0.44, 0, this.head);
        }
        break;
      case 'apron': {
        const a = box(0.42, 0.5, 0.04, '#ffffff');
        at(a, 0, 0.4, 0.25, b);
        break;
      }
      case 'earpiece': {
        at(sphere(0.025, '#222222'), 0.26, -0.02, 0.02, this.head);
        break;
      }
      case 'pearls': {
        const p = torus(0.2, 0.025, mat('#fffaf0', { rough: 0.2 }));
        p.rotation.x = Math.PI / 2 - 0.25;
        at(p, 0, 0.8, 0.03, b);
        break;
      }
      case 'labcoat': {
        const coat = capsule(0.285, 0.4, mat('#fbfbfb', { rough: 0.7 }));
        coat.scale.set(1.03, 0.92, 1.0);
        at(coat, 0, 0.43, -0.012, b);
        at(box(0.1, 0.36, 0.02, shirt), 0, 0.66, 0.275, b);
        break;
      }
      case 'scarf': {
        const s = torus(0.19, 0.05, '#e63946');
        s.rotation.x = Math.PI / 2;
        at(s, 0, 0.86, 0, b);
        break;
      }
    }
  }

  setExpression(e: Expression): void {
    this.expr = e;
    const happy = e === 'happy';
    const angry = e === 'angry';
    const surprised = e === 'surprised' || e === 'talk';
    this.mouthSmile.visible = e === 'neutral' || happy;
    this.mouthSmile.scale.set(happy ? 1.35 : 0.9, happy ? 1.4 : 0.8, 1);
    this.mouthFrown.visible = angry || e === 'sick';
    this.mouthO.visible = surprised;
    this.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.rotation.z = angry ? s * -0.45 : happy ? s * 0.15 : surprised ? s * 0.1 : 0;
      b.position.y = happy || surprised ? 0.15 : angry ? 0.12 : 0.135;
    });
    this.skinMat.color.copy(this.baseSkin);
    if (angry) this.skinMat.color.lerp(new THREE.Color('#ff6b6b'), 0.35);
    if (e === 'sick') this.skinMat.color.lerp(new THREE.Color('#8fd16b'), 0.45);
  }

  get expression(): Expression {
    return this.expr;
  }

  talk(sec: number): void {
    this.talking = Math.max(this.talking, sec);
  }

  react(kind: 'happy' | 'angry' | 'surprised'): void {
    this.setExpression(kind);
    if (kind === 'happy') this.jump = 1;
    if (kind === 'angry') this.shake = 1;
    if (kind === 'surprised') this.jump = 0.4;
  }

  update(dt: number, lookAt?: THREE.Vector3): void {
    this.t += dt;
    const t = this.t;
    // idle bob & sway
    this.body.position.y = Math.sin(t * 2.2) * 0.012;
    this.body.rotation.z = Math.sin(t * 1.3) * 0.02;
    this.head.rotation.z = Math.sin(t * 1.7) * 0.04;
    // arms
    const wave = this.expr === 'happy' ? Math.sin(t * 14) * 0.5 + 2.4 : this.expr === 'angry' ? Math.sin(t * 20) * 0.25 + 0.9 : Math.sin(t * 1.5) * 0.06;
    this.armL.rotation.z = -0.18 - (this.expr === 'happy' ? wave : this.expr === 'angry' ? 0.5 : wave);
    this.armR.rotation.z = 0.18 + (this.expr === 'happy' ? wave : this.expr === 'angry' ? wave : wave);
    // blink
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0.12) blink = Math.max(0.1, Math.abs(this.blinkT - 0.06) / 0.06);
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = blink;
    // pupils look at camera
    if (lookAt) {
      const local = this.head.worldToLocal(lookAt.clone());
      const dir = local.normalize();
      for (const p of this.pupils) {
        p.position.x = dir.x * 0.018;
        p.position.y = dir.y * 0.018;
      }
    }
    // talking mouth
    if (this.talking > 0) {
      this.talking -= dt;
      const open = 0.5 + Math.abs(Math.sin(t * 18)) * 0.9;
      this.mouthO.visible = true;
      this.mouthSmile.visible = false;
      this.mouthFrown.visible = false;
      this.mouthO.scale.set(1, open, 0.4);
      if (this.talking <= 0) this.setExpression(this.expr === 'talk' ? 'neutral' : this.expr);
    }
    // reactions
    if (this.jump > 0) {
      this.jump = Math.max(0, this.jump - dt * 1.2);
      this.body.position.y += Math.abs(Math.sin((1 - this.jump) * Math.PI * 3)) * 0.18 * this.jump;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 0.9);
      this.body.position.x = Math.sin(t * 50) * 0.04 * this.shake;
    } else this.body.position.x = 0;
    if (this.propeller) this.propeller.rotation.y += dt * (this.expr === 'happy' ? 30 : 6);
  }
}
