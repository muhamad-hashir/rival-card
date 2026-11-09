// src/components/ProfileModal.tsx - Lightweight profile editor and stats modal
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AVATAR_OPTIONS,
  AvatarOption,
  PlayerProfile,
  getAvatarConfig,
  playerProfileService,
} from '../services/playerProfileService';
import { authService } from '../services/authService';
import { errorToastService } from '../services/errorToastService';
import { networkService } from '../services/networkService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';

export interface ProfileModalProps {
  visible: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (newNickname: string, newAvatarId: string) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  profile,
  onClose,
  onSave,
}) => {
  const [nickname, setNickname] = useState<string>(profile.nickname);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(profile.avatarId);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Email OTP Flow state
  const [authMode, setAuthMode] = useState<'options' | 'email_input' | 'otp_verify'>('options');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (visible) {
      setNickname(profile.nickname);
      setSelectedAvatarId(profile.avatarId);
      setIsSaving(false);
      setIsSigningIn(false);
      setSaveStatus('idle');
      setAuthMode('options');
      setEmailInput('');
      setOtpInput('');
      setAuthError(null);
      setCountdown(0);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [visible, profile]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const activeAvatar = getAvatarConfig(selectedAvatarId);
  const winRate =
    profile.stats.gamesPlayed > 0
      ? Math.round((profile.stats.wins / profile.stats.gamesPlayed) * 100)
      : 0;

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    hapticsService.cardSnap();
    soundService.playCardSnap();

    // Fast offline check
    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      errorToastService.showWarning(
        "You're disconnected! Please check your connection and try again.",
        4000
      );
      return;
    }

    setIsSigningIn(true);
    try {
      const res = await authService.signInWithGoogle();
      if (!res.success) {
        errorToastService.showWarning(
          res.error || 'Google sign-in was cancelled or timed out.',
          4000
        );
      } else {
        if (res.url && Platform.OS !== 'web') {
          try {
            await Linking.openURL(res.url);
          } catch (e) {
            console.warn('[ProfileModal] Could not open external OAuth URL:', e);
          }
        }
        soundService.playWinChime();
        errorToastService.show({
          message: 'Signing in with Google...',
          type: 'info',
          durationMs: 3000,
        });
        await playerProfileService.getProfile(true);
      }
    } catch (err: any) {
      errorToastService.showWarning(
        err?.message || 'Google sign-in was cancelled or timed out.',
        4000
      );
    } finally {
      setIsSigningIn(false);
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
      const res = await authService.sendEmailOtp(cleanEmail);
      if (!res.success) {
        setAuthError(res.error || 'Failed to send verification code.');
      } else {
        setAuthMode('otp_verify');
        setCountdown(60);
        soundService.playCardSnap();
        errorToastService.show({
          message: 'Verification code sent to your email!',
          type: 'info',
          durationMs: 3000,
        });
      }
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
      const res = await authService.verifyEmailOtp(emailInput, cleanToken);
      if (!res.success) {
        setAuthError(res.error || 'Invalid or expired code. Please try again.');
      } else {
        soundService.playWinChime();
        errorToastService.show({
          message: 'Signed in successfully!',
          type: 'info',
          durationMs: 3000,
        });
        setAuthMode('options');
        setEmailInput('');
        setOtpInput('');
        await playerProfileService.getProfile(true);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSignOut = async () => {
    hapticsService.cardSnap();
    soundService.playCardDraw();
    try {
      await authService.signOut();
      errorToastService.show({
        message: 'Signed out. Playing as Guest.',
        type: 'info',
        durationMs: 2500,
      });
      setAuthMode('options');
      setEmailInput('');
      setOtpInput('');
      setAuthError(null);
      await playerProfileService.getProfile(true);
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
  };

  // Auto-save avatar selection immediately
  const handleSelectAvatar = async (avatarId: string) => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setSelectedAvatarId(avatarId);
    setSaveStatus('saving');
    try {
      await playerProfileService.updateAvatar(avatarId);
      setSaveStatus('saved');
    } catch (err) {
      console.warn('Failed to auto-save avatar:', err);
    }
  };

  // Debounced auto-save on nickname keystrokes
  const handleNicknameChange = (text: string) => {
    setNickname(text);
    setSaveStatus('saving');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      const clean = text.trim() || 'Player';
      try {
        await playerProfileService.updateNickname(clean);
        setSaveStatus('saved');
      } catch (err) {
        console.warn('Failed to auto-save nickname:', err);
      }
    }, 350);
  };

  // Immediate save on blur or submit
  const handleNicknameCommit = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const clean = nickname.trim() || 'Player';
    setSaveStatus('saving');
    try {
      await playerProfileService.updateNickname(clean);
      setSaveStatus('saved');
    } catch (err) {
      console.warn('Failed to commit nickname:', err);
    }
  };

  // Safe close that flushes any pending nickname updates
  const handleClose = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const clean = nickname.trim() || 'Player';
    try {
      await playerProfileService.updateNickname(clean);
      await playerProfileService.updateAvatar(selectedAvatarId);
    } catch {
      // ignore
    }
    onClose();
  };

  const handleSave = async () => {
    hapticsService.cardSnap();
    soundService.playCardDraw();
    setIsSaving(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    try {
      const clean = nickname.trim() || 'Player';
      await playerProfileService.updateNickname(clean);
      await playerProfileService.updateAvatar(selectedAvatarId);
      setSaveStatus('saved');
      await onSave(clean, selectedAvatarId);
      onClose();
    } catch (err) {
      console.warn('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header: Title and Close button */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>👤</Text>
              <Text style={styles.headerTitle}>PLAYER PROFILE</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Modal Body */}
          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Selected Avatar Preview & Guest/Verified Badge */}
            <View style={styles.previewSection}>
              <View style={[styles.largeAvatarCircle, { backgroundColor: activeAvatar.bgColor }]}>
                <Text style={styles.largeAvatarEmoji}>{activeAvatar.emoji}</Text>
              </View>

              {profile.isGuest ? (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeDot}>●</Text>
                  <Text style={styles.guestBadgeText}>Guest Account</Text>
                </View>
              ) : (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeDot}>✓</Text>
                  <Text style={styles.verifiedBadgeText}>
                    {profile.email || 'Cloud Account'}
                  </Text>
                </View>
              )}

              {/* Economy Currency Balances (Coins & Gems) */}
              <View style={styles.economyRow}>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsBadgeIcon}>🪙</Text>
                  <Text style={styles.coinsBadgeText}>{profile.coins ?? 250}</Text>
                </View>
                <View style={styles.gemsBadge}>
                  <Text style={styles.gemsBadgeIcon}>💎</Text>
                  <Text style={styles.gemsBadgeText}>{profile.gems ?? 10}</Text>
                </View>
              </View>
            </View>

            {/* Level & XP Progression Card */}
            <View style={styles.levelCard}>
              <View style={styles.levelHeaderRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>⭐ LVL {profile.level ?? 1}</Text>
                </View>
                <Text style={styles.levelXpText}>
                  {profile.currentXp ?? 0} / {profile.xpToNextLevel ?? 100} XP
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            ((profile.currentXp ?? 0) / (profile.xpToNextLevel || 100)) * 100
                          )
                        )
                      )}%`,
                    },
                  ]}
                >
                  <View style={styles.xpGlintLine} />
                </View>
              </View>
            </View>

            {/* Nickname Input Field */}
            <View style={styles.inputSection}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.inputLabel}>YOUR NICKNAME</Text>
                {saveStatus === 'saved' && (
                  <View style={styles.savedBadge}>
                    <Text style={styles.savedCheckmark}>✓</Text>
                    <Text style={styles.savedText}>Saved</Text>
                  </View>
                )}
                {saveStatus === 'saving' && (
                  <View style={styles.savingBadge}>
                    <Text style={styles.savingText}>Saving...</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={styles.nicknameInput}
                value={nickname}
                onChangeText={handleNicknameChange}
                onEndEditing={handleNicknameCommit}
                onBlur={handleNicknameCommit}
                placeholder="Enter your name"
                placeholderTextColor="#94A3B8"
                maxLength={15}
                autoCorrect={false}
              />
            </View>

            {/* Choose Avatar Grid */}
            <View style={styles.avatarSection}>
              <Text style={styles.sectionLabel}>CHOOSE AVATAR</Text>
              <View style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map((item: AvatarOption) => {
                  const isSelected = item.id === selectedAvatarId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => handleSelectAvatar(item.id)}
                      style={[
                        styles.avatarOptionCard,
                        isSelected && styles.avatarOptionCardSelected,
                      ]}
                    >
                      {isSelected && (
                        <View style={styles.avatarSelectedBadge}>
                          <Text style={styles.avatarSelectedBadgeText}>✓</Text>
                        </View>
                      )}
                      <View style={[styles.avatarOptionCircle, { backgroundColor: item.bgColor }]}>
                        <Text style={styles.avatarOptionEmoji}>{item.emoji}</Text>
                      </View>
                      <Text style={[styles.avatarOptionLabel, isSelected && styles.avatarOptionLabelSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Expanded Career Stats 2x2 Grid */}
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Text style={styles.statsCardHeaderIcon}>📊</Text>
                <Text style={styles.statsCardTitle}>CAREER STATISTICS</Text>
              </View>
              <View style={styles.statsGrid}>
                {/* 1. Matches */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={styles.statNumber}>{profile.stats.gamesPlayed}</Text>
                  <Text style={styles.statLabel}>MATCHES</Text>
                </View>

                {/* 2. Wins */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statWinsNumber]}>
                    {profile.stats.wins}
                  </Text>
                  <Text style={styles.statLabel}>WINS 🏆</Text>
                </View>

                {/* 3. Win Rate */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statRateNumber]}>
                    {winRate}%
                  </Text>
                  <Text style={styles.statLabel}>WIN RATE</Text>
                </View>

                {/* 4. Streak */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statStreakNumber]}>
                    {profile.stats.winStreak}
                  </Text>
                  <Text style={styles.statLabel}>STREAK 🔥</Text>
                </View>
              </View>
            </View>

            {/* Cloud Save & Account Management Card */}
            {!profile.isGuest ? (
              <View style={styles.authCard}>
                <View style={styles.authHeaderRow}>
                  <View style={styles.authHeaderTitleRow}>
                    <Text style={styles.authHeaderIcon}>☁️</Text>
                    <Text style={styles.authHeaderTitle}>LINKED CLOUD ACCOUNT</Text>
                  </View>
                  <View style={styles.cloudSyncPill}>
                    <Text style={styles.cloudSyncDot}>●</Text>
                    <Text style={styles.cloudSyncText}>Synced</Text>
                  </View>
                </View>
                <Text style={styles.authEmailDisplay}>{profile.email || 'Cloud Account Linked'}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSignOut}
                  style={styles.signOutBtn}
                >
                  <Text style={styles.signOutBtnText}>Sign Out to Guest</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.authCard}>
                <View style={styles.authHeaderRow}>
                  <View style={styles.authHeaderTitleRow}>
                    <Text style={styles.authHeaderIcon}>🛡️</Text>
                    <Text style={styles.authHeaderTitle}>SAVE PROGRESS TO CLOUD</Text>
                  </View>
                </View>

                {authMode === 'options' && (
                  <>
                    <Text style={styles.authSubtitle}>
                      Sign in to sync your level, coins, and unlocks across devices.
                    </Text>

                    {/* Google OAuth Button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.googleAuthBtn}
                      onPress={handleGoogleSignIn}
                      disabled={isSigningIn}
                    >
                      {isSigningIn ? (
                        <ActivityIndicator color="#2D1F17" size="small" />
                      ) : (
                        <View style={styles.googleBtnContent}>
                          <View style={styles.googleIconCircle}>
                            <Text style={styles.googleIconText}>G</Text>
                          </View>
                          <Text style={styles.googleAuthBtnText}>Continue with Google</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Email OTP Button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.emailAuthBtn}
                      onPress={() => {
                        hapticsService.cardSnap();
                        soundService.playCardSnap();
                        setAuthError(null);
                        setAuthMode('email_input');
                      }}
                    >
                      <View style={styles.emailAuthBtnContent}>
                        <View style={styles.emailIconCircle}>
                          <Text style={styles.emailIconEmoji}>✉️</Text>
                        </View>
                        <Text style={styles.emailAuthBtnText}>Sign in with Email Code</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {authMode === 'email_input' && (
                  <>
                    <Text style={styles.authSubtitle}>
                      Enter your email to receive a 6-digit verification code:
                    </Text>
                    <TextInput
                      style={styles.authTextInput}
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
                      <View style={styles.authErrorBanner}>
                        <Text style={styles.authErrorText}>{authError}</Text>
                      </View>
                    )}

                    <View style={styles.authActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setAuthError(null);
                          setAuthMode('options');
                        }}
                        style={styles.authCancelBtn}
                      >
                        <Text style={styles.authCancelBtnText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSendOtp}
                        disabled={isSendingOtp || !emailInput.trim()}
                        style={[
                          styles.authConfirmBtn,
                          !emailInput.trim() && styles.authConfirmBtnDisabled,
                        ]}
                      >
                        {isSendingOtp ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.authConfirmBtnText}>Send Code ➔</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {authMode === 'otp_verify' && (
                  <>
                    <Text style={styles.authSubtitle}>
                      Enter the 6-digit code sent to:
                    </Text>
                    <View style={styles.targetEmailRow}>
                      <Text style={styles.targetEmailText} numberOfLines={1}>
                        {emailInput}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setAuthError(null);
                          setAuthMode('email_input');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.editEmailText}>Edit</Text>
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

                    {authError && (
                      <View style={styles.authErrorBanner}>
                        <Text style={styles.authErrorText}>{authError}</Text>
                      </View>
                    )}

                    <View style={styles.authActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={countdown > 0 ? undefined : handleSendOtp}
                        disabled={countdown > 0 || isSendingOtp}
                        style={[styles.authResendBtn, countdown > 0 && styles.authResendBtnDisabled]}
                      >
                        <Text style={[styles.authResendBtnText, countdown > 0 && styles.authResendBtnTextDisabled]}>
                          {countdown > 0 ? `Resend (${countdown}s)` : 'Resend'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpInput.trim().length < 6}
                        style={[
                          styles.authConfirmBtn,
                          otpInput.trim().length < 6 && styles.authConfirmBtnDisabled,
                        ]}
                      >
                        {isVerifyingOtp ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.authConfirmBtnText}>Verify & Sign In ✓</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Save Profile Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Profile'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: '#FEF6E9',
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    overflow: 'hidden',
  },
  modalBodyScroll: {
    width: '100%',
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 24,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2D9C8',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2D9C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '900',
  },
  previewSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  largeAvatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 6,
  },
  largeAvatarEmoji: {
    fontSize: 34,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 5,
  },
  guestBadgeDot: {
    fontSize: 8,
    color: '#10B981',
  },
  guestBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 5,
  },
  verifiedBadgeDot: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#16A34A',
  },
  verifiedBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#15803D',
  },
  economyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  coinsBadgeIcon: {
    fontSize: 13,
  },
  coinsBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#92400E',
  },
  gemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  gemsBadgeIcon: {
    fontSize: 13,
  },
  gemsBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0369A1',
  },
  levelCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: '#FEF6E9',
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#0F172A',
  },
  levelXpText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#15803D',
  },
  xpTrack: {
    width: '100%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  xpGlintLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  inputSection: {
    width: '100%',
    marginVertical: 8,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inputLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  savedCheckmark: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#16A34A',
  },
  savedText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#16A34A',
  },
  savingBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  savingText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
  },
  nicknameInput: {
    ...FONT_CARTOON_BOLD,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'center',
  },
  avatarSection: {
    width: '100%',
    marginVertical: 4,
  },
  sectionLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  avatarOptionCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    alignItems: 'center',
  },
  avatarOptionCardSelected: {
    borderColor: '#FACC15',
    backgroundColor: '#FEF9C3',
    borderWidth: 2.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 5,
    transform: [{ scale: 1.04 }],
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarSelectedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  avatarOptionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  avatarOptionEmoji: {
    fontSize: 16,
  },
  avatarOptionLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
  },
  avatarOptionLabelSelected: {
    color: '#1D4ED8',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    padding: 12,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statsCardHeaderIcon: {
    fontSize: 13,
  },
  statsCardTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  statBoxGlint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statNumber: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 3,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  statWinsNumber: {
    color: '#10B981',
  },
  statRateNumber: {
    color: '#38BDF8',
  },
  statStreakNumber: {
    color: '#FACC15',
  },
  statLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  authCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 14,
    marginVertical: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  authHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authHeaderIcon: {
    fontSize: 14,
  },
  authHeaderTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.7,
  },
  cloudSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  cloudSyncDot: {
    fontSize: 8,
    color: '#16A34A',
  },
  cloudSyncText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#15803D',
  },
  authEmailDisplay: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#0F172A',
    marginVertical: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signOutBtn: {
    height: 38,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  authSubtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  googleAuthBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#2D1F17',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#2D1F17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2D1F17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#4285F4',
    lineHeight: 15,
  },
  googleAuthBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#2D1F17',
    letterSpacing: 0.4,
  },
  emailAuthBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  emailAuthBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emailIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIconEmoji: {
    fontSize: 12,
  },
  emailAuthBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  authTextInput: {
    ...FONT_CARTOON_BOLD,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  targetEmailRow: {
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
  targetEmailText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  editEmailText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#2563EB',
    paddingHorizontal: 6,
  },
  otpInput: {
    ...FONT_CARTOON_HEAVY,
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
  authActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  authCancelBtn: {
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authCancelBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#475569',
  },
  authResendBtn: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authResendBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.7,
  },
  authResendBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#92400E',
  },
  authResendBtnTextDisabled: {
    color: '#94A3B8',
  },
  authConfirmBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderColor: '#059669',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authConfirmBtnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    opacity: 0.6,
  },
  authConfirmBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  authErrorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  authErrorText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'center',
  },
  saveBtn: {
    width: '90%',
    height: 48,
    backgroundColor: '#10B981',
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    alignSelf: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
