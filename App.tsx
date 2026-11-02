import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen, SetupPreset } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import type { GameState } from './src/types';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'game'>('home');
  const [activePreset, setActivePreset] = useState<SetupPreset>('vs_bot_2p');
  const [activeOnlineMatch, setActiveOnlineMatch] = useState<{
    initialState: GameState;
    playerId: string;
    roomCode: string;
  } | null>(null);

  const handleStartOfflineGame = (preset: SetupPreset) => {
    setActivePreset(preset);
    setActiveOnlineMatch(null);
    setCurrentScreen('game');
  };

  const handleStartOnlineGame = (
    initialState: GameState,
    playerId: string,
    roomCode: string
  ) => {
    setActiveOnlineMatch({ initialState, playerId, roomCode });
    setCurrentScreen('game');
  };

  const handleGoHome = () => {
    setActiveOnlineMatch(null);
    setCurrentScreen('home');
  };

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
