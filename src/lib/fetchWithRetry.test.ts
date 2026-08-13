import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from './fetchWithRetry';

// Generic retry-with-timeout helper backing every resilience fix in this
// changeset (delivery zones, products lookup, order lookup). These tests
// pin down the four behaviors every caller relies on: no wasted retries on
// first-try success, recovery after a transient failure, giving up (and
// surfacing the *last* error) once attempts are exhausted, and actually
// aborting a hung attempt via the signal rather than waiting forever.

describe('withRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves on the first attempt without calling fn again', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { attempts: 3, timeoutMs: 1000, backoffMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recovers on a later attempt after earlier ones throw', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { attempts: 3, timeoutMs: 1000, backoffMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once all attempts are exhausted', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('final failure'));

    await expect(withRetry(fn, { attempts: 3, timeoutMs: 1000, backoffMs: 1 })).rejects.toThrow(
      'final failure'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('aborts an attempt that never resolves once the timeout elapses', async () => {
    // fn never settles on its own — it only rejects if/when its signal is
    // aborted. If withRetry didn't actually wire the timeout to the signal,
    // this attempt (and the whole call) would hang forever and the test
    // would time out.
    const fn = vi.fn((signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    await expect(withRetry(fn, { attempts: 1, timeoutMs: 20, backoffMs: 1 })).rejects.toThrow(
      'aborted'
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes an already-aborted signal to a retried attempt only after its own timeout fires, not before', async () => {
    // Sanity check that each attempt gets its own fresh (non-pre-aborted)
    // controller/signal.
    const signals: boolean[] = [];
    const fn = vi.fn((signal: AbortSignal) => {
      signals.push(signal.aborted);
      return Promise.reject(new Error('fail'));
    });

    await expect(withRetry(fn, { attempts: 2, timeoutMs: 1000, backoffMs: 1 })).rejects.toThrow(
      'fail'
    );
    expect(signals).toEqual([false, false]);
  });
});
