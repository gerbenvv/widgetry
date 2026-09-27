/**
 * @module widgets/abstract-slider
 */
import { Adjustment } from '../data/adjustment.js';
import { Widget } from './widget.js';
/**
 * Converts a wheel event to notches: about 1 per click of a mouse wheel.
 *
 * @param {WheelEvent} event
 * @returns {number} Positive when scrolling down or right.
 */
export declare function getWheelNotches(event: WheelEvent): number;
/**
 * Base class of widgets that show and change the value of an `Adjustment` along a trough: sliders
 * and scroll bars.
 *
 * The thumb is placed with CSS: the root element gets the custom properties `--wy-fraction` (the
 * position of the thumb from 0 at the start of the trough to 1 at its end, after inversion) and
 * `--wy-page-fraction` (the page size relative to the range), so no layout has to be measured
 * until the user drags.
 *
 * Pointer: dragging the thumb changes the value; pressing the trough either moves the thumb there
 * (`primaryButtonWarps`) or pages towards the pointer, repeating while held. Shift inverts that,
 * and the middle button always moves the thumb there. The wheel steps the value.
 *
 * Subclasses render `_troughEl` and `_thumbEl` in `_render()`.
 *
 * Signals: `value-change`, `lower-change`, `upper-change` (forwarded from the adjustment).
 */
export declare class AbstractSlider extends Widget {
    _adjustmentDisconnects: any[];
    _drag: {
        pointerId: any;
        grabOffset: any;
        start: any;
        range: number;
    };
    _paging: {
        pointerId: any;
        update: (x: any) => any;
    };
    _stopPaging: () => void;
    _initialize(): void;
    /**
     * Creates the default adjustment. Subclasses override this for other defaults.
     *
     * @protected
     * @returns {Adjustment}
     */
    protected _createAdjustment(): Adjustment;
    /**
     * Sets several properties, applying the bounds before the value so that it is not clamped to
     * the old bounds.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    destroy(): void;
    /**
     * The fraction of the thumb position along the trough, from 0 at the start (the left or top)
     * to 1 at the end, taking `inverted` into account.
     *
     * @protected
     * @returns {number}
     */
    protected _getDisplayFraction(): number;
    /**
     * Sets the value from a thumb position fraction along the trough.
     *
     * @protected
     * @param {number} fraction
     */
    protected _setDisplayFraction(fraction: number): void;
    /**
     * Whether the value increases towards the start of the trough: when `inverted`, or (in
     * right-to-left text) for horizontal widgets that are not inverted.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isReversed(): boolean;
    /**
     * Sets the value because the user changed it. Subclasses may round it.
     *
     * @protected
     * @param {number} value
     */
    protected _setValueFromUser(value: number): void;
    /**
     * Updates the element after the adjustment or the orientation changed. Subclasses extend this.
     *
     * @protected
     */
    protected _update(): void;
    _updateOrientation(): void;
    _connectAdjustment(adjustment: any): void;
    /**
     * Returns the pointer position along the trough, and the trough and thumb geometry.
     *
     * @protected
     * @param {PointerEvent} event
     * @returns {{position: number, start: number, length: number, thumbStart: number,
     *     thumbLength: number}}
     */
    protected _measure(event: PointerEvent): {
        position: number;
        start: number;
        length: number;
        thumbStart: number;
        thumbLength: number;
    };
    _startDrag(event: any, geometry: any, grabOffset: any): void;
    _startPaging(event: any, geometry: any): void;
    _onTroughPointerDown(event: any): void;
    _onPointerMove(event: any): void;
    _onPointerUp(event: any): void;
    /**
     * Returns the value change of one wheel notch.
     *
     * @protected
     * @returns {number}
     */
    protected _getWheelStep(): number;
    _onWheel(event: any): void;
    /**
     * Changes the value by a number of wheel notches.
     *
     * @protected
     * @param {number} notches
     */
    protected _applyWheel(notches: number): void;
    _onKeyDown(event: any): void;
}

/** The declared properties of {@link AbstractSlider}. */
export interface AbstractSlider {
    /**
     * The `Adjustment` holding the value, its bounds and increments. A default one is created.
     */
    adjustment: Adjustment;
    /**
     * The value, forwarded to the adjustment.
     */
    value: number;
    /**
     * The minimum value, forwarded to the adjustment.
     */
    lower: number;
    /**
     * The maximum value, forwarded to the adjustment.
     */
    upper: number;
    /**
     * The step of the arrow keys and the wheel, forwarded to the adjustment.
     */
    stepIncrement: number;
    /**
     * The step of Page Up and Page Down and of paging, forwarded to the adjustment.
     */
    pageIncrement: number;
    /**
     * The direction of the trough: one of `Orientation`.
     */
    orientation: string;
    /**
     * Whether the value increases towards the start (the left or top) instead of the end.
     */
    inverted: boolean;
    /**
     * Whether pressing the trough with the primary button moves the thumb there (otherwise it
     * pages towards the pointer). Shift inverts this.
     */
    primaryButtonWarps: any;
}
