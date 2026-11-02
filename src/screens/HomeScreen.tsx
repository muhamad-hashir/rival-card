import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import type { GameState } from '../types';

const HOMESCREEN_IMAGE = require('../../assets/homescreen.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

interface HomeScreenProps {
  onStartOfflineGame: (presetKey: SetupPreset) => void;
  onStartOnlineGame: (initialState: GameState, myPlayerId: string, roomCode: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartOfflineGame,
  onStartOnlineGame,
}) => {
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);

  // Lock orientation to portrait when mounting Home Screen
  useEffect(() => {
    async function lockPortrait() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        // Fallback for web or unsupported orientation devices
      }
    }
    lockPortrait();
  }, []);

  // Button 1: Play vs Bot (triggers offline vs bot mode immediately)
  const handlePressVsBot = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('vs_bot_2p');
  };

  // Button 2: Pass & Play (triggers local 2P mode immediately)
  const handlePressPassAndPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('pass_play_2p');
  };

  // Button 3: Online Multiplayer (opens real-time room lobby modal)
  const handlePressOnlineMultiplayer = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsLobbyModalOpen(true);
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={HOMESCREEN_IMAGE}
        style={styles.backgroundImage}
        resizeMode="stretch"
      >
        {/* Invisible Touch Overlay Button 1: Play vs Bot */}
        <Pressable
          onPress={handlePressVsBot}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn1,
            pressed && styles.touchOverlayPressed,
          ]}
        />

        {/* Invisible Touch Overlay Button 2: Pass & Play */}
        <Pressable
          onPress={handlePressPassAndPlay}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn2,
            pressed && styles.touchOverlayPressed,
          ]}
        />

        {/* Invisible Touch Overlay Button 3: Online Multiplayer */}
        <Pressable
          onPress={handlePressOnlineMultiplayer}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn3,
            pressed && styles.touchOverlayPressed,
          ]}
        />
      </ImageBackground>

      {/* Online Multiplayer Hosting & Joining Modal */}
      <MultiplayerLobbyModal
        visible={isLobbyModalOpen}
        onClose={() => setIsLobbyModalOpen(false)}
        onGameStart={(initialState, myPlayerId, roomCode) => {
          setIsLobbyModalOpen(false);
          onStartOnlineGame(initialState, myPlayerId, roomCode);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  touchOverlay: {
    position: 'absolute',
    width: '80%',
    height: '9.8%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  touchOverlayPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  btn1: {
    top: '43.2%',
  },
  btn2: {
    top: '55.4%',
  },
  btn3: {
    top: '67.6%',
  },
});
