/**
 * @module core/cursor
 */
import { Instance } from './instance.js';
/**
 * CSS cursor values of `CursorShape` values.
 *
 * @type {Readonly<Record<string, string>>}
 */
export declare const CSS_CURSORS: Readonly<Record<string, string>>;
/**
 * Overrides the pointer cursor of the whole page, e.g. while dragging or resizing. Shapes are
 * kept on a stack per context, so nested operations restore the previous shape.
 */
export declare class Cursor extends Instance {
    /** @type {{shape: string, context: string}[]} */
    _stack: {
        shape: string;
        context: string;
    }[];
    _initialize(): void;
    /**
     * Pushes a cursor shape.
     *
     * @param {string} shape One of `CursorShape`.
     * @param {string} [context] Identifies the pusher, so it can pop its own shapes.
     */
    pushShape(shape: string, context?: string): void;
    /**
     * Pops the most recent shape pushed with the given context.
     *
     * @param {string} [context]
     */
    popShape(context?: string): void;
    /**
     * The shape currently shown, or `null` when the page's own cursors apply.
     *
     * @type {string | null}
     */
    get shape(): string | null;
    _apply(): void;
}
/**
 * Returns the cursor singleton.
 *
 * @type {() => Cursor}
 */
export declare const getCursor: () => Cursor;
