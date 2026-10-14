export type Ease = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface TweenItem {
  t: number;
  dur: number;
  delay: number;
  ease: Ease;
  update: (k: number) => void;
  resolve: () => void;
  done: boolean;
  tag?: string;
}

/** Frame-driven tween runner (driven by the game loop, so it pauses with the game). */
export class Tweens {
  private items: TweenItem[] = [];

  run(dur: number, update: (k: number) => void, ease: Ease = Easing.inOutQuad, delay = 0, tag?: string): Promise<void> {
    return new Promise((resolve) => {
      this.items.push({ t: 0, dur: Math.max(0.0001, dur), delay, ease, update, resolve, done: false, tag });
    });
  }

  /** Cancel tweens with a tag (they resolve immediately at their current value). */
  cancel(tag: string): void {
    for (const it of this.items) if (it.tag === tag && !it.done) { it.done = true; it.resolve(); }
  }

  wait(sec: number): Promise<void> {
    return this.run(sec, () => {}, Easing.linear);
  }

  update(dt: number): void {
    if (!this.items.length) return;
    for (const it of this.items) {
      if (it.done) continue;
      if (it.delay > 0) {
        it.delay -= dt;
        if (it.delay > 0) continue;
      }
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      it.update(it.ease(k));
      if (k >= 1) {
        it.done = true;
        it.resolve();
      }
    }
    this.items = this.items.filter((i) => !i.done);
  }

  clear(): void {
    for (const it of this.items) it.resolve();
    this.items = [];
  }
}
