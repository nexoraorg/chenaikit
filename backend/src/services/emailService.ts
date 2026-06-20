import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { getEmailConfig, type EmailConfig } from '../config/email';
import { interpolate, isValidEmail, formatAddress } from '../utils/emailUtils';
import { log } from '../utils/logger';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: EmailTemplate;
  templateVars?: Record<string, string>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'account-verification'
  | 'notification';

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface EmailTrackingRecord {
  messageId: string;
  to: string[];
  subject: string;
  sentAt: Date;
  provider: string;
}

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

export class EmailService {
  private transporter: Transporter;
  private config: EmailConfig;
  private sentLog: EmailTrackingRecord[] = [];

  constructor(config?: EmailConfig) {
    this.config = config ?? getEmailConfig();
    this.transporter = this.createTransporter(this.config);
  }

  private createTransporter(config: EmailConfig): Transporter {
    switch (config.provider) {
      case 'sendgrid':
        return nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: { user: 'apikey', pass: config.sendgridApiKey },
        });

      case 'mailgun':
        return nodemailer.createTransport({
          host: `smtp.mailgun.org`,
          port: 587,
          auth: {
            user: `postmaster@${config.mailgun?.domain}`,
            pass: config.mailgun?.apiKey,
          },
        });

      case 'ses':
        return nodemailer.createTransport({
          host: `email-smtp.${config.ses?.region}.amazonaws.com`,
          port: 587,
          auth: {
            user: config.ses?.accessKeyId,
            pass: config.ses?.secretAccessKey,
          },
        });

      case 'smtp':
      default:
        return nodemailer.createTransport({
          host: config.smtp?.host ?? 'localhost',
          port: config.smtp?.port ?? 587,
          secure: config.smtp?.secure ?? false,
          auth:
            config.smtp?.user
              ? { user: config.smtp.user, pass: config.smtp.pass }
              : undefined,
        });
    }
  }

  private loadTemplate(name: EmailTemplate): string {
    const filePath = path.join(TEMPLATES_DIR, `${name}.html`);
    return fs.readFileSync(filePath, 'utf-8');
  }

  private buildHtml(options: SendEmailOptions): string | undefined {
    if (options.html) return options.html;
    if (!options.template) return undefined;

    const raw = this.loadTemplate(options.template);
    const vars = {
      year: String(new Date().getFullYear()),
      ...options.templateVars,
    };
    return interpolate(raw, vars);
  }

  private normaliseRecipients(to: string | string[]): string[] {
    return (Array.isArray(to) ? to : [to]).filter((addr) => {
      if (!isValidEmail(addr)) {
        log.warn('[email] skipping invalid address', { address: addr });
        return false;
      }
      return true;
    });
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    const recipients = this.normaliseRecipients(options.to);
    if (recipients.length === 0) {
      throw new Error('No valid recipients provided');
    }

    const from = formatAddress(this.config.fromName, this.config.from);
    const html = this.buildHtml(options);

    const mailOptions: SendMailOptions = {
      from,
      to: recipients,
      subject: options.subject,
      html,
      text: options.text,
      replyTo: options.replyTo ?? this.config.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
    };

    log.info('[email] sending', {
      to: recipients,
      subject: options.subject,
      provider: this.config.provider,
      template: options.template,
    });

    const info = await this.transporter.sendMail(mailOptions);

    const record: EmailTrackingRecord = {
      messageId: info.messageId,
      to: recipients,
      subject: options.subject,
      sentAt: new Date(),
      provider: this.config.provider,
    };
    this.sentLog.push(record);

    log.info('[email] sent', { messageId: info.messageId, accepted: info.accepted });

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  }

  async sendWelcome(to: string, name: string, vars: Record<string, string> = {}): Promise<EmailResult> {
    return this.send({
      to,
      subject: `Welcome to ChenAIKit, ${name}!`,
      template: 'welcome',
      templateVars: { name, dashboardUrl: vars.dashboardUrl ?? '', docsUrl: vars.docsUrl ?? '', ...vars },
    });
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string, expiresIn = '1 hour'): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'Reset your ChenAIKit password',
      template: 'password-reset',
      templateVars: { name, resetUrl, expiresIn },
    });
  }

  async sendVerification(
    to: string,
    name: string,
    verifyUrl: string,
    verificationCode: string,
    expiresIn = '24 hours'
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'Verify your ChenAIKit account',
      template: 'account-verification',
      templateVars: { name, verifyUrl, verificationCode, expiresIn },
    });
  }

  async sendNotification(
    to: string,
    name: string,
    subject: string,
    message: string,
    opts: { type?: string; actionUrl?: string; actionLabel?: string; unsubscribeUrl?: string } = {}
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject,
      template: 'notification',
      templateVars: {
        name,
        subject,
        message,
        type: opts.type ?? 'info',
        actionUrl: opts.actionUrl ?? '',
        actionLabel: opts.actionLabel ?? 'View Details',
        unsubscribeUrl: opts.unsubscribeUrl ?? '#',
      },
    });
  }

  /** Returns a copy of the in-memory sent log (useful in tests and admin views). */
  getSentLog(): EmailTrackingRecord[] {
    return [...this.sentLog];
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      log.info('[email] transporter connection verified');
      return true;
    } catch (err) {
      log.error('[email] transporter connection failed', err as Error);
      return false;
    }
  }
}

let instance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!instance) {
    instance = new EmailService();
  }
  return instance;
}
