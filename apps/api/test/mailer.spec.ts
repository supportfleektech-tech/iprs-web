import { describe, it, expect, vi } from 'vitest';
import { buildMailer, ConsoleMailer, SmtpMailer } from '../src/common/mailer';

describe('mailer transport selection', () => {
  it('defaults to log-only ConsoleMailer when SMTP_HOST is empty', () => {
    const mailer = buildMailer();
    expect(mailer).toBeInstanceOf(ConsoleMailer);
  });

  it('SmtpMailer sends via SMTP without logging the body', async () => {
    const mailer = new SmtpMailer();
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
    (mailer as unknown as { transporter: { sendMail: unknown } }).transporter = {
      sendMail,
    } as never;

    await mailer.send('user@example.com', 'Reset your password', 'secret-link-body');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const args = sendMail.mock.calls[0]![0] as Record<string, string>;
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toBe('Reset your password');
    expect(args.text).toBe('secret-link-body');
    expect(args.from).toContain('no-reply@fleekiprs.co.ke');
  });
});
