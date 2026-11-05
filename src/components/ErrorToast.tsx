// src/components/ErrorToast.tsx - Cartoon Styled Global Error & Network Disconnection Toast
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorToastService, ToastPayload } from '../services/errorToastService';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';
import { hapticsService } from '../services/hapticsService';

export const ErrorToast: React.FC = () => {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = errorToastService.subscribe((currentToast) => {
      if (currentToast) {
        setToast(currentToast);
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast(null);
        });
      }
    });

    return () => unsubscribe();
  }, [slideAnim, opacityAnim]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  const handleDismiss = () => {
    hapticsService.cardSelection();
    errorToastService.hide();
  };

  const handleAction = () => {
    if (toast.action) {
      hapticsService.cardSnap();
      toast.action.onPress();
      errorToastService.hide();
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.toastContainer,
          isError && styles.errorContainer,
          isWarning && styles.warningContainer,
        ]}
      >
        <View style={styles.contentRow}>
          {/* Status Icon */}
          <Text style={styles.statusIcon}>
            {isError ? '🚨' : isWarning ? '⚠️' : 'ℹ️'}
          </Text>

          {/* Message Text */}
          <View style={styles.messageContainer}>
            <Text
              style={[
                styles.messageText,
                isError && styles.errorText,
                isWarning && styles.warningText,
              ]}
              numberOfLines={3}
            >
              {toast.message}
            </Text>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDismiss}
            style={styles.dismissBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.dismissText,
                isError && styles.errorDismissText,
                isWarning && styles.warningDismissText,
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Button (e.g. Return to Main Menu) */}
        {Boolean(toast.action) && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAction}
            style={[
              styles.actionBtn,
              isError ? styles.errorActionBtn : styles.warningActionBtn,
            ]}
          >
            <Text style={styles.actionBtnText}>{toast.action?.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: Platform.select({ ios: 48, android: 36, default: 20 }),
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 2.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
  warningContainer: {
    backgroundColor: '#FEF3C7', // Warm amber
    borderColor: '#D97706',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2', // Soft red
    borderColor: '#DC2626',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  messageContainer: {
    flex: 1,
    marginRight: 8,
  },
  messageText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    color: '#92400E',
  },
  errorText: {
    color: '#991B1B',
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  dismissText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
  },
  warningDismissText: {
    color: '#92400E',
  },
  errorDismissText: {
    color: '#991B1B',
  },
  actionBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderBottomWidth: 3,
  },
  warningActionBtn: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  errorActionBtn: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  actionBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
