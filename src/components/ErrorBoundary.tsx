// src/components/ErrorBoundary.tsx - Playful Global Error Boundary for Rival Card
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[RivalCard ErrorBoundary] Uncaught runtime exception caught:', error, errorInfo);
  }

  handleRestart = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleRestart);
      }

      return (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <View style={styles.card}>
              {/* Playful Icon */}
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>🃏</Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>OOPS! SOMETHING WENT WRONG</Text>

              {/* Subtitle */}
              <Text style={styles.subtitle}>
                The cards got a little tangled up. Don&apos;t worry, your progress and inventory are safe!
              </Text>

              {/* Collapsed/Formatted Error Message */}
              {this.state.error?.message ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText} numberOfLines={3}>
                    {this.state.error.message}
                  </Text>
                </View>
              ) : null}

              {/* Restart Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.restartButton}
                onPress={this.handleRestart}
              >
                <Text style={styles.restartButtonText}>Restart Game ➔</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF7',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    borderWidth: 3,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontFamily: Platform.select({
      web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_700Bold',
    }),
    fontWeight: '800',
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: Platform.select({
      web: '"Fredoka_500Medium", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_500Medium',
    }),
    fontWeight: '500',
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    fontFamily: Platform.select({
      web: 'monospace, system-ui',
      default: 'monospace',
    }),
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
  },
  restartButton: {
    width: '100%',
    backgroundColor: '#22C55E',
    borderBottomWidth: 4,
    borderBottomColor: '#15803D',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  restartButtonText: {
    fontFamily: Platform.select({
      web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_700Bold',
    }),
    fontWeight: '800',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
