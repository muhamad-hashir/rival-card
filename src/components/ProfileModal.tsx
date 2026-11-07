// src/components/ProfileModal.tsx - Lightweight profile editor and stats modal
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  FONT_CARTOON_SEMIBOLD,
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

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (visible) {
      setNickname(profile.nickname);
      setSelectedAvatarId(profile.avatarId);
      setIsSaving(false);
      setIsSigningIn(false);
      setSaveStatus('idle');
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [visible, profile]);

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
        soundService.playWinChime();
        errorToastService.show({
          message: 'Signed in with Google successfully!',
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
            {/* Selected Avatar Preview & Guest Badge */}
            <View style={styles.previewSection}>
              <View style={[styles.largeAvatarCircle, { backgroundColor: activeAvatar.bgColor }]}>
                <Text style={styles.largeAvatarEmoji}>{activeAvatar.emoji}</Text>
              </View>
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeDot}>●</Text>
                <Text style={styles.guestBadgeText}>Guest Account</Text>
              </View>

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
                />
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
                  <Text style={styles.statNumber}>{profile.stats.gamesPlayed}</Text>
                  <Text style={styles.statLabel}>MATCHES</Text>
                </View>

                {/* 2. Wins */}
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, styles.statWinsNumber]}>
                    {profile.stats.wins}
                  </Text>
                  <Text style={styles.statLabel}>WINS 🏆</Text>
                </View>

                {/* 3. Win Rate */}
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, styles.statRateNumber]}>
                    {winRate}%
                  </Text>
                  <Text style={styles.statLabel}>WIN RATE</Text>
                </View>

                {/* 4. Streak */}
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, styles.statStreakNumber]}>
                    {profile.stats.winStreak}
                  </Text>
                  <Text style={styles.statLabel}>STREAK 🔥</Text>
                </View>
              </View>
            </View>

            {/* Continue with Google Authentication */}
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
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
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
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
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
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    transform: [{ scale: 1.03 }],
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
    backgroundColor: '#1E293B', // Dedicated dark navy/slate card box
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24, // Big, bold metric values (22 to 26)
    fontWeight: '900',
    color: '#FFFFFF', // Bright white
    marginBottom: 4,
  },
  statWinsNumber: {
    color: '#10B981', // Vibrant emerald
  },
  statRateNumber: {
    color: '#38BDF8', // Vibrant cyan
  },
  statStreakNumber: {
    color: '#FACC15', // Gold
  },
  statLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12, // Clear label
    fontWeight: '700',
    color: '#94A3B8', // Muted slate
    letterSpacing: 1, // Letter spacing 1
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  googleAuthBtn: {
    width: '90%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#2D1F17',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    alignSelf: 'center',
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
  saveBtn: {
    width: '90%',
    height: 48,
    backgroundColor: '#10B981', // Vibrant emerald green matching primary actions
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
