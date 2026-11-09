# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
Casual and competitive mobile card players looking for quick, intense 3–5 minute sessions. Players engage solo against responsive heuristic bots, together locally on a single phone via Pass & Play, or online against friends and matchmaking opponents.

## Product Purpose
Deliver an adrenaline-charged, snappy 2D cartoon card gaming experience that transforms classic color/number matching into tactical high-stakes duels with instant feedback, zero latency, and tactile, physical-feeling card play.

## Positioning
Combines classic matching mechanics with aggressive momentum-swinging twists: reactive +2/+4 draw card stacking, multi-card identical combo drops, a 2.5-second vulnerability catch window on RIVAL declarations, and hand-swapping RivalSwap cards—backed by complete offline-first resilience.

## Operating Context
Quick portrait-mode mobile gameplay on Android handhelds. Built for on-the-go sessions (commutes, waiting rooms), social single-device gatherings (Pass & Play couch multiplayer with automatic privacy veils), and quick online matchmaking breaks. Driven by touch gestures (flicking, tapping, haptics), cartoon sound effects, and screen-safe boundaries.

## Capabilities and Constraints
- Modes: Play VS Bots (1v1, 3P, 4P offline with heuristic AI), Pass & Play (single-device couch multiplayer with turn privacy veil), Quick Match (online queue with 12s bot fallback), and Custom Rooms (private 4-digit code lobbies).
- Game Rules: 108-card deck, standard action cards (Skip, Reverse, Draw 2), Wild & Wild Draw 4, special cards (Mute, RivalSwap), +2/+4 stack escalation with voluntary draw, multi-card identical combos, and 2.5s RIVAL declaration catch window.
- Progression & Economy: Local and online profile, XP leveling, match coin rewards (100% online/human, 10% offline bots, 0% custom rooms), high-stakes cosmetic emote shop.
- Technical Constraints: React Native 0.88, Expo SDK 58, offline-first architecture, no unhandled network rejections, zero hard crashes (ErrorBoundary with cartoon recovery UI), and universal Android APK target.

## Brand Commitments
- Name: Rival Card
- Identity & Voice: Energetic, playful cartoon arcade aesthetic. Bold typography (Fredoka), vibrant primary palette (Ruby Red, Electric Blue, Emerald Green, Golden Yellow, Deep Slate), chunky outlines, and expressive audio cues.
- Sound & Feedback: Dual-channel cross-fading BGM (Menu vs Match), custom action sound effects, and tactile haptic bumps.

## Evidence on Hand
- Complete working React Native codebase with 162 unit tests in `src/__tests__/`.
- Built-in audio assets in `assets/sounds/` and `assets/sounds/game-sounds/`.
- Brand vector and raster card graphics in `assets/` and `src/components/CardView.tsx`.
- App configuration in `app.json` (`com.rivalcard.game`).

## Product Principles
1. Instant Action: Matches must launch within seconds with zero loading friction or forced tutorials; bots jump in immediately when offline or queue times out.
2. Tactile Adrenaline: Every card play, stack escalation, and Rival shout must feel physical, loud, and impactful through motion, chunky outlines, audio, and haptics.
3. Fair & Transparent Stacking: High-stakes mechanics (+2/+4 accumulation, combo drops, catches) must be communicated with undeniable visual clarity and voluntary action choices.
4. Rock-Solid Offline Resilience: The game must never freeze, hang, or crash when offline; network loss degrades gracefully to local play with zero data corruption.

## Accessibility & Inclusion
- High-contrast card color identification using clear geometric symbols (Diamond for Red, Octagon for Blue, Pentagon for Green, Triangle for Yellow).
- Touch target minimums (44px+) and safe area offsets avoiding screen edge clipping.
