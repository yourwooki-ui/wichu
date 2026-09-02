import { beforeEach, describe, expect, it, vi } from 'vitest';

import { matchesService } from './matches-service';

const { createSignedPhotoUrls, rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createSignedPhotoUrls: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc }),
}));

vi.mock('@/features/profile/services/profile-photo-service', () => ({
  profilePhotoService: { createSignedPhotoUrls },
}));

const singleConnection = {
  country_code: 'JP',
  display_name: 'Yuna',
  last_active_at: '2026-09-01T12:00:00.000Z',
  match_id: '10000000-0000-4000-8000-000000000001',
  matched_at: '2026-09-01T11:00:00.000Z',
  photo_path: 'profiles/yuna/main.jpg',
  profile_id: '20000000-0000-4000-8000-000000000001',
};

describe('matchesService.getConnection', () => {
  beforeEach(() => {
    rpc.mockReset();
    createSignedPhotoUrls.mockReset();
    createSignedPhotoUrls.mockResolvedValue({
      data: [{ path: singleConnection.photo_path, signedUrl: 'https://signed.example/yuna' }],
      error: null,
    });
  });

  it('loads only the requested match and signs its approved profile photo', async () => {
    const maybeSingle = vi.fn(async () => ({ data: singleConnection, error: null }));
    rpc.mockReturnValue({ maybeSingle });

    await expect(matchesService.getConnection(singleConnection.match_id)).resolves.toMatchObject({
      matchId: singleConnection.match_id,
      profile: {
        display_name: 'Yuna',
        photo: 'https://signed.example/yuna',
      },
    });
    expect(rpc).toHaveBeenCalledWith('get_my_match_connection', {
      p_match_id: singleConnection.match_id,
    });
    expect(createSignedPhotoUrls).toHaveBeenCalledWith([singleConnection.photo_path], 3600);
  });

  it('uses the existing list read model during a rolling database deployment', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'get_my_match_connection') {
        return { maybeSingle: async () => ({ data: null, error: { code: 'PGRST202' } }) };
      }
      return Promise.resolve({
        data: [
          {
            ...singleConnection,
            age: 24,
            last_message_content: null,
            last_message_created_at: null,
            last_message_sender_id: null,
            unread_count: 0,
          },
        ],
        error: null,
      });
    });

    await expect(matchesService.getConnection(singleConnection.match_id)).resolves.toMatchObject({
      matchId: singleConnection.match_id,
      profile: { display_name: 'Yuna' },
    });
    expect(rpc).toHaveBeenCalledWith('get_my_match_connections', { p_limit: 100 });
  });
});
