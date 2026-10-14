// Branding & tuning knobs — change these to re-skin the game for a new owner.
export const GAME = {
  title: 'Chem Detective',
  subtitle: 'Lab of Questionable Samples',
  company: 'Sniff & Co. Testing Labs',
  version: '1.0.0',
  /** shown in the credits / settings screen */
  credits: 'Game design, code & procedural art: the Chem Detective team.\nFont: Fredoka (SIL Open Font License). 3D engine: three.js (MIT).',
  /** levels before interstitial ads are allowed at all */
  firstAdLevel: 3,
};

/** Max simulated time step per frame (seconds). `?dtcap=1` lets automated tests run on very slow renderers. */
export const DT_CAP = (() => {
  const m = typeof location !== 'undefined' ? /[?&]dtcap=([\d.]+)/.exec(location.search) : null;
  return m ? Number(m[1]) : 0.1;
})();

/** Dev-only: `?clock=0` freezes the shift clock (for screenshots / QA). Always 1 in production builds. */
export const CLOCK_SCALE = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 1;
  const m = /[?&]clock=([\d.]+)/.exec(location.search);
  return m ? Number(m[1]) : 1;
})();
