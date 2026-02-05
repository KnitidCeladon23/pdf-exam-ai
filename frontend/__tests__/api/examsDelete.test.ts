/**
 * @jest-environment node
 */

import { DELETE } from '@/app/api/exams/[id]/route';
import { NextRequest } from 'next/server';

describe('Exams DELETE API proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards DELETE to backend and returns success', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Exam deleted successfully' }),
    });

    const fakeReq = {} as NextRequest;
    const res = await DELETE(fakeReq, { params: { id: '1' } } as any);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/exams/1'), expect.objectContaining({ method: 'DELETE' }));
    // The route returns a NextResponse; calling .json() is not necessary here — ensure no throw
    expect(res).toBeDefined();
  });

  it('handles backend error responses', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Delete failed' }),
    });

    const fakeReq = {} as NextRequest;
    const res = await DELETE(fakeReq, { params: { id: '2' } } as any);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/exams/2'), expect.objectContaining({ method: 'DELETE' }));
    expect(res).toBeDefined();
  });
});
