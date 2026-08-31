import { describe, expect, it } from 'vitest';

import { getProfileDetailAction, resolveProfileContext } from './profile-detail-context';

describe('profile detail context', () => {
  it('keeps discovery actions for discovery, visitors, and incoming Picks', () => {
    expect(getProfileDetailAction('discover')).toBe('decision');
    expect(getProfileDetailAction('visitor')).toBe('decision');
    expect(getProfileDetailAction('incoming-like')).toBe('decision');
  });

  it('shows chat instead of swipe actions for an existing connection', () => {
    expect(getProfileDetailAction('matched', 'match-1')).toBe('chat');
    expect(getProfileDetailAction('chat', 'match-1')).toBe('chat');
  });

  it('never falls back to swipe actions when a connected route has no match id', () => {
    expect(getProfileDetailAction('matched')).toBe('none');
    expect(getProfileDetailAction('chat')).toBe('none');
  });

  it('treats unknown or missing contexts as discovery for old links', () => {
    expect(resolveProfileContext()).toBe('discover');
    expect(resolveProfileContext('unknown')).toBe('discover');
  });
});
