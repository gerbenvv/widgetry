/**
 * @module core/signal-dispatcher
 */

/**
 * @typedef {object} SignalHandler
 * @property {Function} method
 * @property {object} [context]
 * @property {boolean} [disconnected] Set when the handler is disconnected, so that an emit in
 *     progress skips it.
 */

/**
 * Dispatches named signals to connected handlers.
 *
 * Handlers run in connection order. A handler that returns `true` marks the signal as handled,
 * which is reported by {@link SignalDispatcher#emit}; the remaining handlers still run. Handlers
 * connected with {@link SignalDispatcher#connectLast} always run after the others. Handlers
 * connected during an emit do not run in it, and handlers disconnected during an emit no longer
 * run in it.
 */
export class SignalDispatcher {
    constructor() {
        /** @type {Map<string, SignalHandler[]>} */
        this._slots = new Map();

        /** @type {Map<string, SignalHandler[]>} */
        this._lastSlots = new Map();

        /** @type {Map<string, number>} */
        this._blocked = new Map();
    }

    /**
     * Connects a handler to a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context] The `this` of the handler.
     * @returns {() => void} A function that disconnects the handler again.
     */
    connect(name, method, context) {
        const handler = { method, context };
        this._getHandlers(this._slots, name).push(handler);

        return () => this._removeHandler(name, handler);
    }

    /**
     * Connects a handler that runs before all handlers connected so far.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectFirst(name, method, context) {
        const handler = { method, context };
        this._getHandlers(this._slots, name).unshift(handler);

        return () => this._removeHandler(name, handler);
    }

    /**
     * Connects a handler that runs after all other handlers, including ones connected later.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectLast(name, method, context) {
        const handler = { method, context };
        this._getHandlers(this._lastSlots, name).push(handler);

        return () => this._removeHandler(name, handler);
    }

    /**
     * Disconnects a handler. Does nothing if it was not connected.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     */
    disconnect(name, method, context) {
        for (const slots of [this._slots, this._lastSlots]) {
            const handlers = slots.get(name);
            if (!handlers) {
                continue;
            }

            for (let i = handlers.length - 1; i >= 0; --i) {
                if (handlers[i].method === method && handlers[i].context === context) {
                    handlers[i].disconnected = true;
                    handlers.splice(i, 1);

                    return;
                }
            }
        }
    }

    /**
     * Whether any handler is connected to a signal.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasHandlers(name) {
        return Boolean(this._slots.get(name)?.length || this._lastSlots.get(name)?.length);
    }

    /**
     * Emits a signal.
     *
     * @param {string} name
     * @param {...unknown} args Arguments passed to every handler.
     * @returns {boolean} Whether any handler returned `true`.
     */
    emit(name, ...args) {
        if (this._blocked.get(name)) {
            return false;
        }

        // Copy the handlers, because they may change during this emit.
        const handlers = [...(this._slots.get(name) || []), ...(this._lastSlots.get(name) || [])];

        let handled = false;
        for (const handler of handlers) {
            if (handler.disconnected) {
                continue;
            }

            if (handler.method.apply(handler.context, args) === true) {
                handled = true;
            }
        }

        return handled;
    }

    /**
     * Blocks a signal. Blocks nest: every block must be matched by an unblock.
     *
     * @param {string} name
     */
    block(name) {
        this._blocked.set(name, (this._blocked.get(name) || 0) + 1);
    }

    /**
     * Unblocks a signal blocked with {@link SignalDispatcher#block}.
     *
     * @param {string} name
     */
    unblock(name) {
        const count = this._blocked.get(name) || 0;
        if (count <= 1) {
            this._blocked.delete(name);
        } else {
            this._blocked.set(name, count - 1);
        }
    }

    /**
     * Removes all handlers.
     */
    clear() {
        for (const slots of [this._slots, this._lastSlots]) {
            for (const handlers of slots.values()) {
                for (const handler of handlers) {
                    handler.disconnected = true;
                }
            }

            slots.clear();
        }
    }

    _removeHandler(name, handler) {
        for (const slots of [this._slots, this._lastSlots]) {
            const handlers = slots.get(name);
            const index = handlers ? handlers.indexOf(handler) : -1;

            if (index >= 0) {
                handler.disconnected = true;
                handlers.splice(index, 1);

                return;
            }
        }
    }

    _getHandlers(slots, name) {
        let handlers = slots.get(name);
        if (!handlers) {
            handlers = [];
            slots.set(name, handlers);
        }

        return handlers;
    }
}
