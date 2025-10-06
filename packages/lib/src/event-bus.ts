import { EventEmitter } from 'node:events';

type EventPayload = Record<string, unknown>;

export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  on<T extends EventPayload>(event: string, listener: (payload: T) => void | Promise<void>): void {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  emit<T extends EventPayload>(event: string, payload: T): void {
    this.emitter.emit(event, payload);
  }
}

export const eventBus = new EventBus();
