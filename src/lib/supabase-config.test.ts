import { describe, expect, it } from 'vitest';

import { validateSupabaseConfiguration } from './supabase-config';

function legacyJwt(role: string) {
  const encode = (value: string) =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode('{"alg":"HS256","typ":"JWT"}')}.${encode(JSON.stringify({ role }))}.sig`;
}

describe('validateSupabaseConfiguration', () => {
  it('accepts hosted HTTPS with a publishable key', () => {
    expect(
      validateSupabaseConfiguration('https://example.supabase.co/', 'sb_publishable_example'),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('allows HTTP only for local development', () => {
    expect(validateSupabaseConfiguration('http://127.0.0.1:54321', 'local-anon')).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'local-anon',
    });
    expect(() =>
      validateSupabaseConfiguration('http://example.supabase.co', 'sb_publishable_example'),
    ).toThrow('HTTPS');
  });

  it('rejects new secret keys in public configuration', () => {
    expect(() =>
      validateSupabaseConfiguration('https://example.supabase.co', 'sb_secret_example'),
    ).toThrow('서버 전용');
  });

  it('rejects legacy service-role JWTs in public configuration', () => {
    expect(() =>
      validateSupabaseConfiguration('https://example.supabase.co', legacyJwt('service_role')),
    ).toThrow('서버 전용');
  });

  it('accepts legacy anon JWTs', () => {
    expect(
      validateSupabaseConfiguration('https://example.supabase.co', legacyJwt('anon'))
        .publishableKey,
    ).toBe(legacyJwt('anon'));
  });
});
