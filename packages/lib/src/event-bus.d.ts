type EventPayload = Record<string, unknown>;
export declare class EventBus {
    private readonly emitter;
    on<T extends EventPayload>(event: string, listener: (payload: T) => void | Promise<void>): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit<T extends EventPayload>(event: string, payload: T): void;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=event-bus.d.ts.map