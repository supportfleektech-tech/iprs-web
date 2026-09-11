import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { appConfig } from '../config/configuration';

/** DI token for the mail transport. */
export const MAILER = 'MAILER';

export interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

/**
 * v1 transport: writes to the server log. Swap for SES/Postmark/SMTP by
 * providing another implementation of this interface.
 */
@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  async send(to: string, subject: string, body: string): Promise<void> {
    // Never log the message body in production builds — it may contain links.
    this.logger.log(
      `mail → ${to} · "${subject}" (${process.env.NODE_ENV === 'production' ? 'body redacted' : body})`,
    );
  }
}

/**
 * SMTP transport (Nodemailer) — works with any provider: Postmark, SES (via
 * SMTP interface), Gmail, or self-hosted Postfix. Activated when SMTP_HOST is
 * set; otherwise the factory below keeps ConsoleMailer.
 *
 * Required env: SMTP_HOST (+ SMTP_USER/SMTP_PASS when auth is needed).
 * Optional: SMTP_PORT (default 587), SMTP_SECURE ('true' for port 465),
 * SMTP_FROM (default 'Fleek IPRS <no-reply@fleekiprs.co.ke>').
 */
@Injectable()
export class SmtpMailer implements Mailer {
  private readonly logger = new Logger('SmtpMailer');
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: appConfig.smtpHost,
      port: appConfig.smtpPort,
      secure: appConfig.smtpSecure,
      auth:
        appConfig.smtpUser || appConfig.smtpPass
          ? { user: appConfig.smtpUser, pass: appConfig.smtpPass }
          : undefined,
    });
    this.from = appConfig.smtpFrom;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    // Log recipient + subject only — never the body (may contain reset links).
    this.logger.log(`mail → ${to} · "${subject}" (smtp)`);
    await this.transporter.sendMail({ from: this.from, to, subject, text: body });
  }
}

/**
 * Selects the mail transport from configuration: SMTP when SMTP_HOST is set,
 * ConsoleMailer (log-only) otherwise. Keeps sandbox/dev working with zero env.
 */
export function buildMailer(): Mailer {
  if (appConfig.smtpHost) return new SmtpMailer();
  return new ConsoleMailer();
}

export const InjectMailer = () => Inject(MAILER);
