import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { productAnalyticsService } from '@/services/product-analytics-service';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    productAnalyticsService.track('app_error', {
      error_name: error.name || 'Error',
      surface: info.componentStack ? 'render' : 'unknown',
    });
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.fallback}>
        <StateView
          actionLabel="다시 열기"
          body="입력한 내용은 가능한 한 그대로 유지됩니다. 같은 문제가 반복되면 설정의 문의하기로 알려주세요."
          illustration={illustratedIcons.connectionError}
          onAction={this.retry}
          title="화면을 여는 중 문제가 생겼어요"
          tone="error"
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
});
