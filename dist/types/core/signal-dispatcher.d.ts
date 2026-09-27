/**
 * @module core/signal-dispatcher
 */
export type SignalHandler = {
    method: Function;
    context?: object;
};
/**
 * @typedef {object} SignalHandler
 * @property {Function} method
 * @property {object} [context]
 */
/**
 * Dispatches named signals to connected handlers.
 *
 * Handlers run in connection order. A handler that returns `true` marks the signal as handled,
 * which is reported by {@link SignalDispatcher#emit}; the remaining handlers still run. Handlers
 * connected with {@link SignalDispatcher#connectLast} always run after the others.
 */
export declare class SignalDispatcher {
    /** @type {Map<string, SignalHandler[]>} */
    _slots: Map<string, SignalHandler[]>;
    /** @type {Map<string, SignalHandler[]>} */
    _lastSlots: Map<string, SignalHandler[]>;
    /** @type {Map<string, number>} */
    _blocked: Map<string, number>;
    constructor();
    /**
     * Connects a handler to a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context] The `this` of the handler.
     * @returns {() => void} A function that disconnects the handler again.
     */
    connect(name: string, method: Function, context?: object): () => void;
    /**
     * Connects a handler that runs before all handlers connected so far.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectFirst(name: string, method: Function, context?: object): () => void;
    /**
     * Connects a handler that runs after all other handlers, including ones connected later.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectLast(name: string, method: Function, context?: object): () => void;
    /**
     * Disconnects a handler. Does nothing if it was not connected.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     */
    disconnect(name: string, method: Function, context?: object): void;
    /**
     * Whether any handler is connected to a signal.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasHandlers(name: string): boolean;
    /**
     * Emits a signal.
     *
     * @param {string} name
     * @param {...unknown} args Arguments passed to every handler.
     * @returns {boolean} Whether any handler returned `true`.
     */
    emit(name: string, ...args: unknown[]): boolean;
    /**
     * Blocks a signal. Blocks nest: every block must be matched by an unblock.
     *
     * @param {string} name
     */
    block(name: string): void;
    /**
     * Unblocks a signal blocked with {@link SignalDispatcher#block}.
     *
     * @param {string} name
     */
    unblock(name: string): void;
    /**
     * Removes all handlers.
     */
    clear(): void;
    _getHandlers(slots: any, name: any): any;
}
