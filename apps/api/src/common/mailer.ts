import { Inject, Injectable, Logger } from '@nestjs/common';

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
    this.logger.log(`mail → ${to} · "${subject}" (${process.env.NODE_ENV === 'production' ? 'body redacted' : body})`);
  }
}

export const InjectMailer = () => Inject(MAILER);
