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

  it('replaces a malformed x-request-id and sets security headers', async () => {
    const res = await app.request('/health', {
      headers: { 'x-request-id': 'bad id\u0021<script>' },
    });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('malformed input', () => {
  it('malformed JSON returns 400 VALIDATION_ERROR without details', async () => {
    const res = await app.request('/public/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Dati non validi' },
    });
  });
});
