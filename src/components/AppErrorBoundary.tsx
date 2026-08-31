import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, pressFeedback, radius } from '@/constants/theme';
import { reportOperationalError } from '@/services/operational-error-service';
import i18n from '@/i18n';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportOperationalError(info.componentStack ? 'render' : 'unknown', error);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;

    const title = safeTranslation('reliability.appTitle', '앱을 다시 불러올게요');
    const body = safeTranslation(
      'reliability.appBody',
      '일시적인 문제가 생겼어요. 다시 시도해 주세요.',
    );
    const action = safeTranslation('reliability.reopen', '다시 시도');

    return (
      <View accessibilityRole="alert" style={styles.fallback}>
        <Text style={styles.brand}>WICHU</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.retry}
          style={({ pressed }) => [styles.action, pressed && pressFeedback.control]}
        >
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      </View>
    );
  }
}

function safeTranslation(key: string, fallback: string) {
  try {
    const translated = i18n.t(key);
    return typeof translated === 'string' && translated !== key ? translated : fallback;
  } catch {
    return fallback;
  }
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  actionText: { color: palette.white, fontSize: 14, fontWeight: '900' },
  body: {
    color: palette.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  brand: { color: palette.pink, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  fallback: {
    alignItems: 'center',
    backgroundColor: palette.white,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 12,
    textAlign: 'center',
  },
});
