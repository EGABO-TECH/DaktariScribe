import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/encounters/[id]/export/route';
import { NextRequest } from 'next/server';

describe('Server-side API Export Gate (TASK-1.1)', () => {
  it('blocks export via API with 403 when status is NEEDS_REVIEW', async () => {
    const req = new NextRequest('http://localhost:3000/api/encounters/DS-101/export', {
      method: 'POST',
      body: JSON.stringify({
        status: 'NEEDS_REVIEW',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: 'DS-101' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Cannot export unreviewed note');
  });

  it('blocks export via API with 403 when status is DRAFT', async () => {
    const req = new NextRequest('http://localhost:3000/api/encounters/DS-102/export', {
      method: 'POST',
      body: JSON.stringify({
        status: 'DRAFT',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: 'DS-102' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('allows export via API with 200 when note has been REVIEWED', async () => {
    const req = new NextRequest('http://localhost:3000/api/encounters/DS-103/export', {
      method: 'POST',
      body: JSON.stringify({
        status: 'REVIEWED',
        reviewMetadata: {
          reviewedBy: 'Dr. Aaron Egabo',
          reviewedAt: new Date().toISOString(),
          clinicianAttestation: true,
        },
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: 'DS-103' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('EXPORTED');
  });
});
