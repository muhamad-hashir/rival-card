# 🃏 RIVAL CARD ⚡

[![React Native](https://img.shields.io/badge/React%20Native-0.88-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-58-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-emerald.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Rival Card** is a fast-paced, high-stakes 2D cartoon mobile card game built with **React Native**, **Expo SDK 58**, and **Supabase Realtime**. Match colors and values, trigger disruptive action cards, unleash lightning multi-card combos, shout **RIVAL!** before your opponents catch you sleeping, and claim the championship podium!

---

## 🎮 Core Gameplay Mechanics

### 1. The 112-Card Engine
- **Number Cards (0–9)**: Four vibrant colors (**Ruby Red**, **Electric Blue**, **Emerald Green**, **Golden Yellow**).
- **Standard Action Cards**:
  - 🚫 **Skip**: Silences the next player's turn.
  - 🔁 **Reverse**: Inverts turn order (acts as a Skip in 1v1 duels).
  - ➕ **Draw 2**: Forces the victim to draw 2 cards and forfeits their turn (supports **+2 Stacking**).
- **Wild Cards**:
  - 🌈 **Wild**: Freely change the active table color.
  - 💥 **Wild Draw 4**: Force a 4-card draw, change table color, and skip the next player (supports **+4 Stacking**).
- **Special & Reactive Rival Cards**:
  - 🔇 **Mute**: Silences a targeted player for 1 round, preventing taunts and skipping their turn.
  - 🔄 **RivalSwap**: Swaps your hand using a smart 3-tier selector (fewest cards → highest hand strength → earliest in active turn order).
  - 🛡️ **Shield**: Play as a Wild color-changer on your turn, OR react within a **3-second Defense Window** to block any incoming `+2` / `+4` / stacked draw penalty completely while preserving active color!
  - 🪞 **Mirror**: Play as a Wild color-changer on your turn, OR react within **3 seconds** to reflect `+2`, `+4`, `Skip`, `Mute`, or `RivalSwap` back onto the attacker! Includes the **Counter-Mirror** rule (attacker holding Mirror gets one 3s bounce-cancel window; max 1 bounce).

### 2. Multi-Card Identical Combos & Draw Stacking
- Have two or more identical cards in your hand (same color AND same value)? Play them simultaneously in one swift combo move! Dump your hand faster and swing the game momentum in your favor.
- Chain `+2 → +4 → +6 → +8` or `+4 → +8` when Draw Card Stacking is active—or tap **Take Cards** / **Use Shield** / **Use Mirror** to survive the blast!

### 3. The 2.5s "CATCH RIVAL!" Penalty Window
- When holding **2 cards** on your turn, tap **RIVAL!** before playing down to **1 card** (re-armed every time your hand returns to 2 cards).
- Forgot to call it? All other opponents have an active **2.5-second vulnerability window** to tap **CATCH!** and slap a **+2 card penalty** onto the careless player.
- Reactive bots will catch careless players with heuristic reaction delays (1.2s to 2.2s).

---

## 🕹️ Game Modes

| Mode | Connectivity | Description |
| :--- | :--- | :--- |
| 🤖 **Play VS Bot** | **100% Offline** | Instant offline battle against smart heuristic AI bots (1v1 duel, 3-player, or 4-player brawl) with Shield/Mirror AI defense! |
| 👥 **Pass & Play** | **100% Offline** | Couch multiplayer on a single physical device with an automatic privacy veil between player turns. |
| ⚡ **Quick Match** | **Online** | Instant public matchmaking queue with 12s automatic fallback to RivalBot; human-vs-human matches record Career Statistics. |
| 🌐 **Custom Rooms (5-Match Series)** | **Online** | Host or join private 4-digit room lobbies featuring a 5-match cumulative series scorecard, live taunts, and per-round leave/rematch flow. |

---

## 🔊 Dynamic Audio & Sound Effects Engine

The game features a dual-channel arcade audio system powered by `expo-audio` (`audioService` & `soundService`):
- **Adaptive Background Music**: Seamlessly cross-fades between upbeat Menu BGM (`background.mp3`) and Match BGM (`match-background.mp3`).
- **Dedicated Action SFX (Deduplicated Per-Play)**:
  - 📣 `rival_shout.mp3` — Broadcasted "RIVAL!" shout heard by opponents as well as the caller.
  - 🎨 `color-change.mp3` — High-pitch tinting when choosing a Wild color.
  - 💥 `plus-four.mp3` & `plus-two.mp3` — Punchy impact on penalty draws.
  - 🚫 `skip.mp3` & 🔁 `reverse.mp3` — Snappy card action cues.
  - 🔄 `swap.mp3` — Swift whoosh during RivalSwap hand transfers.
  - 🔇 `mute.mp3` — Action modifier cue when silencing rivals.
  - 🛡️ **Shield Block & 🪞 Mirror Reflect**: Synthesized metallic cosmic shield chime and crystalline arcane deflection chime triggered cleanly once per defense event.

---

## 🛡️ Offline-First Architecture & Zero Data Leaks

- **100% Offline Support**: Booting without an internet connection automatically falls back to guest mode without freezing or infinite spinners. "Play VS Bot" and "Pass & Play" are completely local.
- **Fail-Fast Network Guards**: Online lobbies and match actions ping connectivity via `networkService.ensureOnline()` and gracefully inform the user if disconnected.
- **Zero API Credential Exposure**: No secret keys, service roles, or backend credentials are committed to source control. Only safe, anonymous public keys (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`) are utilized.
- **Global Error Boundary**: Any unexpected runtime failure is caught gracefully by `ErrorBoundary` featuring a warm cartoon aesthetic and an instant "Restart Game" recovery button.

---

## 🔐 Authentication & Cloud Data Migration Architecture

### 1. Native Google Sign-In & Supabase Token Exchange
- **Native Google Sign-In Sheet**: Uses `@react-native-google-signin/google-signin` configured with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Triggers Google Play Services bottom sheet directly on Android/iOS without external browser popups or redirects.
- **Supabase ID Token Exchange**: Extracts the Google ID token (supporting both modern v13+ `response.data.idToken` and legacy `response.idToken`) and exchanges it with Supabase via `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`.
- **Cancellation Gracefulness**: Intercepts `statusCodes.SIGN_IN_CANCELLED` and Android error code `12501` to return cleanly without throwing alerts or freezing the UI when a user dismisses the sheet.
- **Automatic Immersive Mode Reassertion**: Automatically restores Android sticky-immersive fullscreen mode (`NavigationBar.setVisibilityAsync("hidden")`, `overlay-swipe`) whenever the native Google sheet or modal is closed.

### 2. Guaranteed Guest Progress Preservation
- **Local-First Gameplay**: First-launch and offline players jump straight into the action in Guest mode with immediate access to matches and progression.
- **Zero Progress Overwrite**: `@rival_card_profile` is never wiped by default guest stats during cold-starts or account linking.
- **Seamless Cloud Account Linking**:
  - When connecting an account via Google Sign-In, local stats (XP, level, coins, gems, win streaks, and unlocked cosmetics) are read from persistent storage **before** network writes.
  - **New Cloud Account**: Local guest progression is upserted directly into Supabase `profiles` with `is_guest: false`. XP, coins, and levels are **never** wiped to 0.
  - **Returning Cloud Account**: Remote cloud profile is loaded into local state and `@rival_card_profile`, retaining existing cloud stats without being overwritten by fresh guest data.

---

## 🪙 Game Economy & Reward Balancing

To prevent automated grinding while rewarding competitive multiplayer skill, Rival Card balances economy rewards across match types:

| Match Type | Victory Reward | Defeat Reward | Economy Balancing Rules |
| :--- | :--- | :--- | :--- |
| ⚡ **Online Quick Match** | **+100 XP** / **+50 Coins** | **+25 XP** / **+10 Coins** | Full base payouts; levels up player profile and unlocks cosmetics. |
| 🤖 **Offline VS Bot** | **+20 XP** / **+10 Coins** | **+5 XP** / **+2 Coins** | Scaled-down rewards with an enforced **100-coin daily soft cap** (`@rivalcard:daily_bot_earnings`) to prevent infinite offline farming. |
| 👥 **Pass & Play** | **0 XP** / **0 Coins** | **0 XP** / **0 Coins** | Casual local multiplayer; excluded from currency farming. |

---

## 📱 Immersive Mobile Experience & UX Polish

- **Sticky-Immersive Fullscreen Mode**: Android system bars and navigation bars are hidden via the `expo-navigation-bar` config plugin and runtime visibility listeners (including Huawei EMUI/Android 9–10 focus, orientation, and translucent modal safeguards), keeping fullscreen mode intact across screen switches and external intents.
- **Profanity-Filtered Username Editor**:
  - Independent typing buffer allows clearing and editing names freely.
  - Enforces minimum 3 characters and maximum 16 characters.
  - Normalizes leetspeak and filters inappropriate names with visual feedback before persisting.
- **Comic Arcade Aesthetic**: Dynamic Fredoka typography, tactile haptic bumps on card snaps, 3D glint cards, and celebration confetti.

---

## 📁 Repository Structure

```text
rival-card/
├── assets/                    # Cartoon vector & raster assets
│   ├── sounds/                # Background music & match audio
│   │   └── game-sounds/       # Dedicated action sound effects
│   ├── icons/                 # Custom action card icon assets
│   ├── homescreen.png         # Main menu background artwork
│   └── card_back.png          # Rendered card back design
├── src/
│   ├── components/            # Reusable UI components & modals
│   │   ├── CardView.tsx       # 2D card presentation with custom Shield/Mirror & 3D gloss highlights
│   │   ├── DefenseReactionModal.tsx # 3-second reactive Shield/Mirror defense overlay
│   │   ├── DraggableCard.tsx  # Smooth flick & play gesture handler
│   │   ├── ErrorBoundary.tsx  # Global crash interceptor & recovery UI
│   │   ├── ErrorToast.tsx     # Cartoon toast alert banners
│   │   ├── GameOverModal.tsx  # Winner celebration modal with confetti
│   │   ├── PrivateSeriesModal.tsx # 5-Match Series scorecard & between-round hub
│   │   ├── SettingsModal.tsx  # Sound, music, haptics, and account controls
│   │   └── ...
│   ├── screens/
│   │   ├── HomeScreen.tsx     # Main hub, profile banner, modes & cosmetics
│   │   ├── GameScreen.tsx     # Main table arena, turn timer, floating HUD & opponent docks
│   │   └── LoadingScreen.tsx  # Comic sunburst animated launch screen
│   ├── services/
│   │   ├── audioService.ts    # Dual-channel BGM and action/synthesized SFX engine
│   │   ├── networkService.ts  # Cross-platform ping connectivity checker
│   │   ├── supabase.ts        # Supabase Realtime & Auth client
│   │   ├── settingsService.ts # Local preferences persistence (AsyncStorage)
│   │   └── ...
│   ├── gameEngine.ts          # Pure functional game rules, defense engine & AI heuristics
│   ├── types.ts               # Universal TypeScript types & interfaces
│   └── __tests__/             # Comprehensive unit test suite (220+ tests)
├── eas.json                   # EAS Build profiles (Universal Multi-ABI APK)
├── app.json                   # Expo application manifest
└── package.json               # Dependencies and build scripts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Expo Go](https://expo.dev/go) on iOS or Android

### Installation
```bash
# Clone repository
git clone https://github.com/your-repo/rival-card.git
cd rival-card

# Install SDK-compatible dependencies
npm install
```

### Running Locally
```bash
# Start Expo development server
npx expo start

# Run on Android emulator / device
npx expo start --android

# Run on iOS simulator
npx expo start --ios

# Run on Web
npx expo start --web
```

---

## 🧪 Testing & Verification

Rival Card maintains extensive test coverage across game rules, network disconnection resilience, and bot decision trees:

```bash
# Run all unit tests
npm test

# Run TypeScript type-checker
npm run typecheck

# Run Expo export bundle verification
npx expo export --no-bytecode
```

---

## 📦 Building Standalone APK (EAS Build)

To generate a standalone, universal Android APK that installs cleanly on 32-bit (armeabi-v7a), 64-bit (arm64-v8a), and Android Go devices:

```bash
# Authenticate with Expo Application Services
npx eas login

# Run cloud APK build
npx eas build -p android --profile preview
```

---

## 🛠️ Tech Stack

- **Mobile Framework**: React Native 0.88, Expo SDK 58, React 19
- **Languages & Typing**: TypeScript 6.0
- **Animations & Physics**: React Native Reanimated 4, React Native Gesture Handler 3
- **Multiplayer & Storage**: Supabase Realtime WebSocket Channels & PostgreSQL Auth
- **Audio & Media**: Expo Audio (`expo-audio`), Web Audio API
- **Testing**: Node.js Test Runner (`node:test`) & `tsx`

---

## 📜 License
MIT License. Crafted with ❤️ for Rival Card.
