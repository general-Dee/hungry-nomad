import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// sendMetaPurchaseEvent reads META_CONVERSIONS_API_TOKEN and
// NEXT_PUBLIC_META_PIXEL_ID at module top-level, so each test that needs a
// particular env-var state must set process.env *before* the module is
// (re-)evaluated. vi.resetModules() + a fresh dynamic import gets us that,
// rather than relying on whatever state a single static import happened to
// capture at file-load time.
async function loadMetaCapi() {
  vi.resetModules();
  return import('./metaCapi');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const ORIGINAL_ENV = { ...process.env };

describe('sendMetaPurchaseEvent', () => {
  beforeEach(() => {
    delete process.env.META_CONVERSIONS_API_TOKEN;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no-ops without calling fetch when META_CONVERSIONS_API_TOKEN is unset', async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('no-ops without calling fetch when NEXT_PUBLIC_META_PIXEL_ID is unset', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a Purchase event with correctly-hashed, normalized email and phone', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await sendMetaPurchaseEvent({
      eventId: 'ref_abc',
      value: 4500,
      contentIds: ['1', '2'],
      email: '  Test@EXAMPLE.com  ',
      phone: '+234 803 555 1234',
      eventSourceUrl: 'https://hungrynomad.example/success',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v20.0/pixel_123/events');
    expect(url).not.toContain('access_token');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token_123',
    });

    const body = JSON.parse(init.body);
    expect(body.data).toHaveLength(1);
    const evt = body.data[0];
    expect(evt.event_name).toBe('Purchase');
    expect(evt.event_id).toBe('ref_abc');
    expect(evt.action_source).toBe('website');
    expect(evt.event_source_url).toBe('https://hungrynomad.example/success');
    expect(typeof evt.event_time).toBe('number');
    expect(evt.custom_data).toEqual({
      value: 4500,
      currency: 'NGN',
      content_ids: ['1', '2'],
      content_type: 'product',
    });
    // Normalization: email is trim+lowercased, phone is reduced to digits
    // only, before hashing — verify against digests computed independently
    // here rather than just asserting "some 64-char hex string".
    expect(evt.user_data.em).toEqual([sha256('test@example.com')]);
    expect(evt.user_data.ph).toEqual([sha256('2348035551234')]);
  });

  it('omits em/ph from user_data when email/phone are not provided', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data[0].user_data).toEqual({});
    expect(body.data[0].event_source_url).toBeUndefined();
  });

  it('includes only em when phone is absent, and only ph when email is absent', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'], email: 'a@b.com' });
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data[0].user_data).toEqual({ em: [sha256('a@b.com')] });

    fetchMock.mockClear();
    await sendMetaPurchaseEvent({ eventId: 'ref_2', value: 1000, contentIds: ['1'], phone: '08012345678' });
    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data[0].user_data).toEqual({ ph: [sha256('08012345678')] });
  });

  it('does not throw when the fetch call rejects (e.g. network failure)', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await expect(
      sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('aborts and does not throw when the request hangs past the timeout', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: { signal: AbortSignal }) => {
      // Mimics a real fetch: never resolves on its own, but rejects once the
      // AbortController's signal fires — the same behavior sendMetaPurchaseEvent
      // relies on to bound a hung request.
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    const promise = sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] });
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Meta Conversions API error:',
      expect.objectContaining({ name: 'AbortError' })
    );

    vi.useRealTimers();
  });

  it('does not throw when Meta responds with a non-ok status', async () => {
    process.env.META_CONVERSIONS_API_TOKEN = 'token_123';
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel_123';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Invalid parameter'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMetaPurchaseEvent } = await loadMetaCapi();

    await expect(
      sendMetaPurchaseEvent({ eventId: 'ref_1', value: 1000, contentIds: ['1'] })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Meta Conversions API request failed',
      expect.objectContaining({ status: 400 })
    );
  });
});
