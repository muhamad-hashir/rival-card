// src/components/OnboardingAuthModal.tsx - First-Launch Onboarding & Auth Flow Modal
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { authService } from '../services/authService';
import { errorToastService } from '../services/errorToastService';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';

export interface OnboardingAuthModalProps {
  visible: boolean;
  onSuccess: () => void;
}

export const OnboardingAuthModal: React.FC<OnboardingAuthModalProps> = ({
  visible,
  onSuccess,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleContinueAsGuest = async () => {
    if (isSigningIn) return;
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      await authService.initGuestProfile();
      onSuccess();
    } catch (err) {
      console.warn('Guest onboarding init error:', err);
      onSuccess();
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      const res = await authService.signInWithGoogle();
      if (!res.success) {
        errorToastService.showWarning(
          'Sign-in was canceled or timed out. Continuing in Guest mode.',
          4000
        );
        await authService.initGuestProfile();
        onSuccess();
      } else {
        soundService.playWinChime();
        onSuccess();
      }
    } catch {
      errorToastService.showWarning(
        'Sign-in was canceled or timed out. Continuing in Guest mode.',
        4000
      );
      await authService.initGuestProfile();
      onSuccess();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Top Mascot Emblem */}
          <View style={styles.mascotCircle}>
            <Text style={styles.mascotEmoji}>🦊⚡</Text>
          </View>

          {/* Heading Tag */}
          <View style={styles.welcomeTag}>
            <Text style={styles.welcomeTagText}>WELCOME TO</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>RIVAL CARD!</Text>

          {/* Subtext */}
          <Text style={styles.subtext}>
            Play as a guest or sign in to save your level, coins, and cosmetics across devices.
          </Text>

          {/* Feature highlights pill row */}
          <View style={styles.featureHighlights}>
            <View style={styles.featurePill}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={styles.featureText}>Fast 1v1 & 4P</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureIcon}>🪙</Text>
              <Text style={styles.featureText}>Earn Coins</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureIcon}>🎨</Text>
              <Text style={styles.featureText}>Cosmetics</Text>
            </View>
          </View>

          {/* Action 1: Continue as Guest (Primary Action) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleContinueAsGuest}
            disabled={isSigningIn}
            style={styles.guestBtn}
          >
            <Text style={styles.guestBtnText}>Continue as Guest ➔</Text>
          </TouchableOpacity>

          {/* Action 2: Sign in with Google */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleGoogleSignIn}
            disabled={isSigningIn}
            style={styles.googleBtn}
          >
            {isSigningIn ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <View style={styles.googleBtnContent}>
                <View style={styles.googleIconBadge}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Privacy Note Footnote */}
          <Text style={styles.footnoteText}>
            You can always link your account later in Settings.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFDF7', // Warm cream container
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  mascotCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FED7AA',
    borderWidth: 3,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mascotEmoji: {
    fontSize: 36,
  },
  welcomeTag: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 4,
  },
  welcomeTagText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#D97706',
    letterSpacing: 1.2,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtext: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  featureHighlights: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  featureIcon: {
    fontSize: 12,
  },
  featureText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#334155',
  },
  guestBtn: {
    width: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  guestBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  googleBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  googleBtnText: {
    ...FONT_CARTOON_BOLD,
    color: '#0F172A',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  footnoteText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
