import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailSender } from '../application/ports';

export interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * SMTP transport (mailpit in dev, a real relay in prod). When no host is
 * configured it reports itself disabled and the drain no-ops — the app never
 * depends on a mail server being present.
 */
export class NodemailerSender implements EmailSender {
  private readonly transporter: Transporter | null;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = config.host
      ? nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.user ? { user: config.user, pass: config.pass } : undefined,
        })
      : null;
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async send(message: { to: string; subject: string; html: string; text: string }): Promise<void> {
    if (!this.transporter) return;
    await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
