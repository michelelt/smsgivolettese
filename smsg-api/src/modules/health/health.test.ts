import { describe, expect, it } from 'vitest';
import { app } from '../../app.js';

describe('health', () => {
  it('GET /health returns ok and echoes x-request-id', async () => {
    const res = await app.request('/health', { headers: { 'x-request-id': 'abc' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('x-request-id')).toBe('abc');
  });

  it('unknown route returns the Italian error envelope', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Risorsa non trovata' },
    });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});
