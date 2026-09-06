import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

let currentState: AppStateStatus = AppState.currentState ?? 'active';
let subscription: NativeEventSubscription | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    subscription = AppState.addEventListener('change', (nextState) => {
      if (currentState === nextState) return;
      currentState = nextState;
      listeners.forEach((notify) => notify());
    });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

const getSnapshot = () => currentState === 'active';
const getServerSnapshot = () => true;

/** 백그라운드에서는 반복 장식과 shimmer를 멈춰 CPU/GPU 사용을 줄인다. */
export function useAppActive() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
