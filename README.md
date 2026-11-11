# 🃏 RIVAL CARD ⚡

[![React Native](https://img.shields.io/badge/React%20Native-0.88-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-58-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-emerald.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Rival Card** is a fast-paced, high-stakes 2D cartoon mobile card game built with **React Native**, **Expo SDK 58**, and **Supabase Realtime**. Match colors and values, trigger disruptive action cards, unleash lightning multi-card combos, shout **RIVAL!** before your opponents catch you sleeping, and claim the championship podium!

---

## 🎮 Core Gameplay Mechanics

### 1. The 108-Card Engine
- **Number Cards (0–9)**: Four vibrant colors (**Ruby Red**, **Electric Blue**, **Emerald Green**, **Golden Yellow**).
- **Standard Action Cards**:
  - 🚫 **Skip**: Silences the next player's turn.
  - 🔁 **Reverse**: Inverts turn order (acts as a Skip in 1v1 duels).
  - ➕ **Draw 2**: Forces the victim to draw 2 cards and forfeits their turn.
- **Wild Cards**:
  - 🌈 **Wild**: Freely change the active table color.
  - 💥 **Wild Draw 4**: Force a 4-card draw, change table color, and skip the next player.
- **Special Rival Cards**:
  - 🔇 **Mute**: Silences a targeted player for 1 round, preventing taunts and skipping their turn.
  - 🔄 **RivalSwap**: Swaps your current hand with whichever opponent currently holds the fewest cards.

### 2. Multi-Card Identical Combos
Have two or more identical cards in your hand (same color AND same value)? Play them simultaneously in one swift combo move! Dump your hand faster and swing the game momentum in your favor.

### 3. The 2.5s "CATCH RIVAL!" Penalty Window
- When a player plays down to their **last remaining card**, they must declare **RIVAL!**.
- Forgot to call it? All other opponents have an active **2.5-second vulnerability window** to tap **CATCH!** and slap a **+2 card penalty** onto the careless player.
- Reactive bots will catch careless players with heuristic reaction delays (1.2s to 2.2s).

---

## 🕹️ Game Modes

| Mode | Connectivity | Description |
| :--- | :--- | :--- |
| 🤖 **Play VS Bot** | **100% Offline** | Instant offline battle against smart heuristic AI bots (1v1 duel or 4-player brawl). Adjustable bot speeds! |
| 👥 **Pass & Play** | **100% Offline** | Couch multiplayer on a single physical device with an automatic privacy veil between player turns. |
| ⚡ **Quick Match** | **Online** | Instant matchmaking queue with 12s automatic fallback to RivalBot if no humans are in queue. |
| 🌐 **Custom Rooms** | **Online** | Host or join private multiplayer lobbies with 4-digit room codes powered by Supabase WebSockets. |

---

## 🔊 Dynamic Audio & Sound Effects Engine

The game features an arcade sound system managed by `audioService`:
- **Adaptive Background Music**: Seamlessly cross-fades between the upbeat Menu BGM (`background.mp3`) and suspenseful Match BGM (`match-background.mp3`).
- **Dedicated Action SFX**:
  - 📣 `rival_shout.mp3` — Heart-pumping shout upon declaring RIVAL!
  - 🎨 `color-change.mp3` — High-pitch tinting when choosing a Wild color.
  - 💥 `plus-four.mp3` & `plus-two.mp3` — Punchy impact on penalty draws.
  - 🚫 `skip.mp3` & 🔁 `reverse.mp3` — Snappy card action cues.
  - 🔄 `swap.mp3` — Swift whoosh during RivalSwap hand transfers.
  - 🔇 `mute.mp3` — Action modifier cue when silencing rivals.

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

- **Sticky-Immersive Fullscreen Mode**: Android system bars and navigation bars are hidden on boot (`overlay-swipe` behavior) with settle-delay retries (300ms, 1000ms) on AppState transitions, ensuring system bars stay hidden even when returning from external intents or email links.
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
│   │   ├── CardView.tsx       # 2D card presentation with 3D gloss highlights
│   │   ├── DraggableCard.tsx  # Smooth flick & play gesture handler
│   │   ├── ErrorBoundary.tsx  # Global crash interceptor & recovery UI
│   │   ├── ErrorToast.tsx     # Cartoon toast alert banners
│   │   ├── GameOverModal.tsx  # Winner celebration modal with confetti
│   │   ├── SettingsModal.tsx  # Sound, music, haptics, and account controls
│   │   └── ...
│   ├── screens/
│   │   ├── HomeScreen.tsx     # Main hub, profile banner, modes & cosmetics
│   │   ├── GameScreen.tsx     # Main table arena, turn timer, opponent docks
│   │   └── LoadingScreen.tsx  # Comic sunburst animated launch screen
│   ├── services/
│   │   ├── audioService.ts    # Dual-channel BGM and action SFX engine
│   │   ├── networkService.ts  # Cross-platform ping connectivity checker
│   │   ├── supabase.ts        # Supabase Realtime & Auth client
│   │   ├── settingsService.ts # Local preferences persistence (AsyncStorage)
│   │   └── ...
│   ├── gameEngine.ts          # Pure functional game rules & AI heuristics
│   ├── types.ts               # Universal TypeScript types & interfaces
│   └── __tests__/             # Comprehensive unit test suite (150+ tests)
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
- **Audio & Media**: Expo AV, Web Audio API
- **Testing**: Node.js Test Runner (`node:test`) & `tsx`

---

## 📜 License
MIT License. Crafted with ❤️ for Rival Card.
