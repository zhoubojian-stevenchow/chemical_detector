import type { KVStore } from '../core/save';
import { loadScript, type Platform } from './types';

declare global {
  interface Window {
    PokiSDK?: any;
    CrazyGames?: any;
    gdsdk?: any;
    GD_OPTIONS?: any;
    adsbygoogle?: any[];
    adBreak?: (o: any) => void;
    adConfig?: (o: any) => void;
  }
}

/** No ads at all (self-hosted, ad-free build). Rewarded buttons are hidden. */
export class NoAdsPlatform implements Platform {
  readonly name: string = 'none';
  readonly hasRewarded: boolean = false;
  async init(): Promise<void> {}
  loadingProgress(): void {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async commercialBreak(_onStart: () => void): Promise<void> {}
  async rewardedBreak(_onStart: () => void): Promise<boolean> {
    return false;
  }
  happyTime(): void {}
}

/** Local development: shows a fake ad overlay so every ad flow can be tested. */
export class LocalPlatform extends NoAdsPlatform {
  readonly name = 'local';
  readonly hasRewarded = true;

  private overlay(kind: 'interstitial' | 'rewarded'): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.innerHTML = `<div class="fake-ad-box"><div class="fake-ad-tag">TEST AD</div><h2>${kind === 'rewarded' ? 'Rewarded ad' : 'Interstitial ad'}</h2>
        <p>This is a simulated ad (dev build). Real builds show the platform's ad here.</p>
        <div class="fake-ad-bar"><div></div></div>
        <div class="fake-ad-btns"><button data-r="1" disabled>Claim reward</button>${kind === 'rewarded' ? '<button data-r="0">Close early (no reward)</button>' : ''}</div></div>`;
      document.body.appendChild(el);
      const bar = el.querySelector('.fake-ad-bar div') as HTMLElement;
      const btn = el.querySelector('button[data-r="1"]') as HTMLButtonElement;
      const dur = kind === 'rewarded' ? 2500 : 1500;
      const start = performance.now();
      const iv = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - start) / dur);
        bar.style.width = `${k * 100}%`;
        if (k >= 1) {
          window.clearInterval(iv);
          btn.disabled = false;
          btn.textContent = kind === 'rewarded' ? 'Claim reward' : 'Continue';
        }
      }, 50);
      el.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b || b.disabled) return;
        window.clearInterval(iv);
        el.remove();
        resolve(b.getAttribute('data-r') === '1');
      });
    });
  }

  async commercialBreak(onStart: () => void): Promise<void> {
    onStart();
    await this.overlay('interstitial');
  }
  async rewardedBreak(onStart: () => void): Promise<boolean> {
    onStart();
    return this.overlay('rewarded');
  }
}

/** Poki — https://sdk.poki.com */
export class PokiPlatform implements Platform {
  readonly name = 'poki';
  readonly hasRewarded = true;
  private ok = false;

  async init(): Promise<void> {
    try {
      await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
      await window.PokiSDK.init();
      this.ok = true;
      if (/[?&]pokiDebug=true/.test(location.search)) window.PokiSDK.setDebug(true);
    } catch {
      // Ad blocker or offline: the game still works, just without ads.
      this.ok = !!window.PokiSDK;
    }
  }
  loadingProgress(): void {}
  loadingFinished(): void {
    if (this.ok) window.PokiSDK.gameLoadingFinished();
  }
  gameplayStart(): void {
    if (this.ok) window.PokiSDK.gameplayStart();
  }
  gameplayStop(): void {
    if (this.ok) window.PokiSDK.gameplayStop();
  }
  async commercialBreak(onStart: () => void): Promise<void> {
    if (!this.ok) return;
    try {
      await window.PokiSDK.commercialBreak(() => onStart());
    } catch {
      /* ignore */
    }
  }
  async rewardedBreak(onStart: () => void): Promise<boolean> {
    if (!this.ok) return false;
    try {
      return !!(await window.PokiSDK.rewardedBreak(() => onStart()));
    } catch {
      return false;
    }
  }
  happyTime(): void {}
}

/** CrazyGames SDK v3 — https://docs.crazygames.com */
export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  readonly hasRewarded = true;
  private sdk: any = null;
  storage?: KVStore;

  async init(): Promise<void> {
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      await window.CrazyGames.SDK.init();
      this.sdk = window.CrazyGames.SDK;
      if (this.sdk.data) {
        const data = this.sdk.data;
        this.storage = {
          getItem: (k: string) => {
            try {
              return data.getItem(k);
            } catch {
              return null;
            }
          },
          setItem: (k: string, v: string) => {
            try {
              data.setItem(k, v);
            } catch {
              /* ignore */
            }
          },
        };
      }
      this.sdk.game.loadingStart?.();
    } catch {
      this.sdk = null;
    }
  }
  loadingProgress(): void {}
  loadingFinished(): void {
    this.sdk?.game.loadingStop?.();
  }
  gameplayStart(): void {
    this.sdk?.game.gameplayStart?.();
  }
  gameplayStop(): void {
    this.sdk?.game.gameplayStop?.();
  }
  commercialBreak(onStart: () => void): Promise<void> {
    if (!this.sdk) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => onStart(),
          adFinished: () => resolve(),
          adError: () => resolve(),
        });
      } catch {
        resolve();
      }
    });
  }
  rewardedBreak(onStart: () => void): Promise<boolean> {
    if (!this.sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => onStart(),
          adFinished: () => resolve(true),
          adError: () => resolve(false),
        });
      } catch {
        resolve(false);
      }
    });
  }
  happyTime(): void {
    this.sdk?.game.happytime?.();
  }
}

/** GameDistribution HTML5 SDK — https://gamedistribution.com/sdk/html5 */
export class GameDistributionPlatform implements Platform {
  readonly name = 'gamedistribution';
  readonly hasRewarded = true;
  private ok = false;
  private resume: (() => void) | null = null;
  private rewardEarned = false;
  private onPause: (() => void) | null = null;

  constructor(private gameId: string) {}

  async init(): Promise<void> {
    window.GD_OPTIONS = {
      gameId: this.gameId,
      onEvent: (event: { name: string }) => {
        switch (event.name) {
          case 'SDK_GAME_PAUSE':
            this.onPause?.();
            break;
          case 'SDK_GAME_START':
            this.resume?.();
            this.resume = null;
            break;
          case 'SDK_REWARDED_WATCH_COMPLETE':
            this.rewardEarned = true;
            break;
        }
      },
    };
    try {
      await loadScript('https://html5.api.gamedistribution.com/main.min.js', { id: 'gamedistribution-jssdk' });
      this.ok = true;
    } catch {
      this.ok = false;
    }
  }
  loadingProgress(): void {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async commercialBreak(onStart: () => void): Promise<void> {
    if (!this.ok || !window.gdsdk) return;
    this.onPause = onStart;
    await new Promise<void>((resolve) => {
      this.resume = resolve;
      window.gdsdk.showAd().catch(() => resolve());
      window.setTimeout(resolve, 60000);
    });
  }
  async rewardedBreak(onStart: () => void): Promise<boolean> {
    if (!this.ok || !window.gdsdk) return false;
    this.rewardEarned = false;
    this.onPause = onStart;
    try {
      await window.gdsdk.showAd('rewarded');
    } catch {
      return false;
    }
    // SDK_REWARDED_WATCH_COMPLETE may arrive just after the promise resolves
    await new Promise((r) => window.setTimeout(r, 300));
    return this.rewardEarned;
  }
  happyTime(): void {}
}

/** Google AdSense H5 Games Ads (Ad Placement API) for self-hosted sites. */
export class AdSensePlatform implements Platform {
  readonly name = 'adsense';
  readonly hasRewarded = true;
  private ok = false;

  constructor(private client: string, private test: boolean) {}

  async init(): Promise<void> {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = (o: any) => window.adsbygoogle!.push(o);
    const attrs: Record<string, string> = { 'data-ad-client': this.client, crossorigin: 'anonymous' };
    if (this.test) attrs['data-adbreak-test'] = 'on';
    try {
      await loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(this.client)}`, attrs);
      window.adConfig!({ preloadAdBreaks: 'on', sound: 'on' });
      this.ok = true;
    } catch {
      this.ok = false;
    }
  }
  loadingProgress(): void {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  commercialBreak(onStart: () => void): Promise<void> {
    if (!this.ok) return Promise.resolve();
    return new Promise((resolve) => {
      window.adBreak!({ type: 'next', name: 'next-shift', beforeAd: onStart, adBreakDone: () => resolve() });
    });
  }
  rewardedBreak(onStart: () => void): Promise<boolean> {
    if (!this.ok) return Promise.resolve(false);
    return new Promise((resolve) => {
      let viewed = false;
      window.adBreak!({
        type: 'reward',
        name: 'reward',
        beforeAd: onStart,
        beforeReward: (showAdFn: () => void) => showAdFn(),
        adViewed: () => (viewed = true),
        adDismissed: () => (viewed = false),
        adBreakDone: () => resolve(viewed),
      });
    });
  }
  happyTime(): void {}
}
