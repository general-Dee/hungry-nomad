import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// STAFF_EMAIL/STAFF_EMAILS (and FROM_EMAIL) are derived from process.env
// once at module load time in src/lib/email.ts, so each test that needs a
// different STAFF_EMAIL value sets process.env first, resets the module
// registry, then dynamically re-imports the module fresh so those
// module-level consts are recomputed from the new env.

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email_1' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const order = {
  id: 1,
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '08000000000',
  customer_address: '1 Main St',
  delivery_lga: 'Ikeja',
  total_amount: 5000,
};
const items = [{ product_name: 'Jollof Rice', quantity: 2, price_at_time: 1500 }];

const ORIGINAL_ENV = process.env;

describe('sendStaffOrderAlertEmail recipient parsing', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: 'test-resend-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends to every address in a comma-separated STAFF_EMAIL list', async () => {
    process.env.STAFF_EMAIL = 'staff-a@example.com,staff-b@example.com';
    const { sendStaffOrderAlertEmail } = await import('./email');

    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toEqual(['staff-a@example.com', 'staff-b@example.com']);
  });

  it('trims whitespace around comma-separated addresses', async () => {
    process.env.STAFF_EMAIL = ' staff-a@example.com ,  staff-b@example.com ';
    const { sendStaffOrderAlertEmail } = await import('./email');

    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend.mock.calls[0][0].to).toEqual(['staff-a@example.com', 'staff-b@example.com']);
  });

  it('still works with a single address, for backward compatibility', async () => {
    process.env.STAFF_EMAIL = 'single@example.com';
    const { sendStaffOrderAlertEmail } = await import('./email');

    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toEqual(['single@example.com']);
  });

  it('skips sending and warns when STAFF_EMAIL is unset', async () => {
    delete process.env.STAFF_EMAIL;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendStaffOrderAlertEmail } = await import('./email');
    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips sending when STAFF_EMAIL is set but empty', async () => {
    process.env.STAFF_EMAIL = '';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendStaffOrderAlertEmail } = await import('./email');
    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips sending when STAFF_EMAIL contains only commas/whitespace', async () => {
    process.env.STAFF_EMAIL = ' , , ';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendStaffOrderAlertEmail } = await import('./email');
    await sendStaffOrderAlertEmail(order, items);

    expect(mockSend).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
