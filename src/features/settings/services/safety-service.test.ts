import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safetyService } from './safety-service';

const { from, insert, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ from, rpc }),
}));

describe('safetyService.report', () => {
  beforeEach(() => {
    from.mockReset();
    insert.mockReset();
    rpc.mockReset();
    from.mockReturnValue({ insert });
  });

  it('submits structured reasons and chat context through the controlled RPC', async () => {
    rpc.mockResolvedValue({ data: 'report-id', error: null });

    await expect(
      safetyService.report('reported-id', {
        context: 'chat',
        details: 'Repeated unwanted messages',
        reasons: ['harassment', 'spam'],
        sourceMatchId: 'match-id',
      }),
    ).resolves.toEqual({ data: 'report-id', error: null });

    expect(rpc).toHaveBeenCalledWith('submit_report', {
      p_context: 'chat',
      p_details: 'Repeated unwanted messages',
      p_reasons: ['harassment', 'spam'],
      p_reported_id: 'reported-id',
      p_source_match_id: 'match-id',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to the legacy single-reason insert during a rolling migration', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    insert.mockResolvedValue({ data: null, error: null });

    await safetyService.report('reported-id', {
      context: 'profile',
      reasons: ['fake_profile', 'spam'],
    });

    expect(from).toHaveBeenCalledWith('reports');
    expect(insert).toHaveBeenCalledWith({
      details: undefined,
      reason: 'fake_profile',
      reported_id: 'reported-id',
    });
  });
});
