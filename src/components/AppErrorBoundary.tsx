import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/StateView';
import { illustratedIcons } from '@/constants/illustrated-icons';
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

    return (
      <View style={styles.fallback}>
        <StateView
          actionLabel={i18n.t('reliability.reopen')}
          body={i18n.t('reliability.appBody')}
          illustration={illustratedIcons.connectionError}
          onAction={this.retry}
          title={i18n.t('reliability.appTitle')}
          tone="error"
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
});
