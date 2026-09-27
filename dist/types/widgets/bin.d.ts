/**
 * @module widgets/bin
 */
import { Container } from './container.js';
/**
 * A container with at most one child, which fills the body (subject to its alignment).
 */
export declare class Bin extends Container {
    _initialize(): void;
    /**
     * Adds the child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {import('./widget.js').Widget}
     * @throws {Error} If the bin already has a child.
     */
    insertChild(widget: import('./widget.js').Widget, index: any): import('./widget.js').Widget;
}

/** The declared properties of {@link Bin}. */
export interface Bin {
    /**
     * The child, or `null`. Setting it replaces (and destroys) the current child.
     */
    child: any;
}
