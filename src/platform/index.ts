import { audio } from '../core/audio';
import {
  AdSensePlatform, CrazyGamesPlatform, GameDistributionPlatform, LocalPlatform, NoAdsPlatform, PokiPlatform,
} from './adapters';
import type { Platform } from './types';

function pickPlatform(): Platform {
  // `?platform=` overrides are for development only (never trust URL params in shipped builds)
  const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('platform') : null;
  const name = (forced || import.meta.env.VITE_PLATFORM || 'none').toLowerCase();
  switch (name) {
    case 'poki':
      return new PokiPlatform();
    case 'crazygames':
      return new CrazyGamesPlatform();
    case 'gamedistribution':
      return new GameDistributionPlatform(import.meta.env.VITE_GD_GAME_ID || '');
    case 'adsense':
      return new AdSensePlatform(import.meta.env.VITE_ADSENSE_CLIENT || '', (import.meta.env.VITE_ADSENSE_TEST || 'on') !== 'off');
    case 'local':
      return new LocalPlatform();
    default:
      return new NoAdsPlatform();
  }
}

/**
 * Ad manager: wraps the platform with the rules every portal asks for —
 * mute + pause during ads, never stack ads, and cap interstitial frequency.
 */
class AdManager {
  platform: Platform = pickPlatform();
  busy = false;
  private lastInterstitial = 0;
  private gameplay = false;
  /** Called with true while an ad is on screen (the game pauses). */
  onAdState: (playing: boolean) => void = () => {};

  /** Minimum gap between interstitials we request (platforms also cap on their side). */
  minGapMs = 120000;

  get hasRewarded(): boolean {
    return this.platform.hasRewarded;
  }

  async init(): Promise<void> {
    try {
      await this.platform.init();
    } catch {
      this.platform = new NoAdsPlatform();
    }
    this.lastInterstitial = performance.now() - this.minGapMs + 45000; // no ad in the first ~45 s
  }

  gameplayStart(): void {
    if (this.gameplay) return;
    this.gameplay = true;
    this.platform.gameplayStart();
  }

  gameplayStop(): void {
    if (!this.gameplay) return;
    this.gameplay = false;
    this.platform.gameplayStop();
  }

  private begin(): void {
    this.busy = true;
    audio.setAdMute(true);
    this.onAdState(true);
  }

  private end(): void {
    this.busy = false;
    audio.setAdMute(false);
    this.onAdState(false);
  }

  /** Interstitial when the player presses PLAY (only on platforms that ask for it). */
  async playBreak(): Promise<void> {
    if (!this.platform.adOnPlay) return;
    await this.interstitial(true);
  }

  /** Interstitial at a natural break (between shifts). */
  async interstitial(force = false): Promise<void> {
    if (this.busy) return;
    const now = performance.now();
    if (!force && now - this.lastInterstitial < this.minGapMs) return;
    const wasPlaying = this.gameplay;
    this.gameplayStop();
    let started = false;
    try {
      await this.platform.commercialBreak(() => {
        started = true;
        this.begin();
      });
    } finally {
      if (started) this.end();
      this.lastInterstitial = performance.now();
      if (wasPlaying) this.gameplayStart();
    }
  }

  /** Rewarded ad. Resolves true if the reward should be granted. */
  async rewarded(): Promise<boolean> {
    if (this.busy || !this.hasRewarded) return false;
    const wasPlaying = this.gameplay;
    this.gameplayStop();
    let started = false;
    let ok = false;
    try {
      ok = await this.platform.rewardedBreak(() => {
        started = true;
        this.begin();
      });
    } catch {
      ok = false;
    } finally {
      if (started || this.busy) this.end();
      this.lastInterstitial = performance.now(); // don't follow a rewarded ad with an interstitial
      if (wasPlaying) this.gameplayStart();
    }
    return ok;
  }
}

export const ads = new AdManager();
