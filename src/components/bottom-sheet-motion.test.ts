import { describe, expect, it } from 'vitest';

import { resolveBottomSheetSnap } from './bottom-sheet-motion';

describe('bottom sheet snap behavior', () => {
  const collapsedOffset = 200;

  it('expands after a short drag or upward flick', () => {
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 70, velocityY: 0 })).toBe(
      'expanded',
    );
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 150, velocityY: -500 })).toBe(
      'expanded',
    );
  });

  it('collapses after a deliberate downward drag', () => {
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 130, velocityY: 120 })).toBe(
      'collapsed',
    );
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 40, velocityY: 450 })).toBe(
      'collapsed',
    );
  });

  it('closes only after a long drag or fast downward flick', () => {
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 330, velocityY: 100 })).toBe(
      'closed',
    );
    expect(resolveBottomSheetSnap({ collapsedOffset, position: 20, velocityY: 1_300 })).toBe(
      'closed',
    );
  });
});
