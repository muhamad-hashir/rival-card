import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
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
import { settingsService } from './src/services/settingsService';
import { audioService } from './src/services/audioService';
import type { GameState } from './src/types';

// Prevent splash screen auto-hiding until assets and fonts are ready
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Gracefully ignore if splash screen is unsupported or unavailable
}

function MainAppContent() {
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(10);
  const [statusText, setStatusText] = useState('Checking cards...');

  const [currentScreen, setCurrentScreen] = useState<'home' | 'game'>('home');
  const [activePreset, setActivePreset] = useState<SetupPreset>('vs_bot_2p');
  const [activeOnlineMatch, setActiveOnlineMatch] = useState<{
    initialState: GameState;
    playerId: string;
    roomCode: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAppResources() {
      try {
        // Step 1: Custom Typography (Safe Font Loading)
        if (isMounted) {
          setLoadProgress(20);
          setStatusText('Checking cards...');
        }
        try {
          await Font.loadAsync({
            Fredoka_400Regular,
            Fredoka_500Medium,
            Fredoka_600SemiBold,
            Fredoka_700Bold,
          });
        } catch (fontErr) {
          console.warn('[RivalCard Boot] Font loading warning (fallback fonts active):', fontErr);
        }

        // Step 2: Supabase Client & Auth State Validation
        if (isMounted) {
          setLoadProgress(50);
          setStatusText('Connecting to services...');
        }
        try {
          await supabase.auth.getSession().catch((authErr) => {
            console.warn('[RivalCard Boot] Supabase auth check warning:', authErr);
            return { data: { session: null }, error: null };
          });
        } catch (supabaseErr) {
          console.warn('[RivalCard Boot] Supabase client warning:', supabaseErr);
        }

        // Step 3: Audio Engine & Settings Persistence
        if (isMounted) {
          setLoadProgress(75);
          setStatusText('Shuffling deck...');
        }
        try {
          await settingsService.getSettings();
        } catch (settingsErr) {
          console.warn('[RivalCard Boot] Settings load warning:', settingsErr);
        }

        try {
          await audioService.ensureAudioMode();
        } catch (audioErr) {
          console.warn('[RivalCard Boot] Audio engine initialization warning:', audioErr);
        }

        // Step 4: Finalize & Ready Transition
        if (isMounted) {
          setLoadProgress(100);
          setStatusText('Ready!');
        }

        // Short timeout for seamless visual transition
        await new Promise((resolve) => setTimeout(resolve, 250));
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
    (initialState: GameState, playerId: string, roomCode: string) => {
      setActiveOnlineMatch({ initialState, playerId, roomCode });
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
        <StatusBar style="dark" />
        <LoadingScreen progress={loadProgress} status={statusText} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
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
    <ErrorBoundary key={remountKey} onReset={handleAppRestart}>
      <MainAppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
