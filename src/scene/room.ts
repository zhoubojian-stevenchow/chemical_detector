import * as THREE from 'three';
import { at, box, cyl, glassMat, group, lathe, mat, mergeStatic, rbox, sphere, umat } from './kit';
import {
  AccidentSign, backdropTexture, companySignTexture, floorTexture, periodicTableTexture, posterTexture, tileWallTexture,
} from './textures';

export const BENCH_Y = 0.95;
export const WINDOW = { x0: -1.25, x1: 1.25, y0: 1.05, y1: 2.45, z: -2.4 };

/** The lab room: floor, walls, drop-off window, bench, shelves, decor. */
export class Room {
  readonly root = new THREE.Group();
  private wallMat: THREE.MeshStandardMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private accentMats: THREE.MeshStandardMaterial[] = [];
  private backdropMat: THREE.MeshBasicMaterial;
  private dayTex = backdropTexture(false);
  private nightTex = backdropTexture(true);
  readonly accidentSign = new AccidentSign();
  readonly clockHand = new THREE.Group();
  readonly clockMinute = new THREE.Group();
  readonly lampLight: THREE.PointLight;
  readonly windowLight: THREE.SpotLight;

  constructor() {
    const r = this.root;
    // floor
    this.floorMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.4), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.6);
    floor.receiveShadow = true;
    r.add(floor);

    // back wall with window hole
    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const W = WINDOW;
    const wallT = 0.12;
    const wz = W.z;
    const leftW = 4.5 + W.x0;
    const pieces: [number, number, number, number][] = [
      // [cx, cy, w, h]
      [(-4.5 + W.x0) / 2, 1.75, leftW, 3.5],
      [(4.5 + W.x1) / 2, 1.75, 4.5 - W.x1, 3.5],
      [0, (W.y1 + 3.5) / 2, W.x1 - W.x0, 3.5 - W.y1],
      [0, W.y0 / 2, W.x1 - W.x0, W.y0],
    ];
    for (const [cx, cy, w, h] of pieces) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), this.wallMat);
      m.position.set(cx, cy, wz);
      m.receiveShadow = true;
      r.add(m);
    }
    // side walls
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.5, 6), this.wallMat);
      m.position.set(s * 4.4, 1.75, 0.5);
      m.receiveShadow = true;
      r.add(m);
    }
    // baseboard
    const accent = umat('#21c7a8', { rough: 0.5 });
    this.accentMats.push(accent);
    at(box(9, 0.14, 0.04, accent), 0, 0.07, wz + 0.08, r);

    // window frame & counter
    const frame = umat('#2b2d42', { rough: 0.5 });
    this.accentMats.push(frame);
    const fw = 0.09;
    at(rbox(W.x1 - W.x0 + fw * 2, fw, 0.2, 0.02, frame), 0, W.y1 + fw / 2, wz, r);
    at(rbox(fw, W.y1 - W.y0, 0.2, 0.02, frame), W.x0 - fw / 2, (W.y0 + W.y1) / 2, wz, r);
    at(rbox(fw, W.y1 - W.y0, 0.2, 0.02, frame), W.x1 + fw / 2, (W.y0 + W.y1) / 2, wz, r);
    const sill = rbox(W.x1 - W.x0 + 0.4, 0.06, 0.62, 0.02, '#e9ecef');
    at(sill, 0, W.y0 - 0.03, wz - 0.05, r);
    // a bell on the counter
    at(cyl(0.05, 0.06, 0.012, '#2b2d42'), 0.9, W.y0 + 0.006, wz + 0.12, r);
    const bell = sphere(0.045, mat('#f2c318', { metal: 0.85, rough: 0.25 }), 16);
    bell.scale.y = 0.8;
    at(bell, 0.9, W.y0 + 0.03, wz + 0.12, r);

    // outside
    this.backdropMat = new THREE.MeshBasicMaterial({ map: this.dayTex });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), this.backdropMat);
    backdrop.position.set(0, 2.6, -8.5);
    r.add(backdrop);
    const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 6.5), mat('#cfd6df', { rough: 0.9 }));
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.2, -5.5);
    street.receiveShadow = true;
    r.add(street);

    // sign above window
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.406), new THREE.MeshStandardMaterial({ map: companySignTexture(), roughness: 0.6 }));
    sign.position.set(0, 2.8, wz + 0.07);
    r.add(sign);

    // accident sign
    const acc = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.39), new THREE.MeshStandardMaterial({ map: this.accidentSign.texture, roughness: 0.6 }));
    acc.position.set(-1.75, 2.05, wz + 0.078);
    r.add(acc);
    at(rbox(0.54, 0.43, 0.02, 0.01, '#2b2d42'), -1.75, 2.05, wz + 0.06, r);

    // clock
    const clockG = group(r);
    clockG.position.set(1.75, 2.15, wz + 0.08);
    const rim = cyl(0.26, 0.26, 0.05, '#e63946', 32);
    rim.rotation.x = Math.PI / 2;
    clockG.add(rim);
    const face = cyl(0.225, 0.225, 0.052, '#ffffff', 32);
    face.rotation.x = Math.PI / 2;
    clockG.add(face);
    for (let i = 0; i < 12; i++) {
      const tick = box(0.012, i % 3 === 0 ? 0.05 : 0.03, 0.01, '#2b2d42');
      const a = (i / 12) * Math.PI * 2;
      tick.position.set(Math.sin(a) * 0.19, Math.cos(a) * 0.19, 0.03);
      tick.rotation.z = -a;
      clockG.add(tick);
    }
    clockG.add(this.clockHand);
    clockG.add(this.clockMinute);
    const hh = box(0.016, 0.12, 0.01, '#2b2d42');
    hh.position.y = 0.06;
    this.clockMinute.add(hh);
    const mh = box(0.01, 0.18, 0.01, '#e63946');
    mh.position.y = 0.09;
    this.clockHand.add(mh);
    this.clockHand.position.z = 0.04;
    this.clockMinute.position.z = 0.035;
    at(sphere(0.02, '#2b2d42'), 0, 0, 0.045, clockG);

    // posters
    const pt = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.66), new THREE.MeshStandardMaterial({ map: periodicTableTexture(), roughness: 0.7 }));
    pt.position.set(-3.0, 2.0, wz + 0.07);
    r.add(pt);
    const posters: ['safety' | 'notaste' | 'gerald' | 'motivation', number, number][] = [
      ['safety', 2.65, 2.0],
      ['notaste', 3.5, 1.9],
      ['gerald', -2.0, 1.15],
    ];
    for (const [k, x, y] of posters) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.59), new THREE.MeshStandardMaterial({ map: posterTexture(k), roughness: 0.7 }));
      p.position.set(x, y, wz + 0.07);
      p.rotation.z = (Math.random() - 0.5) * 0.06;
      r.add(p);
    }

    // shelves with bottles on the back wall (left & right of window)
    const bottleColors = ['#ff6b6b', '#ffd23f', '#21c7a8', '#4da6ff', '#b388ff', '#ff9f43', '#7bed9f', '#ff7eb6'];
    for (const [sx, y] of [[-2.65, 1.35], [2.95, 1.35], [-3.05, 2.6], [2.95, 2.65]] as [number, number][]) {
      at(rbox(1.2, 0.04, 0.3, 0.01, '#c08552'), sx, y, wz + 0.17, r);
      for (const s of [-1, 1]) at(box(0.03, 0.12, 0.25, '#8d5b3a'), sx + s * 0.45, y - 0.08, wz + 0.16, r);
      for (let i = 0; i < 6; i++) {
        const c = bottleColors[(i + Math.round(sx * 3) + Math.round(y * 5)) % bottleColors.length];
        const kind = (i + Math.round(y * 7)) % 3;
        const g = group(r);
        g.position.set(sx - 0.5 + i * 0.2, y + 0.02, wz + 0.17);
        if (kind === 0) {
          g.add(lathe([[0, 0], [0.05, 0], [0.05, 0.13], [0.022, 0.17], [0.022, 0.2]], glassMat(), 16));
          at(cyl(0.046, 0.046, 0.09, mat(c, { opacity: 0.85, rough: 0.2 })), 0, 0.05, 0, g);
          at(cyl(0.024, 0.024, 0.03, '#2b2d42'), 0, 0.21, 0, g);
        } else if (kind === 1) {
          g.add(lathe([[0, 0], [0.065, 0], [0.065, 0.01], [0.025, 0.12], [0.02, 0.17]], glassMat(), 16));
          at(cyl(0.02, 0.06, 0.06, mat(c, { opacity: 0.85, rough: 0.2 })), 0, 0.035, 0, g);
        } else {
          at(rbox(0.09, 0.14, 0.09, 0.015, mat(c, { rough: 0.4 })), 0, 0.07, 0, g);
          at(rbox(0.07, 0.05, 0.001, 0.002, '#ffffff'), 0, 0.07, 0.046, g);
        }
      }
    }

    // fume hood on the left wall & fridge on the right
    const hood = group(r);
    hood.position.set(-3.9, 0, -1.2);
    hood.rotation.y = Math.PI / 2;
    at(rbox(1.3, 0.95, 0.8, 0.02, '#dfe6ee'), 0, 0.475, 0, hood);
    at(rbox(1.3, 0.9, 0.8, 0.02, '#c9d3dd'), 0, 2.2, 0, hood);
    at(rbox(1.24, 0.75, 0.04, 0.01, mat('#bfe9ff', { opacity: 0.35, rough: 0.05 })), 0, 1.35, 0.35, hood);
    const fridge = group(r);
    fridge.position.set(3.9, 0, -1.3);
    fridge.rotation.y = -Math.PI / 2;
    at(rbox(0.8, 1.9, 0.7, 0.05, '#f5f6fa'), 0, 0.95, 0, fridge);
    at(rbox(0.04, 0.4, 0.04, 0.01, '#9aa7b8'), 0.3, 1.3, 0.37, fridge);
    const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.08, 20), mat('#ff6b6b'));
    sticker.position.set(-0.1, 1.5, 0.351);
    fridge.add(sticker);

    // plant
    const plant = group(r);
    plant.position.set(-3.3, 0, 0.6);
    at(cyl(0.18, 0.14, 0.35, '#e76f51'), 0, 0.175, 0, plant);
    for (let i = 0; i < 9; i++) {
      const leaf = sphere(0.14, mat('#2a9d8f', { rough: 0.7 }), 10);
      leaf.scale.set(0.5, 1.4, 0.25);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.1, 0.55 + (i % 3) * 0.08, Math.sin(a) * 0.1);
      leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
      plant.add(leaf);
    }

    // ceiling lamp
    const lamp = group(r);
    lamp.position.set(0, 3.2, -0.3);
    at(cyl(0.005, 0.005, 0.6, '#2b2d42'), 0, 0.3, 0, lamp);
    const shadeM = cyl(0.08, 0.32, 0.22, mat('#ffd23f', { rough: 0.4, side: THREE.DoubleSide }), 24, undefined, true);
    lamp.add(shadeM);
    at(sphere(0.07, mat('#fff8e1', { emissive: '#fff3c4', emissiveIntensity: 1.5 })), 0, -0.06, 0, lamp);
    this.lampLight = new THREE.PointLight('#fff1d6', 6, 7, 1.6);
    this.lampLight.position.set(0, 2.9, -0.3);
    r.add(this.lampLight);

    // daylight through the window
    this.windowLight = new THREE.SpotLight('#ffffff', 10, 9, 0.7, 0.6, 1.2);
    this.windowLight.position.set(0, 2.4, -4.5);
    this.windowLight.target.position.set(0, 1.0, -1.0);
    r.add(this.windowLight, this.windowLight.target);

    this.buildBench();
    this.clockHand.userData.dynamic = true;
    this.clockMinute.userData.dynamic = true;
    mergeStatic(this.root);
  }

  private buildBench(): void {
    const r = this.root;
    const top = rbox(5.6, 0.06, 1.35, 0.02, mat('#3d4a5c', { rough: 0.35 }));
    top.position.set(0, BENCH_Y - 0.03, -0.45);
    r.add(top);
    const cab = umat('#f4f1ea', { rough: 0.6 });
    const body = rbox(5.5, BENCH_Y - 0.06, 1.25, 0.02, cab);
    body.position.set(0, (BENCH_Y - 0.06) / 2, -0.45);
    r.add(body);
    const door = umat('#21c7a8', { rough: 0.5 });
    this.accentMats.push(door);
    for (let i = 0; i < 7; i++) {
      const x = -2.4 + i * 0.8;
      at(rbox(0.72, 0.66, 0.03, 0.02, door), x, 0.45, 0.19, r);
      at(rbox(0.16, 0.025, 0.03, 0.01, '#e9ecef'), x, 0.68, 0.215, r);
    }
    // sample mat in the centre
    const matTop = rbox(0.42, 0.012, 0.32, 0.03, '#ffd23f');
    matTop.position.set(0, BENCH_Y + 0.006, -0.05);
    r.add(matTop);
    // little props
    const mug = group(r);
    mug.position.set(-2.1, BENCH_Y, -0.9);
    at(cyl(0.05, 0.045, 0.11, '#ff6b6b'), 0, 0.055, 0, mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16), mat('#ff6b6b'));
    handle.position.set(0.055, 0.06, 0);
    mug.add(handle);
    const books = group(r);
    books.position.set(2.1, BENCH_Y, 0.0);
    ['#4b7bec', '#ff9f43', '#26de81'].forEach((c, i) => {
      const b = rbox(0.28, 0.05, 0.2, 0.01, c);
      b.position.y = 0.025 + i * 0.05;
      b.rotation.y = i * 0.2;
      books.add(b);
    });
  }

  applyTheme(colors: [string, string, string, string]): void {
    const [wall, fa, fb, accent] = colors;
    this.wallMat.map?.dispose();
    this.floorMat.map?.dispose();
    const t = tileWallTexture(wall);
    t.repeat.set(6, 3);
    this.wallMat.map = t;
    this.wallMat.color.set('#ffffff');
    this.wallMat.needsUpdate = true;
    const ft = floorTexture(fa, fb);
    this.floorMat.map = ft;
    this.floorMat.needsUpdate = true;
    for (const m of this.accentMats) {
      if (m.color.getHexString() !== '2b2d42') m.color.set(accent);
    }
  }

  setNight(night: boolean): void {
    this.backdropMat.map = night ? this.nightTex : this.dayTex;
    this.backdropMat.needsUpdate = true;
    this.windowLight.color.set(night ? '#7c83ff' : '#ffffff');
    this.windowLight.intensity = night ? 3 : 10;
  }

  /** k = fraction of shift time left */
  setClock(k: number): void {
    this.clockHand.rotation.z = -(1 - k) * Math.PI * 2;
    this.clockMinute.rotation.z = -(1 - k) * Math.PI * 0.5;
  }
}
