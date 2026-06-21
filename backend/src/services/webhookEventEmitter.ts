/**
 * WebhookEventEmitter
 *
 * A lightweight singleton that decouples event producers (controllers, services)
 * from the WebhookService.  Any module can call `webhookEvents.emit(type, data)`
 * to fan out to all registered webhooks without a direct dependency on Prisma
 * or WebhookService.
 *
 * Usage:
 *   import { webhookEvents } from './webhookEventEmitter';
 *   webhookEvents.emit('transaction.created', { id: '...', amount: 100 });
 *
 * The emitter is initialised in index.ts once the Prisma client is ready.
 */

import { EventEmitter } from 'events';
import { log } from '../utils/logger';
import type { WebhookEventType } from '../models/Webhook';
import type { WebhookService } from './webhookService';

class WebhookEventEmitter extends EventEmitter {
  private service: WebhookService | null = null;

  /**
   * Called once on startup to wire up the WebhookService.
   */
  init(service: WebhookService): void {
    this.service = service;
    log.info('WebhookEventEmitter initialised');
  }

  /**
   * Emits a webhook event to all subscribed endpoints.
   * Fire-and-forget: errors are caught and logged, never thrown.
   */
  emit(event: WebhookEventType, data: Record<string, unknown>): boolean {
    if (!this.service) {
      log.warn('WebhookEventEmitter.emit called before init — event dropped', {
        event,
      });
      return false;
    }

    // Dispatch asynchronously so callers are never blocked
    this.service.dispatch(event, data).catch((err: Error) => {
      log.error('WebhookEventEmitter dispatch error', err, { event });
    });

    return true;
  }
}

// Singleton — import this everywhere you need to fire webhook events
export const webhookEvents = new WebhookEventEmitter();
// Increase the default max-listeners limit to avoid Node.js warnings in large apps
webhookEvents.setMaxListeners(50);
