/**
 * @module events/drag-context
 */
import { Instance } from '../core/instance.js';
/**
 * What a drop does with the dragged data.
 *
 * @enum {string}
 */
export declare const DragAction: Readonly<{
    MOVE: "move";
    COPY: "copy";
    LINK: "link";
}>;
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
export declare class DragContext extends Instance {
    /** @type {Set<string>} */
    _types: Set<string>;
    /** @type {Map<string, unknown>} */
    _data: Map<string, unknown>;
    _initialize(): void;
    /**
     * Sets the data of a type, and announces the type.
     *
     * @param {string} type
     * @param {unknown} data
     */
    setData(type: string, data: unknown): void;
    /**
     * Gets the data of a type, requesting it from the source if it was announced but not set.
     *
     * @param {string} type
     * @returns {unknown} The data, or `null`.
     */
    getData(type: string): unknown;
    /**
     * Announces a type the source can provide.
     *
     * @param {string} type
     */
    addType(type: string): void;
    /**
     * Whether the session offers a type.
     *
     * @param {string} type
     * @returns {boolean}
     */
    supportsType(type: string): boolean;
    /**
     * The offered types.
     *
     * @type {string[]}
     */
    get types(): string[];
}

/** The declared properties of {@link DragContext}. */
export interface DragContext {
    /**
     * The widget the drag started on.
     */
    source: any;
    /**
     * The widget that accepted the drop, or `null` (set when the drop was accepted).
     */
    target: any;
    /**
     * The actions the source allows, a subset of `DragAction` values.
     */
    actions: any;
    /**
     * The action of the drop: one of `actions`. Targets may change it during `drag-motion`, e.g.
     * to copy when Control is held.
     */
    action: any;
    /**
     * Text or an element shown next to the pointer while dragging, or `null` for none.
     */
    icon: any;
    /**
     * Whether the drop was accepted by a target.
     */
    accepted: any;
    /**
     * Whether the session was canceled (with Escape).
     */
    canceled: any;
}
