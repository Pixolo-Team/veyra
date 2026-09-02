import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { render } from './templates';

export interface OutgoingEmail {
  to: string;
  template: string;
  payload: Record<string, unknown>;
}

/**
 * Delivers one email. Drivers:
 *   - noop     — drop it (return a fake id)
 *   - console  — render and log it (default; how dev/tests inspect mail)
 *   - resend   — stubbed below; uncomment + set RESEND_API_KEY
 *
 * The OutboxWorker is the only caller; it owns retries and status.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly driver: Env['MAILER_DRIVER'];
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.driver = config.get('MAILER_DRIVER', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string }> {
    const { subject, text } = render(email.template, email.payload);

    switch (this.driver) {
      case 'noop':
        return { providerMessageId: `noop-${randomUUID()}` };

      case 'console':
        this.logger.log(
          `\n──────── email ────────\nfrom: ${this.from}\nto:   ${email.to}\nsubj: ${subject}\n\n${text}\n───────────────────────`,
        );
        return { providerMessageId: `console-${randomUUID()}` };

      // case 'resend': {
      //   const res = await fetch('https://api.resend.com/emails', {
      //     method: 'POST',
      //     headers: {
      //       Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      //       'content-type': 'application/json',
      //     },
      //     body: JSON.stringify({ from: this.from, to: email.to, subject, text }),
      //   });
      //   if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      //   const body = (await res.json()) as { id: string };
      //   return { providerMessageId: body.id };
      // }

      default:
        throw new Error(`Unknown MAILER_DRIVER: ${this.driver as string}`);
    }
  }
}
