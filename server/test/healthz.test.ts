import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFrank, type RunningFrank } from './helpers.js';

describe('GET /healthz (ADR-001)', () => {
  let frank: RunningFrank;
  beforeAll(async () => {
    frank = await startFrank();
  });
  afterAll(() => frank.close());

  it('returns 200 with status ok', async () => {
    const res = await fetch(`${frank.baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string; uptimeSeconds: number };
    expect(body.status).toBe('ok');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('explains that the console is not built yet at /', async () => {
    const res = await fetch(`${frank.baseUrl}/`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('ADR-003');
  });
});
