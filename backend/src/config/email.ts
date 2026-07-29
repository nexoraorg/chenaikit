import { z } from 'zod';

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun' | 'ses';

const EmailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).default('smtp'),
  from: z.string().email().default('noreply@chenaikit.io'),
  fromName: z.string().default('ChenAIKit'),
  replyTo: z.string().email().optional(),

  // SMTP
  smtp: z
    .object({
      host: z.string(),
      port: z.number(),
      secure: z.boolean().default(false),
      user: z.string().optional(),
      pass: z.string().optional(),
    })
    .optional(),

  // SendGrid
  sendgridApiKey: z.string().optional(),

  // Mailgun
  mailgun: z
    .object({
      apiKey: z.string(),
      domain: z.string(),
    })
    .optional(),

  // AWS SES
  ses: z
    .object({
      region: z.string(),
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
    })
    .optional(),

  // Queue settings
  queue: z
    .object({
      concurrency: z.number().default(5),
      maxAttempts: z.number().default(3),
      backoffDelayMs: z.number().default(5000),
    })
    .default({}),
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

export function getEmailConfig(): EmailConfig {
  return EmailConfigSchema.parse({
    provider: process.env.EMAIL_PROVIDER,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME,
    replyTo: process.env.EMAIL_REPLY_TO,

    smtp: process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,

    sendgridApiKey: process.env.SENDGRID_API_KEY,

    mailgun: process.env.MAILGUN_API_KEY
      ? {
          apiKey: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN ?? '',
        }
      : undefined,

    ses: process.env.AWS_SES_REGION
      ? {
          region: process.env.AWS_SES_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,

    queue: {
      concurrency: Number(process.env.EMAIL_QUEUE_CONCURRENCY ?? 5),
      maxAttempts: Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? 3),
      backoffDelayMs: Number(process.env.EMAIL_QUEUE_BACKOFF_MS ?? 5000),
    },
  });
}
