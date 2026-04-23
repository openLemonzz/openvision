import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_INTRO_SEEN_KEY,
  HOME_INTRO_OVERLAY_EXIT_MS,
  HOME_INTRO_OVERLAY_HOLD_MS,
  HOME_HERO_SLOGAN_STEP_MS,
  getTypewriterText,
  getHomeIntroPhase,
  markHomeIntroSeen,
  shouldPlayHomeIntro,
} from './home-intro.ts';

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function createMemoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

test('home intro plays until the seen flag is stored', () => {
  const storage = createMemoryStorage();

  assert.equal(shouldPlayHomeIntro(storage), true);

  markHomeIntroSeen(storage);

  assert.equal(storage.getItem(HOME_INTRO_SEEN_KEY), '1');
  assert.equal(shouldPlayHomeIntro(storage), false);
});

test('home intro handoff holds, exits, and completes on schedule', () => {
  assert.equal(getHomeIntroPhase(0), 'holding');
  assert.equal(getHomeIntroPhase(HOME_INTRO_OVERLAY_HOLD_MS - 1), 'holding');
  assert.equal(getHomeIntroPhase(HOME_INTRO_OVERLAY_HOLD_MS), 'exiting');
  assert.equal(
    getHomeIntroPhase(HOME_INTRO_OVERLAY_HOLD_MS + HOME_INTRO_OVERLAY_EXIT_MS - 1),
    'exiting'
  );
  assert.equal(
    getHomeIntroPhase(HOME_INTRO_OVERLAY_HOLD_MS + HOME_INTRO_OVERLAY_EXIT_MS),
    'complete'
  );
});

test('home hero slogan types at 140ms per character', () => {
  assert.equal(HOME_HERO_SLOGAN_STEP_MS, 140);
});

test('typewriter helper respects delay and reveals characters progressively', () => {
  const slogan = '影境 · 从数据洪流中按下快门';

  assert.equal(getTypewriterText(slogan, 0, { startDelayMs: 240, stepMs: 80 }), '');
  assert.equal(getTypewriterText(slogan, 240, { startDelayMs: 240, stepMs: 80 }), '');
  assert.equal(getTypewriterText(slogan, 320, { startDelayMs: 240, stepMs: 80 }), '影');
  assert.equal(getTypewriterText(slogan, 640, { startDelayMs: 240, stepMs: 80 }), '影境 · ');
  assert.equal(getTypewriterText(slogan, 4000, { startDelayMs: 240, stepMs: 80 }), slogan);
});
