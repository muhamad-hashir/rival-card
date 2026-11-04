// src/components/ProfileModal.tsx - Lightweight profile editor and stats modal
import React, { useState, useEffect, useRef } from 'react';
import {
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (visible) {
      setNickname(profile.nickname);
      setSelectedAvatarId(profile.avatarId);
      setIsSaving(false);
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
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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
                  <Text style={styles.levelBadgeText}>⭐ Level {profile.level ?? 1}</Text>
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

            {/* Streamlined Career Stats Grid */}
            <View style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>CAREER STATS</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{profile.stats.gamesPlayed}</Text>
                  <Text style={styles.statLabel}>Matches</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, styles.statWinsNumber]}>{profile.stats.wins}</Text>
                  <Text style={styles.statLabel}>Wins 🏆</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{winRate}%</Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, styles.statStreakNumber]}>{profile.stats.winStreak}</Text>
                  <Text style={styles.statLabel}>Streak 🔥</Text>
                </View>
              </View>
            </View>

            {/* Link Account Placeholder Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.linkAccountBtn}
              onPress={() => {
                hapticsService.cardSnap();
              }}
            >
              <Text style={styles.linkAccountIcon}>☁️</Text>
              <Text style={styles.linkAccountText}>Link Account</Text>
              <View style={styles.comingSoonPill}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
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
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
    borderRadius: 24,
    padding: 20,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
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
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelBadge: {
    backgroundColor: '#FEF6E9',
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#0F172A',
  },
  levelXpText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#15803D',
  },
  xpTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statsCardTitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  statNumber: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
  },
  statWinsNumber: {
    color: '#D97706',
  },
  statStreakNumber: {
    color: '#EA580C',
  },
  statLabel: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  linkAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
    marginVertical: 4,
    width: '100%',
  },
  linkAccountIcon: {
    fontSize: 12,
  },
  linkAccountText: {
    ...FONT_CARTOON_BOLD,
    color: '#4F46E5',
    fontSize: 12,
  },
  comingSoonPill: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  comingSoonText: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 9,
    color: '#4338CA',
  },
  saveBtn: {
    width: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
