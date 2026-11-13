import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { HomeScreen, SetupPreset } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { supabase } from './src/services/supabase';
import { authService } from './src/services/authService';
import { settingsService } from './src/services/settingsService';
import { Asset } from 'expo-asset';
import { audioService } from './src/services/audioService';
import { soundService } from './src/services/soundService';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let ExpoAudio: typeof import('expo-audio') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAudio = require('expo-audio');
  if (expoAudio) {
    ExpoAudio = expoAudio;
  }
} catch {
  ExpoAudio = null;
}
import { playerProfileService } from './src/services/playerProfileService';
import type { GameState } from './src/types';

// Prevent splash screen auto-hiding until assets and fonts are ready
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Gracefully ignore if splash screen is unsupported or unavailable
}

function MainAppContent() {
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(15);
  const [statusText, setStatusText] = useState('Checking cards...');

  const [currentScreen, setCurrentScreen] = useState<'home' | 'game'>('home');
  const [activePreset, setActivePreset] = useState<SetupPreset>('vs_bot_2p');
  const [activeOnlineMatch, setActiveOnlineMatch] = useState<{
    initialState: GameState;
    playerId: string;
    roomCode: string;
    isQuickMatch?: boolean;
  } | null>(null);

  // 1. Fullscreen Immersive Sticky Mode on Android with animation-settle delays
  useEffect(() => {
    let timer1: NodeJS.Timeout | null = null;
    let timer2: NodeJS.Timeout | null = null;

    const applyImmersiveMode = async () => {
      if (Platform.OS === 'android') {
        try {
          if (typeof (NavigationBar as any).setHidden === 'function') {
            (NavigationBar as any).setHidden(true);
          }
          if (typeof NavigationBar.setVisibilityAsync === 'function') {
            await NavigationBar.setVisibilityAsync('hidden');
          }
          if (typeof (NavigationBar as any).setBehaviorAsync === 'function') {
            await (NavigationBar as any).setBehaviorAsync('overlay-swipe');
          }
        } catch (err) {
          console.warn('[Immersive] NavigationBar configuration warning:', err);
        }
      }
    };

    const triggerImmersiveSticky = () => {
      applyImmersiveMode();
      // Re-trigger after short delays to ensure sticky immersive mode after native activity transition settles
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      timer1 = setTimeout(applyImmersiveMode, 300);
      timer2 = setTimeout(applyImmersiveMode, 1000);
    };

    triggerImmersiveSticky();

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        triggerImmersiveSticky();
      }
    });

    return () => {
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      appStateSub.remove();
    };
  }, []);

  // 2. Cold Start & In-App Deep Link Listener (Auth Callback / Magic Link)
  useEffect(() => {
    const handleAuthUrl = async (url: string) => {
      if (!url) return;
      try {
        if (
          url.includes('code=') ||
          url.includes('access_token=') ||
          url.includes('token_hash=') ||
          url.includes('refresh_token=')
        ) {
          await authService.handleAuthDeepLink(url);
        }
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
          await playerProfileService.getProfile(true);
        }

        // Re-enforce sticky fullscreen immersive mode after returning to the app from external email / browser intent
        if (Platform.OS === 'android') {
          setTimeout(async () => {
            try {
              if (typeof NavigationBar.setVisibilityAsync === 'function') {
                await NavigationBar.setVisibilityAsync('hidden');
              }
              if (typeof (NavigationBar as any).setBehaviorAsync === 'function') {
                await (NavigationBar as any).setBehaviorAsync('overlay-swipe');
              }
            } catch {
              // ignore
            }
          }, 300);
        }
      } catch (err) {
        console.warn('[RivalCard DeepLink] Error handling auth redirect url:', err);
      }
    };

    // Cold-start launch via deep link (external intent)
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleAuthUrl(url);
        }
      })
      .catch((err) => {
        console.warn('[RivalCard DeepLink] getInitialURL warning:', err);
      });

    // In-app warm resume via deep link
    const linkingSub = Linking.addEventListener('url', (event) => {
      if (event.url) {
        handleAuthUrl(event.url);
      }
    });

    return () => {
      linkingSub.remove();
    };
  }, []);

  // 2. Supabase Auth State Change listener to sync profile and set isGuest: false
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          try {
            await playerProfileService.migrateAndLinkGuestAccount(session.user);
            await playerProfileService.getProfile(true);
          } catch (e) {
            console.warn('[App] onAuthStateChange migrate error:', e);
          }
        } else if (event === 'SIGNED_OUT') {
          try {
            await playerProfileService.getProfile(true);
          } catch (e) {
            console.warn('[App] onAuthStateChange sign out error:', e);
          }
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAppResources() {
      try {
        // Step 0: Ensure Audio Mode is initialized and preload common SFX on root mount
        try {
          const modeConfig = {
            playsInSilentMode: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionMode: 'duckOthers',
            allowsRecording: false,
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          };
          if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
            await ExpoAudio.setAudioModeAsync(modeConfig as any);
          } else if (ExpoAudio && (ExpoAudio as any).AudioModule && typeof (ExpoAudio as any).AudioModule.setAudioModeAsync === 'function') {
            await (ExpoAudio as any).AudioModule.setAudioModeAsync(modeConfig);
          }
          await audioService.ensureAudioMode();
          await soundService.ensureAudioMode();
          await soundService.preloadSounds();
          await audioService.preloadSfx();
        } catch (audioInitErr) {
          console.warn('[RivalCard Boot] Root audio mode setup warning:', audioInitErr);
        }

        // Step 1: Custom Typography (Safe Font Loading) & Asset Prefetching
        if (isMounted) {
          setLoadProgress(35);
          setStatusText('Checking cards & assets...');
        }
        try {
          await Promise.allSettled([
            Font.loadAsync({
              Fredoka_400Regular,
              Fredoka_500Medium,
              Fredoka_600SemiBold,
              Fredoka_700Bold,
            }),
            Asset.loadAsync([
              require('./assets/background1.png'),
              require('./assets/homescreen.png'),
              require('./assets/logo.png'),
              require('./assets/card_back.png'),
              require('./assets/icons/icon_skip.png'),
              require('./assets/icons/icon_reverse.png'),
              require('./assets/icons/icon_draw2.png'),
              require('./assets/icons/icon_wild_color_change.png'),
              require('./assets/icons/icon_wild_4.png'),
              require('./assets/icons/icon_mute.png'),
              require('./assets/icons/icon_swap.png'),
              require('./assets/sounds/background.mp3'),
              require('./assets/sounds/match-background.mp3'),
            ]),
          ]);
        } catch (fontErr) {
          console.warn('[RivalCard Boot] Font/Asset loading warning (fallback fonts active):', fontErr);
        }

        // Step 2: Supabase Client & Auth State Validation with offline timeout guard
        if (isMounted) {
          setLoadProgress(70);
          setStatusText('Shuffling deck...');
        }
        try {
          const authRes = await Promise.race([
            supabase.auth.getSession().catch((authErr) => {
              console.warn('[RivalCard Boot] Supabase auth check warning:', authErr);
              return { data: { session: null }, error: null };
            }),
            new Promise<any>((res) => setTimeout(() => res({ data: { session: null }, error: null }), 1500)),
          ]);
          if (authRes?.data?.session?.user) {
            await authService.syncAuthSessionToProfile();
          }
        } catch (supabaseErr) {
          console.warn('[RivalCard Boot] Supabase client warning:', supabaseErr);
        }

        // Step 3: Settings, Guest Profile & Audio Engine Persistence
        try {
          await settingsService.getSettings();
        } catch (settingsErr) {
          console.warn('[RivalCard Boot] Settings load warning:', settingsErr);
        }

        try {
          // Immediately load Guest profile from AsyncStorage
          await playerProfileService.getProfile();
        } catch (profileErr) {
          console.warn('[RivalCard Boot] Profile load warning:', profileErr);
        }

        try {
          await audioService.ensureAudioMode();
        } catch (audioErr) {
          console.warn('[RivalCard Boot] Audio engine initialization warning:', audioErr);
        }

        // Step 4: Finalize & Ready Transition (Instantaneous once real resources resolve)
        if (isMounted) {
          setLoadProgress(100);
          setStatusText('Ready to play!');
        }

        // Brief 60ms tick so 100% renders cleanly before screen hand-off
        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (bootErr) {
        console.warn('[RivalCard Boot] Unhandled resource loading warning:', bootErr);
      } finally {
        if (isMounted) {
          setIsReady(true);
          try {
            await SplashScreen.hideAsync().catch(() => {});
          } catch {
            // Gracefully ignore
          }
        }
      }
    }

    loadAppResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartOfflineGame = useCallback((preset: SetupPreset) => {
    setActivePreset(preset);
    setActiveOnlineMatch(null);
    setCurrentScreen('game');
  }, []);

  const handleStartOnlineGame = useCallback(
    (initialState: GameState, playerId: string, roomCode: string, isQuickMatch: boolean = false) => {
      setActiveOnlineMatch({ initialState, playerId, roomCode, isQuickMatch });
      setCurrentScreen('game');
    },
    []
  );

  const handleGoHome = useCallback(() => {
    setActiveOnlineMatch(null);
    setCurrentScreen('home');
  }, []);

  // Guard condition: Show LoadingScreen with animated progress and status until ready
  if (!isReady) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden={true} />
        <LoadingScreen progress={loadProgress} status={statusText} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden={true} />
      {currentScreen === 'home' ? (
        <HomeScreen
          onStartOfflineGame={handleStartOfflineGame}
          onStartOnlineGame={handleStartOnlineGame}
        />
      ) : (
        <GameScreen
          initialPresetKey={activePreset}
          initialGameState={activeOnlineMatch?.initialState}
          initialLocalOnlinePlayerId={activeOnlineMatch?.playerId}
          initialOnlineRoomCode={activeOnlineMatch?.roomCode}
          isQuickMatch={activeOnlineMatch?.isQuickMatch}
          onGoHome={handleGoHome}
        />
      )}
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [remountKey, setRemountKey] = useState(0);

  const handleAppRestart = useCallback(() => {
    setRemountKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary key={remountKey} onReset={handleAppRestart}>
        <MainAppContent />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
