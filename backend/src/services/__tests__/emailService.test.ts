import { EmailService } from '../emailService';
import type { EmailConfig } from '../../config/email';

const testConfig: EmailConfig = {
  provider: 'smtp',
  from: 'test@chenaikit.io',
  fromName: 'ChenAIKit Test',
  smtp: { host: 'localhost', port: 1025, secure: false },
  queue: { concurrency: 1, maxAttempts: 1, backoffDelayMs: 100 },
};

// Replace the transporter with a stub so no real SMTP calls are made.
function makeService() {
  const service = new EmailService(testConfig);
  const sent: unknown[] = [];
  // @ts-expect-error — accessing private field for testing
  service.transporter = {
    sendMail: async (opts: unknown) => {
      sent.push(opts);
      return { messageId: 'test-id-123', accepted: [(opts as any).to].flat(), rejected: [] };
    },
    verify: async () => true,
  };
  return { service, sent };
}

describe('EmailService', () => {
  describe('send()', () => {
    it('sends to a single valid recipient', async () => {
      const { service, sent } = makeService();
      const result = await service.send({ to: 'alice@example.com', subject: 'Hello', text: 'Hi' });
      expect(result.messageId).toBe('test-id-123');
      expect(result.accepted).toContain('alice@example.com');
      expect(sent).toHaveLength(1);
    });

    it('sends to multiple recipients', async () => {
      const { service, sent } = makeService();
      await service.send({ to: ['a@x.com', 'b@x.com'], subject: 'Bulk', text: 'Hi' });
      expect(sent).toHaveLength(1);
      expect((sent[0] as any).to).toEqual(['a@x.com', 'b@x.com']);
    });

    it('skips invalid email addresses', async () => {
      const { service, sent } = makeService();
      await service.send({ to: ['good@x.com', 'not-an-email'], subject: 'Test', text: 'Hi' });
      expect((sent[0] as any).to).toEqual(['good@x.com']);
    });

    it('throws when all recipients are invalid', async () => {
      const { service } = makeService();
      await expect(service.send({ to: 'not-valid', subject: 'X', text: 'y' })).rejects.toThrow(
        'No valid recipients'
      );
    });
  });

  describe('template helpers', () => {
    it('sendWelcome uses welcome template and sets subject', async () => {
      const { service, sent } = makeService();
      await service.sendWelcome('u@x.com', 'Alice', { dashboardUrl: 'https://app.io', docsUrl: 'https://docs.io' });
      expect((sent[0] as any).subject).toContain('Alice');
      expect((sent[0] as any).html).toContain('Alice');
    });

    it('sendPasswordReset includes reset URL in rendered HTML', async () => {
      const { service, sent } = makeService();
      await service.sendPasswordReset('u@x.com', 'Bob', 'https://reset.link/token');
      expect((sent[0] as any).html).toContain('https://reset.link/token');
    });

    it('sendVerification includes verification code', async () => {
      const { service, sent } = makeService();
      await service.sendVerification('u@x.com', 'Carol', 'https://verify.link', '123456');
      expect((sent[0] as any).html).toContain('123456');
    });

    it('sendNotification sets type badge', async () => {
      const { service, sent } = makeService();
      await service.sendNotification('u@x.com', 'Dave', 'Alert!', 'Something happened', {
        type: 'warning',
      });
      expect((sent[0] as any).html).toContain('warning');
    });
  });

  describe('getSentLog()', () => {
    it('records each sent email', async () => {
      const { service } = makeService();
      await service.send({ to: 'a@x.com', subject: 'S1', text: 't' });
      await service.send({ to: 'b@x.com', subject: 'S2', text: 't' });
      const log = service.getSentLog();
      expect(log).toHaveLength(2);
      expect(log[0].subject).toBe('S1');
      expect(log[1].subject).toBe('S2');
    });

    it('returns a copy, not a reference', async () => {
      const { service } = makeService();
      await service.send({ to: 'a@x.com', subject: 'X', text: 't' });
      const log1 = service.getSentLog();
      log1.push({ messageId: 'fake', to: [], subject: '', sentAt: new Date(), provider: '' });
      expect(service.getSentLog()).toHaveLength(1);
    });
  });

  describe('verifyConnection()', () => {
    it('returns true when transporter verify succeeds', async () => {
      const { service } = makeService();
      expect(await service.verifyConnection()).toBe(true);
    });

    it('returns false when transporter verify throws', async () => {
      const { service } = makeService();
      // @ts-expect-error
      service.transporter.verify = async () => { throw new Error('refused'); };
      expect(await service.verifyConnection()).toBe(false);
    });
  });
});
