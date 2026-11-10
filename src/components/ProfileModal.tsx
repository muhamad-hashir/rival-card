// src/components/ProfileModal.tsx - Lightweight profile editor and stats modal
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
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
import { authService, sendEmailOtp, verifyEmailOtp } from '../services/authService';
import { errorToastService } from '../services/errorToastService';
import { networkService } from '../services/networkService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { validateUsername } from '../utils/contentFilter';
import { supabase } from '../services/supabase';

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
  // Isolated local input buffer (allows clearing freely without forcing 'Player' while typing)
  const [inputValue, setInputValue] = useState<string>(profile.nickname || 'Player');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(profile.avatarId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [session, setSession] = useState<any>(null);

  // Email OTP Flow state ("enter_email" -> "enter_code")
  const [authStep, setAuthStep] = useState<'enter_email' | 'enter_code'>('enter_email');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Listen to Supabase auth session changes for real-time connected state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (visible) {
      setInputValue(profile.nickname || 'Player');
      setNameError(null);
      setSelectedAvatarId(profile.avatarId);
      setIsSaving(false);
      setSaveStatus('idle');
      setAuthStep('enter_email');
      setEmailInput('');
      setOtpInput('');
      setAuthError(null);
      setCountdown(0);
      setIsSendingOtp(false);
      setIsVerifyingOtp(false);
    }
  }, [visible, profile]);

  const isConnected = !profile.isGuest || Boolean(session?.user);
  const connectedEmail = session?.user?.email || profile.email;

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

  const handleSendOtp = async () => {
    if (isSendingOtp) return;
    setAuthError(null);
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid Gmail or email address.');
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
      setAuthStep('enter_code');
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
        message: 'Connected successfully! Progress saved to cloud.',
        type: 'info',
        durationMs: 3000,
      });
      setAuthStep('enter_email');
      setEmailInput('');
      setOtpInput('');
      await playerProfileService.getProfile(true);
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
      setSession(null);
      errorToastService.show({
        message: 'Signed out. Playing as Guest.',
        type: 'info',
        durationMs: 2500,
      });
      setAuthStep('enter_email');
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

  // Keystroke handler: updates local buffer freely without debounced overwriting to 'Player'
  const handleNameChange = (text: string) => {
    setInputValue(text);
    if (nameError) setNameError(null);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  };

  // On blur handler: reverts empty input to previous name, or validates if typed
  const handleNameBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) {
      // If abandoned completely empty on blur, revert to previous name
      setInputValue(profile.nickname || 'Player');
      setNameError(null);
      return;
    }
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      return;
    }
    const valResult = validateUsername(trimmed);
    if (!valResult.isValid) {
      setNameError(valResult.error || 'Invalid username');
    } else {
      setNameError(null);
    }
  };

  // Safe close: discards uncommitted nickname changes without forcing 'Player'
  const handleClose = () => {
    setNameError(null);
    onClose();
  };

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      hapticsService.cardSelection();
      soundService.playCardSnap();
      return;
    }

    // 1. Validate username criteria (3-16 chars, profanity filter, leetspeak)
    const validation = validateUsername(trimmed);
    if (!validation.isValid) {
      setNameError(validation.error || 'Invalid username');
      hapticsService.cardSelection();
      soundService.playCardSnap();
      return;
    }

    setNameError(null);
    setIsSaving(true);
    hapticsService.cardSnap();
    soundService.playCardDraw();

    try {
      await playerProfileService.updateNickname(trimmed);
      await playerProfileService.updateAvatar(selectedAvatarId);
      setSaveStatus('saved');
      await onSave(trimmed, selectedAvatarId);
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

              {!isConnected ? (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeDot}>●</Text>
                  <Text style={styles.guestBadgeText}>Guest Account</Text>
                </View>
              ) : (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeDot}>✓</Text>
                  <Text style={styles.verifiedBadgeText}>
                    {connectedEmail || 'Cloud Account'}
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
                <View style={styles.inputStatusRow}>
                  {saveStatus === 'saved' && (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedCheckmark}>✓</Text>
                      <Text style={styles.savedText}>Saved</Text>
                    </View>
                  )}
                  <Text style={styles.charCountBadge}>{inputValue.length}/16</Text>
                </View>
              </View>
              <TextInput
                style={[styles.nicknameInput, !!nameError && styles.nicknameInputError]}
                value={inputValue}
                onChangeText={handleNameChange}
                onBlur={handleNameBlur}
                onSubmitEditing={handleSave}
                placeholder="Enter name (min 3 chars)"
                placeholderTextColor="#94A3B8"
                maxLength={16}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {nameError && (
                <View style={styles.nameErrorBanner}>
                  <Text style={styles.nameErrorIcon}>⚠️</Text>
                  <Text style={styles.nameErrorText}>{nameError}</Text>
                </View>
              )}
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
            {isConnected ? (
              <View style={styles.connectedCard}>
                <Text style={styles.connectedBadge}>✓ CONNECTED</Text>
                <Text style={styles.userEmail}>{connectedEmail}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSignOut}
                  style={styles.signOutBtn}
                >
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.authCard}>
                <View style={styles.authHeaderRow}>
                  <View style={styles.authHeaderTitleRow}>
                    <Text style={styles.authHeaderIcon}>📧</Text>
                    <Text style={styles.authHeaderTitle}>CONNECT VIA GMAIL / EMAIL</Text>
                  </View>
                </View>

                {authStep === 'enter_email' ? (
                  <>
                    <Text style={styles.authSubtitle}>
                      Enter your Gmail address to sync your progress, level, and coins across devices.
                    </Text>
                    <TextInput
                      style={styles.authTextInput}
                      value={emailInput}
                      onChangeText={(txt) => {
                        setEmailInput(txt);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Enter your Gmail address"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="send"
                      onSubmitEditing={handleSendOtp}
                    />

                    {authError && (
                      <View style={styles.authErrorBanner}>
                        <Text style={styles.authErrorText}>{authError}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSendOtp}
                      disabled={isSendingOtp || !emailInput.trim()}
                      style={[
                        styles.primaryAuthBtn,
                        (!emailInput.trim() || isSendingOtp) && styles.primaryAuthBtnDisabled,
                      ]}
                    >
                      {isSendingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryAuthBtnText}>Send Code</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.authSubtitle}>
                      Enter the 6-digit verification code sent to:
                    </Text>
                    <View style={styles.targetEmailRow}>
                      <Text style={styles.targetEmailText} numberOfLines={1}>
                        {emailInput}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setAuthError(null);
                          setAuthStep('enter_email');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.editEmailText}>Change Email</Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.otpInput}
                      value={otpInput}
                      onChangeText={(txt) => {
                        const digits = txt.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtpInput(digits);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyOtp}
                    />

                    {authError && (
                      <View style={styles.authErrorBanner}>
                        <Text style={styles.authErrorText}>{authError}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleVerifyOtp}
                      disabled={isVerifyingOtp || otpInput.trim().length < 6}
                      style={[
                        styles.primaryAuthBtn,
                        (otpInput.trim().length < 6 || isVerifyingOtp) && styles.primaryAuthBtnDisabled,
                      ]}
                    >
                      {isVerifyingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryAuthBtnText}>Verify & Connect</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.subAuthActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={countdown > 0 ? undefined : handleSendOtp}
                        disabled={countdown > 0 || isSendingOtp}
                        style={[styles.smallSubBtn, countdown > 0 && styles.smallSubBtnDisabled]}
                      >
                        <Text style={[styles.smallSubBtnText, countdown > 0 && styles.smallSubBtnTextDisabled]}>
                          {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setAuthError(null);
                          setAuthStep('enter_email');
                        }}
                        style={styles.smallSubBtn}
                      >
                        <Text style={styles.smallSubBtnText}>Change Email</Text>
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
  inputStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charCountBadge: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.5,
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
  nicknameInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  nameErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#F87171',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  nameErrorIcon: {
    fontSize: 12,
  },
  nameErrorText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
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
  connectedCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderColor: '#86EFAC',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedBadge: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
    letterSpacing: 0.8,
  },
  userEmail: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#1E293B',
    marginVertical: 8,
    textAlign: 'center',
  },
  signOutBtn: {
    height: 38,
    paddingHorizontal: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signOutText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#DC2626',
    letterSpacing: 0.5,
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
  primaryAuthBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryAuthBtnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryAuthBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subAuthActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  smallSubBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallSubBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.7,
  },
  smallSubBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#475569',
  },
  smallSubBtnTextDisabled: {
    color: '#94A3B8',
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
