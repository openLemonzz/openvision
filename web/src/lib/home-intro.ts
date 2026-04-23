export const HOME_INTRO_SEEN_KEY = 'vision-home-intro-seen';
export const HOME_INTRO_OVERLAY_HOLD_MS = 420;
export const HOME_INTRO_OVERLAY_EXIT_MS = 900;
export const HOME_HERO_SLOGAN = '影境 · 从数据洪流中按下快门';
export const HOME_HERO_SLOGAN_DELAY_MS = 260;
export const HOME_HERO_SLOGAN_STEP_MS = 140;

type IntroStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type HomeIntroPhase = 'holding' | 'exiting' | 'complete';

export function shouldPlayHomeIntro(storage: IntroStorage | null | undefined) {
  if (!storage) {
    return true;
  }

  try {
    return storage.getItem(HOME_INTRO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markHomeIntroSeen(storage: IntroStorage | null | undefined) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(HOME_INTRO_SEEN_KEY, '1');
  } catch {
    // Ignore storage failures and keep the intro functional.
  }
}

export function getHomeIntroPhase(
  elapsedMs: number,
  options: {
    holdMs?: number;
    exitMs?: number;
  } = {}
): HomeIntroPhase {
  const { holdMs = HOME_INTRO_OVERLAY_HOLD_MS, exitMs = HOME_INTRO_OVERLAY_EXIT_MS } = options;

  if (elapsedMs < holdMs) {
    return 'holding';
  }

  if (elapsedMs < holdMs + exitMs) {
    return 'exiting';
  }

  return 'complete';
}

export function getTypewriterText(
  text: string,
  elapsedMs: number,
  options: {
    startDelayMs?: number;
    stepMs?: number;
  } = {}
) {
  const { startDelayMs = 0, stepMs = 72 } = options;
  const characters = Array.from(text);
  const visibleCount = Math.max(
    0,
    Math.min(
      characters.length,
      Math.floor((elapsedMs - startDelayMs) / Math.max(stepMs, 1))
    )
  );

  return characters.slice(0, visibleCount).join('');
}
