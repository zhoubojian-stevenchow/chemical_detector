import { audio } from '../core/audio';
import { save, type SaveData } from '../core/save';
import { hashString, makeRng, pick, shuffle, todayKey, wait } from '../core/util';
import { GAME } from '../config';
import { CHAPTERS, LEVELS, getLevel } from '../data/levels';
import { COSMETICS } from '../data/shop';
import { rankFromXp } from '../data/skills';
import { GERALD } from '../data/text';
import type { LevelDef } from '../data/types';
import { ads } from '../platform';
import type { LabScene } from '../scene/lab';
import { toast } from '../ui/dom';
import {
  chapterUnlockedModal, clearLayer, levelIntro, mapScreen, rankUpModal, resultsModal, titleScreen, type Host,
} from '../ui/menus';
import { achievementBanners, achievementsScreen, dailyModal, dailyStatus, dexScreen, settingsModal, shopScreen, skillsScreen } from '../ui/meta';
import { ACHIEVEMENTS } from '../data/achievements';
import { ShiftController } from './controller';
import { Progress } from './progress';
import { Shift, TEMPLATE_FIRST_LEVEL, type Mode } from './shift';

type Back = 'title' | 'map';

export class App implements Host {
  readonly layer: HTMLElement;
  readonly lab: LabScene;
  readonly progress: Progress;
  private returnTo: Back = 'title';
  private chapter = 1;
  private pendingChapter: number | null = null;
  private dailyPrompted = false;
  private inShift = false;
  /** the running shift, so navigating away can end it cleanly */
  private ctrl: ShiftController | null = null;
  /** promotion not shown yet (shown on the results card, else on the next map visit) */
  private pendingRank: number | null = null;

  constructor(layer: HTMLElement, lab: LabScene) {
    this.layer = layer;
    this.lab = lab;
    this.progress = new Progress(() => save.data);
    ads.onAdState = (playing) => {
      this.lab.paused = playing;
    };
  }

  get data(): SaveData {
    return save.data;
  }

  get rewardedAvailable(): boolean {
    return ads.hasRewarded;
  }

  persist(): void {
    save.save();
  }

  rewarded(): Promise<boolean> {
    return ads.rewarded().then((ok) => {
      if (!ok) toast(this.layer, 'No reward this time — the ad was not completed.');
      return ok;
    });
  }

  private applied = { quality: '', theme: '', hat: '', shake: -1 };

  /** Apply settings; only touches the parts that actually changed (sliders fire this a lot). */
  applySettings(): void {
    const s = this.data.settings;
    audio.setVolumes(s.music, s.sfx);
    if (this.applied.quality !== s.quality) {
      this.applied.quality = s.quality;
      this.lab.setQuality(s.quality);
    }
    if (this.applied.shake !== Number(s.shake)) {
      this.applied.shake = Number(s.shake);
      document.body.classList.toggle('no-shake', !s.shake);
    }
    if (this.applied.theme !== this.data.theme) {
      this.applied.theme = this.data.theme;
      const theme = COSMETICS.find((c) => c.id === this.data.theme) ?? COSMETICS.find((c) => c.id === 'theme_classic')!;
      this.lab.setTheme(theme.colors!);
    }
    if (this.applied.hat !== this.data.hat) {
      this.applied.hat = this.data.hat;
      this.lab.setHat(this.data.hat);
    }
  }

  /** Layout-aware insets so the 3D view centres in the free space (measured from the real HUD panels). */
  updateInsets(): void {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const portrait = hgt > w * 1.05;
    document.body.classList.toggle('portrait', portrait);
    if (!this.inShift) {
      this.lab.setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }
    const short = !portrait && hgt <= 520;
    const top = short ? 50 : 58;
    const cands = this.layer.querySelector('.cands') as HTMLElement | null;
    const tray = this.layer.querySelector('.tray') as HTMLElement | null;
    const visible = (el: HTMLElement | null) => !!el && el.style.display !== 'none' && el.offsetHeight > 0;
    // panels hidden (client dialog): reserve the same space so the camera doesn't jump around
    const trayH = visible(tray) ? hgt - tray!.getBoundingClientRect().top : portrait ? 160 : short ? 104 : 124;
    if (portrait) {
      const bottom = visible(cands) ? hgt - cands!.getBoundingClientRect().top : trayH + hgt * 0.37 + 16;
      this.lab.setInsets({ top, right: 0, bottom: Math.round(bottom + 6), left: 0 });
    } else {
      const right = visible(cands) ? w - cands!.getBoundingClientRect().left : Math.max(250, Math.min(350, w * 0.28)) + 10;
      this.lab.setInsets({ top, right: Math.round(right + 10), bottom: Math.round(trayH + 6), left: 0 });
    }
  }

  // ───────────────────────── navigation ─────────────────────────

  /** End a running shift because the app is navigating somewhere else. */
  private abortShift(): void {
    const c = this.ctrl;
    if (!c) return;
    this.ctrl = null;
    c.abort();
    this.inShift = false;
    this.updateInsets();
  }

  /** No shift running and no other modal on screen → safe to pop a delayed modal. */
  private calmMoment(): boolean {
    return !this.inShift && !this.layer.querySelector('.modal');
  }

  private showPendingRank(): void {
    const r = this.pendingRank;
    if (r === null || this.inShift) return;
    this.pendingRank = null;
    void rankUpModal(this, r, () => this.showSkills());
  }

  showTitle(): void {
    this.abortShift();
    this.returnTo = 'title';
    this.inShift = false;
    this.updateInsets();
    audio.playMusic('menu');
    this.lab.setNight(false);
    void this.lab.focus('menu', 1.0);
    this.lab.setTools(this.progress.toolsFor(Math.max(1, this.progress.highestCleared())));
    titleScreen(this);
    setTimeout(() => {
      const p = this.lab.geraldScreen();
      if (!this.inShift && p.visible && this.layer.querySelector('.title-screen')) {
        const b = document.createElement('div');
        b.className = 'bubble';
        b.textContent = pick(GERALD.shiftStart);
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y - 10}px`;
        this.layer.appendChild(b);
        setTimeout(() => b.remove(), 3500);
      }
    }, 1400);
  }

  /** @param quiet don't pop the daily-bonus prompt (another modal is about to open) */
  showMap(chapter?: number, quiet = false): void {
    this.abortShift();
    this.returnTo = 'map';
    this.inShift = false;
    this.updateInsets();
    audio.playMusic('menu');
    this.lab.setNight(false);
    void this.lab.focus('map', 0.9);
    if (chapter) this.chapter = chapter;
    else {
      const next = this.progress.nextLevel();
      const ch = Math.ceil(next / 10);
      this.chapter = this.progress.chapterUnlocked(ch) ? ch : Math.max(1, ch - 1);
    }
    mapScreen(this, this.chapter);
    this.checkAchievements();
    if (this.pendingChapter) {
      const ch = this.pendingChapter;
      this.pendingChapter = null;
      void chapterUnlockedModal(this, ch).then(() => mapScreen(this, ch));
      this.chapter = ch;
    } else if (!quiet && this.pendingRank !== null) {
      setTimeout(() => this.calmMoment() && this.showPendingRank(), 500);
    } else if (!quiet && !this.dailyPrompted && this.dailyAvailable() && this.progress.highestCleared() >= 1) {
      setTimeout(() => {
        if (!this.calmMoment()) return; // e.g. a level intro opened meanwhile: ask on a later visit
        this.dailyPrompted = true;
        this.openDaily();
      }, 500);
    }
  }

  private back(): void {
    if (this.returnTo === 'map') this.showMap(this.chapter);
    else this.showTitle();
  }

  showShop(tab?: string): void {
    this.abortShift();
    shopScreen(this, tab, () => {
      this.applySettings();
      this.checkAchievements();
      this.back();
    });
  }

  showSkills(): void {
    this.abortShift();
    skillsScreen(this, () => this.back());
  }

  showDex(): void {
    this.abortShift();
    dexScreen(this, () => this.back());
  }

  showAchievements(): void {
    this.abortShift();
    this.checkAchievements();
    achievementsScreen(this, () => this.back());
  }

  /** Unlock & reward any achievements whose goal is now met. */
  checkAchievements(): void {
    const d = this.data;
    const stars = this.progress.totalStars();
    const rank = this.progress.rank();
    const fresh = ACHIEVEMENTS.filter((a) => {
      if (d.achievements[a.id]) return false;
      const [cur, goal] = a.progress(d, stars, rank);
      return cur >= goal;
    });
    for (const a of fresh) {
      d.achievements[a.id] = true;
      d.coins += a.reward.coins ?? 0;
      d.bonusSkillPoints += a.reward.skill ?? 0;
    }
    if (!fresh.length) return;
    achievementBanners(this, fresh);
    this.persist();
  }

  showSettings(onClose?: () => void): void {
    settingsModal(this, () => this.applySettings(), () => this.resetProgress());
    void onClose;
  }

  openDaily(): void {
    dailyModal(this, () => {
      if (this.layer.querySelector('.meta-screen')) mapScreen(this, this.chapter);
      this.checkAchievements();
    });
  }

  dailyAvailable(): boolean {
    return dailyStatus(this).available;
  }

  async playPressed(): Promise<void> {
    await ads.playBreak();
    this.showMap();
  }

  dailyCaseAvailable(): boolean {
    return this.data.dailyCase.last !== todayKey();
  }

  openLevel(id: number): void {
    levelIntro(this, id);
  }

  resetProgress(): void {
    this.abortShift(); // reset can be reached from the pause menu's settings
    save.reset();
    this.applySettings();
    toast(this.layer, 'Progress erased. Fresh lab coat!');
    this.showTitle();
  }

  grantPartial(coins: number, xp: number): void {
    this.data.coins += coins;
    this.data.xp += Math.round(xp * 0.5);
    this.persist();
  }

  // ───────────────────────── shifts ─────────────────────────

  startLevel(id: number): void {
    void this.playShift('campaign', id);
  }

  startEndless(): void {
    if (this.progress.highestCleared() < 10) {
      toast(this.layer, 'Clear level 10 to unlock Rush Hour!');
      return;
    }
    void this.playShift('endless', 0);
  }

  startDailyCase(): void {
    void this.playShift('daily', 0);
  }

  private makeShift(mode: Mode, levelId: number): Shift {
    const p = this.progress;
    if (mode === 'campaign') {
      const level = getLevel(levelId);
      return new Shift({ mode, level, difficulty: (levelId - 1) / 59, tools: p.toolsFor(level.id, level.mods) }, p);
    }
    const reach = p.toolLevel();
    const synthetic: LevelDef = { id: reach, chapter: Math.ceil(reach / 10), title: mode === 'endless' ? 'Rush Hour' : 'Daily Case', blurb: '', cases: [], size: 5, mods: [] };
    if (mode === 'daily') {
      const rnd = makeRng(hashString('daily-' + todayKey()));
      const ids = Object.keys(TEMPLATE_FIRST_LEVEL).filter((id) => TEMPLATE_FIRST_LEVEL[id] <= reach);
      synthetic.cases = shuffle(ids, rnd).slice(0, 3);
      synthetic.size = Math.min(8, 4 + Math.floor(reach / 15));
      synthetic.timeMul = 1.1;
      return new Shift({ mode, level: synthetic, difficulty: reach / 60, tools: p.toolsFor(reach) }, p, rnd);
    }
    return new Shift({ mode, level: synthetic, difficulty: reach / 60, tools: p.toolsFor(reach) }, p);
  }

  private async playShift(mode: Mode, levelId: number): Promise<void> {
    const origin = this.returnTo; // where Rush Hour / Daily Case were started from
    while (true) {
      this.abortShift(); // never two shifts at once
      clearLayer(this);
      this.inShift = true;
      this.updateInsets();
      const shift = this.makeShift(mode, levelId);
      const ctrl = new ShiftController(this, shift);
      this.ctrl = ctrl;
      const exit = await ctrl.run();
      if (this.ctrl === ctrl) this.ctrl = null;
      if (exit.kind === 'abort') return; // whoever ended it has already moved on
      this.inShift = false;
      this.updateInsets();
      this.lab.removeClient();
      this.lab.removeSample();
      this.lab.setNight(false);
      if (exit.kind === 'restart') {
        await this.maybeInterstitial(levelId);
        continue;
      }
      if (exit.kind === 'quit' || exit.kind === 'failed') {
        if (exit.kind === 'failed') this.recordDex(exit.newDex);
        await this.maybeInterstitial(levelId);
        if (mode === 'campaign') this.showMap(Math.ceil(levelId / 10));
        else if (exit.kind === 'failed' || origin === 'map') this.showMap(); // the fail screen's button says "Map"
        else this.showTitle();
        return;
      }
      // finished
      const r = exit.result;
      const d = this.data;
      const xpBefore = d.xp;
      const rankBefore = rankFromXp(d.xp);
      let hasNext = false;
      let firstClear = false;
      let dailyBonus = 0;
      let endlessInfo: { score: number; best: number; isBest: boolean } | undefined;
      const chaptersBefore = CHAPTERS.map((c) => this.progress.chapterUnlocked(c.id));
      if (mode === 'campaign') {
        const rec = d.levels[levelId] ?? { stars: [false, false, false], best: 0 };
        firstClear = !rec.stars[0] && r.cleared;
        rec.stars = [rec.stars[0] || r.stars[0], rec.stars[1] || r.stars[1], rec.stars[2] || r.stars[2]];
        rec.best = Math.max(rec.best, r.totalCoins);
        d.levels[levelId] = rec;
        if (firstClear && levelId % 10 === 0) d.bonusSkillPoints += 1;
        hasNext = levelId < LEVELS.length && this.progress.levelUnlocked(levelId + 1);
        if (r.stars.every(Boolean)) ads.platform.happyTime();
      } else if (mode === 'endless') {
        const isBest = r.correct > d.endlessBest;
        d.endlessBest = Math.max(d.endlessBest, r.correct);
        endlessInfo = { score: r.correct, best: d.endlessBest, isBest };
        if (isBest) ads.platform.happyTime();
      } else if (mode === 'daily' && r.cleared && d.dailyCase.last !== todayKey()) {
        dailyBonus = 200 + 40 * Math.ceil(this.progress.toolLevel() / 10);
        d.dailyCase.last = todayKey();
      }
      d.coins += r.totalCoins + dailyBonus;
      d.xp += r.xp;
      d.stats.shifts++;
      if (shift.accidents === 0 && r.cleared) d.accStreak += 1;
      this.recordDex(exit.newDex);
      const newChapter = CHAPTERS.find((c, i) => !chaptersBefore[i] && this.progress.chapterUnlocked(c.id));
      if (newChapter) this.pendingChapter = newChapter.id;
      this.persist();
      this.checkAchievements();
      if (r.cleared) {
        this.lab.celebrate();
        audio.play('fanfare');
      }
      void this.lab.focus('map', 1.0);
      audio.playMusic('menu');
      const total = r.totalCoins + dailyBonus;
      let rankTimer = 0;
      const action = await new Promise<'next' | 'retry' | 'map'>((resolve) => {
        resultsModal(
          this,
          {
            title: mode === 'endless' ? 'RUSH OVER!' : r.stars.every(Boolean) ? 'PERFECT SHIFT!' : 'SHIFT COMPLETE!',
            result: r,
            xpBefore,
            xpAfter: d.xp,
            newDex: exit.newDex,
            hasNext,
            endless: endlessInfo,
            daily: dailyBonus ? { bonus: dailyBonus } : undefined,
            firstClear,
          },
          {
            double: async () => {
              const ok = await this.rewarded();
              if (ok) {
                d.coins += total;
                this.persist();
              }
              return ok;
            },
            next: () => resolve('next'),
            retry: () => resolve('retry'),
            map: () => resolve('map'),
          },
        );
        const rankAfter = rankFromXp(d.xp);
        if (rankAfter > rankBefore) {
          this.pendingRank = rankAfter;
          rankTimer = window.setTimeout(() => this.showPendingRank(), 2600); // after the count-up
        }
      });
      window.clearTimeout(rankTimer); // left the results early: promotion waits for the map
      await this.maybeInterstitial(levelId);
      if (action === 'retry') continue;
      if (action === 'next' && mode === 'campaign' && hasNext) {
        levelId += 1;
        const ch = Math.ceil(levelId / 10);
        if (ch !== Math.ceil((levelId - 1) / 10) && this.pendingChapter) {
          this.showMap(ch);
          return;
        }
        this.showMap(ch, true);
        levelIntro(this, levelId);
        return;
      }
      // the results screen's button says "Map" in every mode
      this.showMap(mode === 'campaign' ? Math.ceil(levelId / 10) : undefined);
      return;
    }
  }

  private recordDex(n: number): void {
    void n;
    this.persist();
  }

  private async maybeInterstitial(levelId: number): Promise<void> {
    if (levelId > 0 && levelId < GAME.firstAdLevel && this.progress.highestCleared() < GAME.firstAdLevel) return;
    await ads.interstitial();
    await wait(50);
  }
}
