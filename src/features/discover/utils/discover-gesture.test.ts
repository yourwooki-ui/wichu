import { describe, expect, it } from 'vitest';

import { resolveDiscoverSwipe } from './discover-gesture';

describe('discover swipe resolution', () => {
  it('commits deliberate distance-based decisions', () => {
    expect(resolveDiscoverSwipe(97, 0)).toBe('like');
    expect(resolveDiscoverSwipe(-97, 0)).toBe('pass');
  });

  it('requires minimum travel before velocity can commit', () => {
    expect(resolveDiscoverSwipe(29, 651)).toBe('like');
    expect(resolveDiscoverSwipe(-29, -651)).toBe('pass');
    expect(resolveDiscoverSwipe(12, 900)).toBeNull();
  });

  it('returns to rest for an undecided gesture', () => {
    expect(resolveDiscoverSwipe(50, 300)).toBeNull();
    expect(resolveDiscoverSwipe(-50, -300)).toBeNull();
  });
});
