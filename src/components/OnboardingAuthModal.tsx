// src/components/OnboardingAuthModal.tsx - First-Launch Onboarding & Auth Flow Modal
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { authService, sendEmailOtp, verifyEmailOtp } from '../services/authService';
import { errorToastService } from '../services/errorToastService';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { networkService } from '../services/networkService';
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
  const [authMode, setAuthMode] = useState<'welcome' | 'email_input' | 'otp_verify'>('welcome');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const reassertImmersive = async () => {
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
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (visible) {
      setAuthMode('welcome');
      setEmailInput('');
      setOtpInput('');
      setAuthError(null);
      setCountdown(0);
      setIsSendingOtp(false);
      setIsVerifyingOtp(false);
      setIsSigningIn(false);
      reassertImmersive();
    }
  }, [visible]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleContinueAsGuest = async () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      await authService.initGuestProfile();
      await reassertImmersive();
      onSuccess();
    } catch (err) {
      console.warn('Guest onboarding init error:', err);
      await reassertImmersive();
      onSuccess();
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      const isOnline = await networkService.isOnline();
      if (!isOnline) {
        setAuthError("You're offline! Please check your internet connection.");
        return;
      }

      const res = await authService.signInWithGoogleNative();
      if (res && !(res as any).cancelled) {
        soundService.playWinChime();
        errorToastService.show({
          message: 'Signed in with Google!',
          type: 'info',
          durationMs: 3000,
        });
        await reassertImmersive();
        onSuccess();
      }
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED' && err?.message !== 'SIGN_IN_CANCELLED') {
        setAuthError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
      await reassertImmersive();
    }
  };

  const handleSendOtp = async () => {
    if (isSendingOtp) return;
    setAuthError(null);
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      setAuthError("You're offline! Please check your internet connection.");
      return;
    }

    setIsSendingOtp(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      await sendEmailOtp(cleanEmail);
      setAuthMode('otp_verify');
      setCountdown(60);
      soundService.playCardSnap();
      errorToastService.show({
        message: 'Verification code sent to your email!',
        type: 'info',
        durationMs: 3000,
      });
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isVerifyingOtp) return;
    setAuthError(null);
    const cleanToken = otpInput.trim();
    if (!cleanToken || cleanToken.length < 6) {
      setAuthError('Please enter the 6-digit verification code.');
      return;
    }

    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      setAuthError("You're offline! Please check your internet connection.");
      return;
    }

    setIsVerifyingOtp(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      await verifyEmailOtp(emailInput, cleanToken);
      soundService.playWinChime();
      errorToastService.show({
        message: 'Signed in successfully!',
        type: 'info',
        durationMs: 3000,
      });
      onSuccess();
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <StatusBar hidden={true} />
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

          {authMode === 'welcome' && (
            <>
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

              {authError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              )}

              {/* Action 1: Sign in with Google */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleGoogleSignIn}
                disabled={isSigningIn}
                style={[styles.googleBtn, isSigningIn && styles.btnDisabled]}
              >
                {isSigningIn ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <View style={styles.googleBtnContent}>
                    <Text style={styles.googleGLogo}>G</Text>
                    <Text style={styles.googleBtnText}>Sign in with Google</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Action 2: Continue as Guest */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleContinueAsGuest}
                disabled={isSigningIn}
                style={styles.guestBtn}
              >
                <Text style={styles.guestBtnText}>Continue as Guest ➔</Text>
              </TouchableOpacity>

              {/* Privacy Note Footnote */}
              <Text style={styles.footnoteText}>
                You can always link your account later in your Profile settings.
              </Text>
            </>
          )}

          {authMode === 'email_input' && (
            <View style={styles.emailFormContainer}>
              <Text style={styles.emailFormSubtitle}>
                Enter your email address to receive a 6-digit login code:
              </Text>

              <TextInput
                style={styles.emailTextInput}
                value={emailInput}
                onChangeText={(txt) => {
                  setEmailInput(txt);
                  setAuthError(null);
                }}
                placeholder="player@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {authError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              )}

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setAuthError(null);
                    setAuthMode('welcome');
                  }}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSendOtp}
                  disabled={isSendingOtp || !emailInput.trim()}
                  style={[
                    styles.sendCodeBtn,
                    !emailInput.trim() && styles.btnDisabled,
                  ]}
                >
                  {isSendingOtp ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.sendCodeBtnText}>Send Code ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {authMode === 'otp_verify' && (
            <View style={styles.emailFormContainer}>
              <Text style={styles.emailFormSubtitle}>
                Enter the 6-digit verification code sent to:
              </Text>

              <View style={styles.emailBadgeRow}>
                <Text style={styles.emailBadgeText} numberOfLines={1}>
                  {emailInput}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setAuthError(null);
                    setAuthMode('email_input');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.emailEditLink}>Edit</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.otpInput}
                value={otpInput}
                onChangeText={(txt) => {
                  const digits = txt.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtpInput(digits);
                  setAuthError(null);
                }}
                placeholder="000000"
                placeholderTextColor="#CBD5E1"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <View style={styles.otpTipContainer}>
                <Text style={styles.otpTipIcon}>💡</Text>
                <Text style={styles.otpTipText}>
                  Check your Gmail for the 6-digit code! You don't need to tap the email link—just type the code here.
                </Text>
              </View>

              {authError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              )}

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={countdown > 0 ? undefined : handleSendOtp}
                  disabled={countdown > 0 || isSendingOtp}
                  style={[styles.resendBtn, countdown > 0 && styles.resendBtnDisabled]}
                >
                  <Text style={[styles.resendBtnText, countdown > 0 && styles.resendBtnTextDisabled]}>
                    {countdown > 0 ? `${countdown}s` : 'Resend'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleVerifyOtp}
                  disabled={isVerifyingOtp || otpInput.trim().length < 6}
                  style={[
                    styles.verifyBtn,
                    otpInput.trim().length < 6 && styles.btnDisabled,
                  ]}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verify & Play ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    backgroundColor: '#FFFDF7',
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
    backgroundColor: '#10B981',
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  guestBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  googleBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleGLogo: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 18,
    color: '#4285F4',
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
  emailBtn: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emailBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emailBtnIcon: {
    fontSize: 13,
  },
  emailBtnText: {
    ...FONT_CARTOON_BOLD,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  footnoteText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emailFormContainer: {
    width: '100%',
    marginTop: 4,
  },
  emailFormSubtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  emailTextInput: {
    ...FONT_CARTOON_BOLD,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  emailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  emailBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  emailEditLink: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#2563EB',
    paddingHorizontal: 6,
  },
  otpInput: {
    ...FONT_CARTOON_HEAVY,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 8,
  },
  otpTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    gap: 6,
  },
  otpTipIcon: {
    fontSize: 14,
  },
  otpTipText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 15,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  errorText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  backBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#475569',
  },
  resendBtn: {
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  resendBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#92400E',
  },
  resendBtnTextDisabled: {
    color: '#94A3B8',
  },
  sendCodeBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderColor: '#059669',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCodeBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  verifyBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderColor: '#059669',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  btnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    opacity: 0.6,
  },
});
