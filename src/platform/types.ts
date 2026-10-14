import type { KVStore } from '../core/save';

/**
 * Every web-portal SDK is wrapped behind this interface, so the game code never
 * talks to a specific ad network directly. Add a new portal by writing one adapter.
 */
export interface Platform {
  readonly name: string;
  /** true if rewarded ads can be offered (shows the "watch ad" buttons) */
  readonly hasRewarded: boolean;
  /** request an interstitial when the player presses PLAY on the title screen (GameDistribution guideline) */
  readonly adOnPlay?: boolean;
  init(): Promise<void>;
  loadingProgress(p: number): void;
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Interstitial at a natural break. Resolves when the game may continue. */
  commercialBreak(onStart: () => void): Promise<void>;
  /** Rewarded ad. Resolves true if the player earned the reward. */
  rewardedBreak(onStart: () => void): Promise<boolean>;
  /** Celebrate moments (CrazyGames "happytime"). */
  happyTime(): void;
  /** Optional cloud-save storage. */
  storage?: KVStore;
}

export function loadScript(src: string, attrs: Record<string, string> = {}, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    for (const k in attrs) s.setAttribute(k, attrs[k]);
    const timer = window.setTimeout(() => reject(new Error('timeout ' + src)), timeoutMs);
    s.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('failed ' + src));
    };
    document.head.appendChild(s);
  });
}
