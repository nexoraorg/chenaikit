/**
 * Event emitter utility
 */

/**
 * Generic event emitter class
 */
export class EventEmitter<T extends Record<string, any> = Record<string, any>> {
  private listeners: Map<keyof T, Array<(data: T[keyof T]) => void>> = new Map();

  /**
   * Add event listener
   */
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    const onceListener = (data: T[K]) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof T>(event: K): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Get all event names
   */
  eventNames(): (keyof T)[] {
    return Array.from(this.listeners.keys());
  }
}
