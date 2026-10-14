import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/main.css';
import { audio } from './core/audio';
import { save } from './core/save';
import { pick } from './core/util';
import { GAME } from './config';
import { LOADING_LINES } from './data/text';
import { App } from './game/app';
import { ads } from './platform';
import { LabScene } from './scene/lab';

function bootProgress(k: number, msg?: string): void {
  const fill = document.getElementById('boot-fill');
  if (fill) fill.style.width = `${Math.round(k * 100)}%`;
  const m = document.getElementById('boot-msg');
  if (m && msg) m.textContent = msg;
  ads.platform.loadingProgress(k);
}

function showFatal(err: unknown): void {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('done');
    boot.innerHTML = `<div class="boot-logo">${GAME.title}</div><div class="boot-msg" style="max-width:80vw;text-align:center">Oops! Your browser could not start the 3D lab.<br>Please enable hardware acceleration / WebGL and reload.<br><small>${String((err as Error)?.message ?? err)}</small></div>`;
  }
}

async function boot(): Promise<void> {
  document.title = GAME.title;
  const logo = document.querySelector('.boot-logo');
  if (logo) logo.textContent = GAME.title;
  bootProgress(0.05, pick(LOADING_LINES));

  // platform SDK first (some portals require init before anything else)
  await ads.init();
  bootProgress(0.3, pick(LOADING_LINES));

  if (ads.platform.storage) save.setStore(ads.platform.storage);
  save.load();

  // fonts are needed before we paint canvas textures
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 40px Fredoka'), document.fonts.load('600 20px Fredoka'), document.fonts.load('500 20px Fredoka')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system font */
  }
  bootProgress(0.55, pick(LOADING_LINES));

  const stage = document.getElementById('stage')!;
  const layer = document.getElementById('ui')!;
  let lab: LabScene;
  try {
    // ?lowgfx=1 (or the "Low" graphics setting) starts without MSAA for weak GPUs
    const lowGfx = /[?&]lowgfx=1/.test(location.search) || save.data.settings.quality === 'low';
    lab = new LabScene(stage, { antialias: !lowGfx });
    if (/[?&]lowgfx=1/.test(location.search)) save.data.settings.quality = 'low';
  } catch (e) {
    showFatal(e);
    return;
  }
  bootProgress(0.85, pick(LOADING_LINES));

  const app = new App(layer, lab);
  (window as any).__app = app;
  if (import.meta.env.DEV) devCheats(app);
  app.applySettings();
  app.updateInsets();
  window.addEventListener('resize', () => app.updateInsets());
  lab.snap('menu');

  // audio can only start after a user gesture
  // (iOS Safari only counts touchend/click as a user activation, so listen to all of them)
  const unlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'];
  const unlock = () => {
    audio.unlock();
    app.applySettings();
    if (audio.ready) unlockEvents.forEach((ev) => window.removeEventListener(ev, unlock, true));
  };
  unlockEvents.forEach((ev) => window.addEventListener(ev, unlock, true));

  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));
  window.addEventListener('beforeunload', () => save.flush());
  window.addEventListener('pagehide', () => save.flush());
  // block context menu & pinch zoom inside the game frame
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    // keep the page from scrolling inside portal iframes
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !(e.target as HTMLElement)?.matches?.('input')) e.preventDefault();
  });

  bootProgress(1, 'Ready!');
  await new Promise((r) => setTimeout(r, 250));
  document.getElementById('boot')?.classList.add('done');
  setTimeout(() => document.getElementById('boot')?.remove(), 600);
  ads.platform.loadingFinished();
  app.showTitle();
}

boot().catch((e) => {
  console.error(e);
  showFatal(e);
});

/** Development-only helpers (stripped from production builds). */
function devCheats(app: App): void {
  const q = new URLSearchParams(location.search);
  if (q.has('fresh')) save.reset();
  const d = save.data;
  if (q.has('unlockall')) {
    for (let i = 1; i <= 60; i++) d.levels[i] = d.levels[i] ?? { stars: [true, true, true], best: 0 };
    d.coins = Math.max(d.coins, 50000);
    d.xp = Math.max(d.xp, 8000);
  }
  if (q.has('coins')) d.coins = Number(q.get('coins'));
  const lvl = Number(q.get('level'));
  if (lvl) {
    for (let i = 1; i < lvl; i++) d.levels[i] = d.levels[i] ?? { stars: [true, false, false], best: 0 };
    for (const f of ['tut1', 'tut2', 'tut3']) d.flags[f] = true;
    setTimeout(() => app.startLevel(lvl), 300);
  }
}
