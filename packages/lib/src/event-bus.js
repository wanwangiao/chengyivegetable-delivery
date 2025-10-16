import { EventEmitter } from 'node:events';
export class EventBus {
    constructor() {
        this.emitter = new EventEmitter({ captureRejections: true });
    }
    on(event, listener) {
        this.emitter.on(event, listener);
    }
    off(event, listener) {
        this.emitter.off(event, listener);
    }
    emit(event, payload) {
        this.emitter.emit(event, payload);
    }
}
export const eventBus = new EventBus();
//# sourceMappingURL=event-bus.js.map