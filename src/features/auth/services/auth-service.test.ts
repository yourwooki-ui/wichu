import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authService } from './auth-service';

const { signInWithOtp, verifyOtp } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('expo-auth-session', () => ({ makeRedirectUri: vi.fn(() => 'wichu://auth/callback') }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));
vi.mock('@/features/auth/utils/google-sign-up', () => ({
  readPendingGoogleSignUp: vi.fn(),
  shouldApplyPendingGoogleBirthDate: vi.fn(),
}));
vi.mock('@/lib/secure-storage', () => ({
  sensitiveStorage: { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock('@/services/notifications-service', () => ({
  notificationsService: { unregister: vi.fn() },
}));

describe('authService phone OTP', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
  });

  it('prevents account creation during phone sign-in', async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await authService.requestPhoneOtp({
      phone: '+14155550123',
      shouldCreateUser: false,
    });

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: '+14155550123',
      options: { channel: 'sms', shouldCreateUser: false },
    });
  });

  it('passes the adult-gate birth date only for a new phone account', async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await authService.requestPhoneOtp({
      birthDate: '1998-04-21',
      phone: '+821012345678',
      shouldCreateUser: true,
    });

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: '+821012345678',
      options: {
        channel: 'sms',
        data: { birth_date: '1998-04-21' },
        shouldCreateUser: true,
      },
    });
  });

  it('verifies a six-digit SMS token', async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });

    await authService.verifyPhoneOtp('+821012345678', '123456');

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+821012345678',
      token: '123456',
      type: 'sms',
    });
  });
});
