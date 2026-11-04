// src/components/HowToPlayModal.tsx - Interactive Book-Style Rulebook Modal for Rival Card
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  RULEBOOK_TOTAL_PAGES,
  getPageIndicatorText,
  getNextButtonLabel,
  clampRulebookPage,
} from '../services/rulebookService';

export {
  RULEBOOK_TOTAL_PAGES,
  getPageIndicatorText,
  getNextButtonLabel,
  clampRulebookPage,
};

const ICON_SKIP = require('../../assets/icons/icon_skip.png');
const ICON_REVERSE = require('../../assets/icons/icon_reverse.png');
const ICON_DRAW2 = require('../../assets/icons/icon_draw2.png');
const ICON_WILD = require('../../assets/icons/icon_wild_color_change.png');
const ICON_WILD_4 = require('../../assets/icons/icon_wild_4.png');
const ICON_MUTE = require('../../assets/icons/icon_mute.png');
const ICON_SWAP = require('../../assets/icons/icon_swap.png');

export interface HowToPlayModalProps {
  visible: boolean;
  onClose: () => void;
  initialPage?: number;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  visible,
  onClose,
  initialPage = 1,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Reset to initial page when opened
  useEffect(() => {
    if (visible) {
      setCurrentPage(initialPage);
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [visible, initialPage]);

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > RULEBOOK_TOTAL_PAGES || newPage === currentPage) return;

    hapticsService.cardSelection();
    soundService.playCardSnap();

    const direction = newPage > currentPage ? 1 : -1;

    // Slide and fade out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: -24 * direction,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCurrentPage(newPage);
      slideAnim.setValue(24 * direction);
      // Slide and fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentPage < RULEBOOK_TOTAL_PAGES) {
      changePage(currentPage + 1);
    } else {
      hapticsService.cardSnap();
      soundService.playCardSnap();
      onClose();
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      changePage(currentPage - 1);
    }
  };

  const handleClose = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onClose();
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
        <View style={styles.bookCard}>
          {/* Subtle Decorative Book Ribbon / Bookmark */}
          <View style={styles.bookRibbon} pointerEvents="none" />

          {/* Book Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeftGroup}>
              <Text style={styles.bookIcon}>📖</Text>
              <Text style={styles.headerTitle}>RIVAL RULEBOOK</Text>
            </View>

            {/* Page Indicator Pill */}
            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>{getPageIndicatorText(currentPage)}</Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close Rulebook"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Spine Binding Crease Accent */}
          <View style={styles.spineCrease} />

          {/* Paginated Content Area with Animated Slide & Fade */}
          <Animated.View
            style={[
              styles.pageContentWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {currentPage === 1 && <PageOneBasics />}
              {currentPage === 2 && <PageTwoActionCards />}
              {currentPage === 3 && <PageThreeWildCards />}
              {currentPage === 4 && <PageFourRivalShout />}
            </ScrollView>
          </Animated.View>

          {/* Interactive Navigation Footer */}
          <View style={styles.footerRow}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentPage === 1}
              style={[
                styles.backBtn,
                currentPage === 1 && styles.btnDisabled,
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Previous Page"
              testID="rulebook-back-btn"
            >
              <Text style={[styles.backBtnText, currentPage === 1 && styles.textDisabled]}>
                ← Back
              </Text>
            </TouchableOpacity>

            {/* Dot Pagination Indicators */}
            <View style={styles.dotsContainer}>
              {[1, 2, 3, 4].map((page) => {
                const isActive = page === currentPage;
                return (
                  <TouchableOpacity
                    key={page}
                    onPress={() => changePage(page)}
                    style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to Page ${page}`}
                    testID={`rulebook-dot-${page}`}
                  />
                );
              })}
            </View>

            {/* Next / Got It Button */}
            <TouchableOpacity
              onPress={handleNext}
              style={styles.nextBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={getNextButtonLabel(currentPage)}
              testID="rulebook-next-btn"
            >
              <Text style={styles.nextBtnText}>{getNextButtonLabel(currentPage)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- PAGE 1: Objective & Turn Basics ---
const PageOneBasics: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={styles.chapterBadge}>
        <Text style={styles.chapterBadgeText}>🎯 CHAPTER 1 • OBJECTIVE & BASICS</Text>
      </View>

      {/* Rule 1: Core Goal */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🏆</Text>
          <Text style={styles.ruleTitle}>Core Objective</Text>
        </View>
        <Text style={styles.ruleBody}>
          Be the first player to <Text style={styles.textHighlightGreen}>empty your hand</Text> of
          all cards to win the match!
        </Text>
      </View>

      {/* Rule 2: Matching Rule */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🎨</Text>
          <Text style={styles.ruleTitle}>Matching Rule</Text>
        </View>
        <Text style={styles.ruleBody}>
          On your turn, play a card matching the discard pile card by:
        </Text>
        <View style={styles.matchPillsRow}>
          <View style={[styles.miniBadge, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.miniBadgeText}>Color</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#2563EB' }]}>
            <Text style={styles.miniBadgeText}>0–9</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.miniBadgeText}>Symbol</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#1E293B' }]}>
            <Text style={styles.miniBadgeText}>Wilds</Text>
          </View>
        </View>
      </View>

      {/* Rule 3: Draw Rule */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🃏</Text>
          <Text style={styles.ruleTitle}>Draw & Pass</Text>
        </View>
        <Text style={styles.ruleBody}>
          No match in hand? Tap the draw pile to draw <Text style={styles.textHighlightDark}>1 card</Text>.
          If the drawn card matches, you may play it immediately!
        </Text>
      </View>
    </View>
  );
};

// --- PAGE 2: Action Cards ---
const PageTwoActionCards: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={[styles.chapterBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#1D4ED8' }]}>
          ⚡ CHAPTER 2 • ACTION CARDS
        </Text>
      </View>

      {/* Action 1: Skip */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#3B82F6' }]}>
            <Image source={ICON_SKIP} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Skip (⊘)</Text>
            <Text style={styles.ruleBodySmall}>
              Skips the next player's turn in rotation.
            </Text>
            <View style={styles.proTipBadge}>
              <Text style={styles.proTipText}>⚡ 1v1 Rule: Lets you play again immediately!</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action 2: Reverse */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#F59E0B' }]}>
            <Image source={ICON_REVERSE} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Reverse (⇄)</Text>
            <Text style={styles.ruleBodySmall}>
              Reverses turn direction (clockwise ↔ counter-clockwise).
            </Text>
            <View style={styles.proTipBadge}>
              <Text style={styles.proTipText}>⚡ 1v1 Rule: Functions like a Skip for a free turn!</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action 3: Draw 2 */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#10B981' }]}>
            <Image source={ICON_DRAW2} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Draw Two (+2)</Text>
            <Text style={styles.ruleBodySmall}>
              Forces next player to draw 2 cards and forfeit their turn.
            </Text>
            <View style={styles.proTipBadge}>
              <Text style={styles.proTipText}>⚡ 1v1 Rule: Opponent draws 2 and turn returns to you!</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// --- PAGE 3: Wild Cards & Color Picking ---
const PageThreeWildCards: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={[styles.chapterBadge, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#7E22CE' }]}>
          🌈 CHAPTER 3 • WILDS & SPECIALS
        </Text>
      </View>

      {/* Wild 1: Wild Card */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#1E293B' }]}>
            <Image source={ICON_WILD} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Wild Card</Text>
            <Text style={styles.ruleBodySmall}>
              Can be played on <Text style={styles.textHighlightDark}>any card</Text>. Pick the active
              color for the next turn:
            </Text>
            <View style={styles.colorPillRow}>
              <View style={[styles.colorDot, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.colorDot, { backgroundColor: '#3B82F6' }]} />
              <View style={[styles.colorDot, { backgroundColor: '#22C55E' }]} />
              <View style={[styles.colorDot, { backgroundColor: '#FACC15' }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Wild 2: Wild Draw 4 */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#0F172A' }]}>
            <Image source={ICON_WILD_4} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Wild Draw 4 (+4)</Text>
            <Text style={styles.ruleBodySmall}>
              Ultimate strike! Changes the active color AND forces the next player to draw 4 cards
              + skip their turn!
            </Text>
          </View>
        </View>
      </View>

      {/* Special Rival Cards: Mute & Swap */}
      <View style={styles.ruleCard}>
        <Text style={[styles.ruleTitle, { fontSize: 13, marginBottom: 6 }]}>
          ✨ Rival Special Cards
        </Text>
        <View style={styles.specialCardRow}>
          <View style={styles.specialCardItem}>
            <Image source={ICON_MUTE} style={styles.specialIconImage} resizeMode="contain" />
            <Text style={styles.specialCardLabel}>
              <Text style={styles.textHighlightDark}>Mute:</Text> Silences an opponent, skipping their turn.
            </Text>
          </View>
          <View style={styles.specialCardItem}>
            <Image source={ICON_SWAP} style={styles.specialIconImage} resizeMode="contain" />
            <Text style={styles.specialCardLabel}>
              <Text style={styles.textHighlightDark}>Swap:</Text> Trades hand with player having fewest cards!
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// --- PAGE 4: The "RIVAL!" Shout & Penalties ---
const PageFourRivalShout: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={[styles.chapterBadge, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#DC2626' }]}>
          📣 CHAPTER 4 • RIVAL! CALL & REWARDS
        </Text>
      </View>

      {/* Shout 1: Call Rival */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>📣</Text>
          <Text style={styles.ruleTitle}>The 'RIVAL!' Call</Text>
        </View>
        <Text style={styles.ruleBody}>
          When you play down to <Text style={styles.textHighlightDark}>exactly 1 card</Text>, you MUST
          tap the <Text style={styles.textHighlightGreen}>'RIVAL!'</Text> shout button to alert all
          opponents!
        </Text>
      </View>

      {/* Shout 2: Catch Penalty */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🚨</Text>
          <Text style={styles.ruleTitle}>'CATCH RIVAL!' Penalty</Text>
        </View>
        <Text style={styles.ruleBody}>
          Forgot to call Rival? Opponents have a <Text style={styles.textHighlightDark}>2.5-second</Text> high-stakes window to tap <Text style={styles.textHighlightRed}>'CATCH RIVAL!'</Text> and force you to draw <Text style={styles.textHighlightRed}>+2 penalty cards</Text>!
        </Text>
      </View>

      {/* Shout 3: XP & Economy */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🏆</Text>
          <Text style={styles.ruleTitle}>Progression & Economy</Text>
        </View>
        <Text style={styles.ruleBody}>
          Complete matches to earn <Text style={styles.textHighlightGreen}>XP & Coins</Text> (+120 XP & +60 Coins on victory!). Level up to earn <Text style={styles.textHighlightGold}>+100 Coins & +5 Gems</Text>!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  bookCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9', // Warm cream/parchment surface matching design system
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  bookRibbon: {
    position: 'absolute',
    top: 0,
    left: 28,
    width: 14,
    height: 18,
    backgroundColor: '#EF4444',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E2D9C8',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookIcon: {
    fontSize: 18,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  pagePill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pagePillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#92400E',
    letterSpacing: 0.6,
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
  spineCrease: {
    height: 1,
    backgroundColor: 'rgba(226, 217, 200, 0.6)',
    marginBottom: 10,
  },
  pageContentWrapper: {
    minHeight: 330,
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  pageContainer: {
    gap: 10,
  },
  chapterBadge: {
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 2,
  },
  chapterBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  ruleCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 11,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ruleIconEmoji: {
    fontSize: 16,
  },
  ruleTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  ruleBody: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  ruleBodySmall: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
  },
  textHighlightGreen: {
    ...FONT_CARTOON_BOLD,
    color: '#16A34A',
  },
  textHighlightDark: {
    ...FONT_CARTOON_BOLD,
    color: '#0F172A',
  },
  textHighlightRed: {
    ...FONT_CARTOON_BOLD,
    color: '#DC2626',
  },
  textHighlightGold: {
    ...FONT_CARTOON_BOLD,
    color: '#D97706',
  },
  matchPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  miniBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#FFFFFF',
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  actionIconImage: {
    width: 28,
    height: 28,
  },
  actionInfoCol: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  proTipBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  proTipText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#92400E',
  },
  colorPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  specialCardRow: {
    gap: 6,
  },
  specialCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specialIconImage: {
    width: 20,
    height: 20,
  },
  specialCardLabel: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E2D9C8',
  },
  backBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#475569',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  textDisabled: {
    color: '#94A3B8',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
    height: 8,
    backgroundColor: '#22C55E',
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#CBD5E1',
  },
  nextBtn: {
    backgroundColor: '#22C55E',
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  nextBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
