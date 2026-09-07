import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCardTapController } from './card-tap-controller';

describe('card tap arbitration', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens a single tap only after the double-tap window', () => {
    const controller = createCardTapController(260);
    const single = vi.fn();
    controller.tap(single, vi.fn());
    vi.advanceTimersByTime(259);
    expect(single).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(single).toHaveBeenCalledOnce();
  });

  it('double tap picks once and never opens the profile', () => {
    const controller = createCardTapController(260);
    const single = vi.fn();
    const double = vi.fn();
    controller.tap(single, double);
    vi.advanceTimersByTime(120);
    controller.tap(single, double);
    vi.runAllTimers();
    expect(double).toHaveBeenCalledOnce();
    expect(single).not.toHaveBeenCalled();
  });

  it.each(['swipe', 'button decision', 'profile replacement', 'unmount'])(
    'cancels stale navigation after %s',
    () => {
      const controller = createCardTapController(260);
      const single = vi.fn();
      controller.tap(single, vi.fn());
      controller.cancel();
      controller.cancel();
      vi.runAllTimers();
      expect(single).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('a tap on the next profile does not complete the previous double tap', () => {
    const controller = createCardTapController(260);
    const oldSingle = vi.fn();
    const newSingle = vi.fn();
    const double = vi.fn();
    controller.tap(oldSingle, double);
    vi.advanceTimersByTime(90);
    controller.cancel();
    controller.tap(newSingle, double);
    vi.runAllTimers();
    expect(oldSingle).not.toHaveBeenCalled();
    expect(double).not.toHaveBeenCalled();
    expect(newSingle).toHaveBeenCalledOnce();
  });
});
