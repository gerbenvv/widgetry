/**
 * @module widgets/fixed
 */
import { Container } from './container.js';
/**
 * Places its children at fixed positions, in pixels from its top-left corner. Children get their
 * natural size (or their requested `width` and `height`), and the fixed container is as large
 * as needed to show all of them.
 *
 * Fixed positioning does not adapt to fonts, translations or themes; prefer the other
 * containers where possible.
 *
 * @example
 * const fixed = new Fixed();
 * fixed.addChild(new Button({ label: 'Here' }), 40, 20);
 */
export declare class Fixed extends Container {
    /** @type {Map<import('./widget.js').Widget, {x: number, y: number}>} */
    _positions: Map<import('./widget.js').Widget, {
        x: number;
        y: number;
    }>;
    _pendingPosition: {
        x: number;
        y: number;
    };
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Adds a child at a position.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} [x]
     * @param {number} [y]
     * @returns {import('./widget.js').Widget} The widget.
     */
    addChild(widget: import('./widget.js').Widget, x?: number, y?: number): import('./widget.js').Widget;
    /**
     * Adds a child at a position. The same as `addChild()`, with the name GTK uses.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} x
     * @param {number} y
     * @returns {import('./widget.js').Widget}
     */
    put(widget: import('./widget.js').Widget, x: number, y: number): import('./widget.js').Widget;
    insertChild(widget: any, index: any): import("./widget.js").Widget;
    removeChild(widget: any): number;
    /**
     * Moves a child to another position.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {number} x
     * @param {number} y
     * @throws {Error} If the widget is not a child.
     */
    move(widget: import('./widget.js').Widget, x: number, y: number): void;
    /**
     * Returns the position of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {{x: number, y: number}}
     * @throws {Error} If the widget is not a child.
     */
    getChildPosition(widget: import('./widget.js').Widget): {
        x: number;
        y: number;
    };
    _updateLayout(): void;
}
export declare namespace Fixed {
    var builderProperties: {
        /**
         * Builds the children, each an object with the widget's own properties plus `x` and `y`.
         *
         * @param {object} builder
         * @param {Fixed} fixed
         * @param {object[]} children
         */
        children(builder: object, fixed: Fixed, children: object[]): void;
    };
}
