/**
 * @module events/drag-context
 */

import { defineProperties, Instance } from '../core/instance.js';

/**
 * What a drop does with the dragged data.
 *
 * @enum {string}
 */
export const DragAction = Object.freeze({
    MOVE: 'move',
    COPY: 'copy',
    LINK: 'link',
});

/**
 * The state of one drag and drop session: the source and target widgets, and the dragged data
 * by type (for instance `'text/plain'` or an application-specific type).
 *
 * A source announces the types it offers with `addType()` and may provide the data right away
 * with `setData()`, or lazily: when a target calls `getData()` for an announced type without data,
 * the source receives a `drag-data-request` event and should call `setData()` then.
 *
 * Signals: `data-request` (`context, type`).
 */
export class DragContext extends Instance {
    _initialize() {
        super._initialize();

        /** @type {Set<string>} */
        this._types = new Set();

        /** @type {Map<string, unknown>} */
        this._data = new Map();
    }

    /**
     * Sets the data of a type, and announces the type.
     *
     * @param {string} type
     * @param {unknown} data
     */
    setData(type, data) {
        this._types.add(type);
        this._data.set(type, data);
    }

    /**
     * Gets the data of a type, requesting it from the source if it was announced but not set.
     *
     * @param {string} type
     * @returns {unknown} The data, or `null`.
     */
    getData(type) {
        if (!this._data.has(type) && this._types.has(type)) {
            this.emit('data-request', this, type);
        }

        return this._data.has(type) ? this._data.get(type) : null;
    }

    /**
     * Announces a type the source can provide.
     *
     * @param {string} type
     */
    addType(type) {
        this._types.add(type);
    }

    /**
     * Whether the session offers a type.
     *
     * @param {string} type
     * @returns {boolean}
     */
    supportsType(type) {
        return this._types.has(type);
    }

    /**
     * The offered types.
     *
     * @type {string[]}
     */
    get types() {
        return [...this._types];
    }
}

defineProperties(DragContext, {
    /**
     * The widget the drag started on.
     */
    source: { value: null },

    /**
     * The widget that accepted the drop, or `null` (set when the drop was accepted).
     */
    target: { value: null },

    /**
     * The actions the source allows, a subset of `DragAction` values.
     */
    actions: { value: Object.freeze([DragAction.MOVE]) },

    /**
     * The action of the drop: one of `actions`. Targets may change it during `drag-motion`, e.g.
     * to copy when Control is held.
     */
    action: {
        value: DragAction.MOVE,
        coerce(action) {
            if (!Object.values(DragAction).includes(action)) {
                throw new RangeError(`Unknown drag action '${action}'.`);
            }

            return action;
        },
    },

    /**
     * Text or an element shown next to the pointer while dragging, or `null` for none.
     */
    icon: { value: null },

    /**
     * Whether the drop was accepted by a target.
     */
    accepted: { value: false },

    /**
     * Whether the session was canceled (with Escape).
     */
    canceled: { value: false },
});
