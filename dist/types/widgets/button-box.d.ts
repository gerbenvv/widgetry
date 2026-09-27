/**
 * @module widgets/button-box
 */
import { Box } from './box.js';
/**
 * A box for a row (or column) of buttons, such as the action area of a dialog, like GTK's button
 * box.
 *
 * The buttons get the same size (the largest natural size, but at least `minChildWidth` by
 * `minChildHeight`) unless `homogeneous` is turned off, and are arranged by `layoutStyle`.
 * Secondary children (see `setChildSecondary()`) are placed apart at the other end, such as a
 * Help button at the left of OK and Cancel. With the `spread` style the spacing is also added
 * before the first and after the last button.
 */
export declare class ButtonBox extends Box {
    /** @type {Set<import('./widget.js').Widget>} */
    _secondary: Set<import('./widget.js').Widget>;
    _childObserver: ResizeObserver;
    _measuring: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Sets whether a child is secondary: placed apart from the other children, at the start for
     * the `end`, `edge`, `spread` and `center` styles, and at the end for the `start` style.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} secondary
     * @throws {Error} If the widget is not a child.
     */
    setChildSecondary(widget: import('./widget.js').Widget, secondary: boolean): void;
    /**
     * Returns whether a child is secondary.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {boolean}
     */
    getChildSecondary(widget: import('./widget.js').Widget): boolean;
    insertChild(widget: any, index: any): import("./widget.js").Widget;
    removeChild(widget: any): number;
    destroy(): void;
    _updateLayout(): void;
    _layoutButton(child: any, horizontal: any, size: any): void;
    _getMinimumChildSize(child: any, horizontal: any): number;
    /**
     * Measures the largest natural size of the children along the box, without the sizes this
     * box imposes on them.
     *
     * @param {import('./widget.js').Widget[]} children
     * @param {boolean} horizontal
     * @returns {number}
     */
    _measureLargestChild(children: import('./widget.js').Widget[], horizontal: boolean): number;
}

/** The declared properties of {@link ButtonBox}. */
export interface ButtonBox {
    /**
     * How the children are arranged: one of `ButtonBoxStyle`. `edge` (the default, as in the
     * original toolkit) puts the first and last child at the ends with equal space between the
     * children, `spread` also puts space before the first and after the last, and `start`, `end`
     * and `center` pack the children together.
     */
    layoutStyle: string;
    /**
     * Whether all children get the same size along the box, as in GTK.
     */
    homogeneous: boolean;
    /**
     * The space between the children, in pixels.
     */
    spacing: number;
    /**
     * The minimum width of the children in pixels, as in GTK.
     */
    minChildWidth: number;
    /**
     * The minimum height of the children in pixels.
     */
    minChildHeight: number;
}
