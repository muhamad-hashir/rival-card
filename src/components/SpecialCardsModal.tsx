// src/components/SpecialCardsModal.tsx - Side-by-Side 4-Portion Special Cards Catalogue Modal
import React, { useEffect, useRef, useState } from 'react';
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
  useWindowDimensions,
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
  SPECIAL_CARDS_CATALOG,
  SPECIAL_CARDS_TOTAL,
  SpecialCardKey,
  getSpecialCardIndicatorText,
  getSpecialCardNextLabel,
} from '../services/specialCardsService';

const CARD_PREVIEW_IMAGES: Record<SpecialCardKey, any> = {
  swap: require('../../card-previews/card-swap.png'),
  mute: require('../../card-previews/card-mute.png'),
  shield: require('../../card-previews/card-shield.png'),
  mirror: require('../../card-previews/card-mirror.png'),
};

export interface SpecialCardsModalProps {
  visible: boolean;
  onClose: () => void;
  initialPage?: number;
}

export const SpecialCardsModal: React.FC<SpecialCardsModalProps> = ({
  visible,
  onClose,
  initialPage = 1,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCurrentPage(initialPage);
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [visible, initialPage, fadeAnim, slideAnim]);

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > SPECIAL_CARDS_TOTAL || newPage === currentPage) return;

    hapticsService.cardSelection();
    soundService.playCardSnap();

    const direction = newPage > currentPage ? 1 : -1;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 110,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: -20 * direction,
        duration: 110,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCurrentPage(newPage);
      slideAnim.setValue(20 * direction);
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
    if (currentPage < SPECIAL_CARDS_TOTAL) {
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

  const activeItem = SPECIAL_CARDS_CATALOG[currentPage - 1] ?? SPECIAL_CARDS_CATALOG[0];
  const isCompactWidth = screenWidth < 375;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.catalogCard}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeftGroup}>
              <Text style={styles.headerEmoji}>✨</Text>
              <Text style={styles.headerTitle}>SPECIAL CARDS</Text>
            </View>

            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>{getSpecialCardIndicatorText(currentPage)}</Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close Special Cards Catalogue"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 4-Portion Quick Selector Strip */}
          <View style={styles.portionTabsRow}>
            {SPECIAL_CARDS_CATALOG.map((item) => {
              const isSelected = item.page === currentPage;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => changePage(item.page)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.title}`}
                  testID={`special-card-tab-${item.key}`}
                  style={[
                    styles.portionTab,
                    isSelected && {
                      backgroundColor: item.accentColor,
                      borderColor: '#0F1142',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.portionTabText,
                      isSelected && styles.portionTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.emoji} {item.shortName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Main Catalogue Spread: Card Artwork on Left, Detailed Behavior on Right */}
          <Animated.View
            style={[
              styles.spreadAnimatedWrap,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.spreadRow}>
              {/* LEFT SIDE: High-Res Card Showcase */}
              <View
                style={[
                  styles.showcaseColumn,
                  {
                    width: isCompactWidth ? '39%' : '41%',
                    backgroundColor: activeItem.accentTintBg,
                    borderColor: activeItem.accentBorderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: activeItem.accentColor },
                  ]}
                >
                  <Text style={styles.categoryBadgeText} numberOfLines={1}>
                    {activeItem.categoryBadge}
                  </Text>
                </View>

                <View style={styles.cardImageFrame}>
                  <Image
                    source={CARD_PREVIEW_IMAGES[activeItem.key]}
                    style={styles.cardPreviewImage}
                    resizeMode="contain"
                    accessibilityLabel={`${activeItem.title} card preview`}
                  />
                </View>

                <Text style={styles.showcaseTitle} numberOfLines={1}>
                  {activeItem.title}
                </Text>
                <View style={styles.deckCountChip}>
                  <Text style={styles.deckCountText}>{activeItem.deckCountLabel}</Text>
                </View>
              </View>

              {/* RIGHT SIDE: Detailed Abilities & Rules */}
              <View style={styles.detailsColumn}>
                <View
                  style={[
                    styles.headlineBanner,
                    {
                      backgroundColor: activeItem.accentTintBg,
                      borderColor: activeItem.accentBorderColor,
                    },
                  ]}
                >
                  <Text style={[styles.headlineText, { color: activeItem.accentColor }]}>
                    {activeItem.headline}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={styles.detailsListContent}
                >
                  {activeItem.details.map((detail) => (
                    <View key={detail.label} style={styles.detailCard}>
                      <View style={styles.detailTitleRow}>
                        <View
                          style={[
                            styles.detailAccentDot,
                            { backgroundColor: activeItem.accentColor },
                          ]}
                        />
                        <Text style={styles.detailLabel}>{detail.label}</Text>
                      </View>
                      <Text style={styles.detailDescription}>{detail.description}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Animated.View>

          {/* Footer Navigation: Back, 4 Portion Dots, NEXT! */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentPage === 1}
              style={[styles.backBtn, currentPage === 1 && styles.btnDisabled]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Previous Special Card"
              testID="special-cards-back-btn"
            >
              <Text style={[styles.backBtnText, currentPage === 1 && styles.textDisabled]}>
                ← Back
              </Text>
            </TouchableOpacity>

            <View style={styles.dotsContainer}>
              {SPECIAL_CARDS_CATALOG.map((item) => {
                const isActive = item.page === currentPage;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => changePage(item.page)}
                    style={[
                      styles.dot,
                      isActive
                        ? [styles.dotActive, { backgroundColor: activeItem.accentColor }]
                        : styles.dotInactive,
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to ${item.title}`}
                    testID={`special-cards-dot-${item.page}`}
                  />
                );
              })}
            </View>

            <TouchableOpacity
              onPress={handleNext}
              style={[
                styles.nextBtn,
                {
                  backgroundColor:
                    currentPage === SPECIAL_CARDS_TOTAL ? '#10B981' : activeItem.accentColor,
                  borderColor: currentPage === SPECIAL_CARDS_TOTAL ? '#059669' : '#0F1142',
                },
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={getSpecialCardNextLabel(currentPage)}
              testID="special-cards-next-btn"
            >
              <Text style={styles.nextBtnText}>{getSpecialCardNextLabel(currentPage)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  catalogCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    backgroundColor: '#FEF6E9',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#0F1142',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerEmoji: {
    fontSize: 17,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F1142',
    letterSpacing: 0.5,
  },
  pagePill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2.5,
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
    color: '#334155',
    fontWeight: '900',
  },

  // 4-Portion Tabs
  portionTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  portionTab: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionTabText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10.5,
    color: '#475569',
  },
  portionTabTextActive: {
    color: '#FFFFFF',
  },

  // Split Catalogue Spread
  spreadAnimatedWrap: {
    minHeight: 310,
    maxHeight: 390,
  },
  spreadRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  showcaseColumn: {
    borderRadius: 18,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardImageFrame: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cardPreviewImage: {
    width: '100%',
    height: '100%',
    minHeight: 165,
    maxHeight: 220,
  },
  showcaseTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13.5,
    color: '#0F1142',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  deckCountChip: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deckCountText: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 10,
    color: '#475569',
  },

  // Right Details Side
  detailsColumn: {
    flex: 1,
    gap: 7,
  },
  headlineBanner: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headlineText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11.5,
    lineHeight: 15,
  },
  detailsListContent: {
    gap: 7,
    paddingBottom: 2,
  },
  detailCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  detailAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  detailLabel: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#0F1142',
  },
  detailDescription: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 14.5,
  },

  // Footer
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
    borderBottomWidth: 3,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
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
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#CBD5E1',
  },
  nextBtn: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
