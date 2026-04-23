# Homepage Intro Transition Design

**Context**

The homepage currently switches directly from `InitializationScreen` to `Home` with no visual handoff. The hero already contains the `VISION` wordmark and the slogan `影境 · 从数据洪流中按下快门`, but it does not animate and the typography is too soft for the requested sci-fi look.

**Goals**

- Play a stronger `VISION` intro only on the user's first successful site entry.
- Make the transition from load screen to homepage feel continuous instead of abrupt.
- Increase slogan size and contrast.
- Add a typewriter-style reveal for `影境 · 从数据洪流中按下快门`.

**Chosen Approach**

Use the existing load screen as a persistent full-screen overlay. While initialization is pending, it shows a pixel/glitch `VISION` mark, scanlines, and the current status. Once initialization is ready on a first visit, the overlay stays briefly, then fades and blurs out over the mounted homepage so the hero appears to inherit the same `VISION` motion language.

The homepage hero keeps the existing composition but sharpens the typography, delays the slogan reveal slightly, and renders the slogan through a typewriter helper so the first view feels intentional. A local browser flag prevents replay after the first successful intro.

**Files Expected**

- `web/src/components/InitializationScreen.tsx`
- `web/src/pages/Home.tsx`
- `web/src/App.tsx`
- `web/src/index.css`
- `web/src/lib/home-intro.ts`
- `web/src/lib/home-intro.test.ts`
