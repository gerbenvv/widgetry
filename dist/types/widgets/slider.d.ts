/**
 * @module widgets/slider
 */
import { AbstractSlider } from './abstract-slider.js';
export type SliderMark = {
    value: number;
    /**
     * One of `Position`: `TOP` or `BOTTOM` for horizontal sliders, `LEFT`
     * or `RIGHT` for vertical ones.
     */
    position: string;
    label: string | null;
};
/**
 * A slider (a scale in GTK) for choosing a value from a range by dragging a thumb along a trough.
 *
 * The part of the trough from the lower end to the thumb is filled with the accent color
 * (`hasOrigin`). The value is shown next to the thumb (`drawValue`, `valuePos`) with `digits`
 * decimals, and values set by the user are rounded to those decimals. Marks with optional labels
 * can be added along the trough.
 *
 * Keyboard: the arrow keys step (with Ctrl, by a page), Page Up and Page Down page, Home and End
 * go to the bounds. Pressing the trough moves the thumb there, or pages with Shift.
 *
 * Signals: `value-change`.
 */
export declare class Slider extends AbstractSlider {
    /** @type {SliderMark[]} */
    _marks: SliderMark[];
    _formatter: Intl.NumberFormat;
    _wheelRemainder: number;
    _localeDisconnect: () => void;
    _valueAreaEl: Element;
    _sizerEls: Element[];
    _valueEl: Element;
    _marksEls: {
        before: Element;
        after: Element;
    };
    _troughEl: Element;
    _thumbEl: Element;
    marks: any[];
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Adds a mark along the trough.
     *
     * @param {number} value
     * @param {string} [position] One of `Position`: where the mark is drawn. `TOP` and `LEFT` are
     *     before the trough, `BOTTOM` and `RIGHT` after it. Defaults to `BOTTOM`.
     * @param {string | null} [label] Text shown at the mark.
     */
    addMark(value: number, position?: string, label?: string | null): void;
    /**
     * Removes all marks.
     */
    clearMarks(): void;
    /**
     * Formats a value for display. Override to show values differently.
     *
     * @param {number} value
     * @returns {string}
     */
    formatValue(value: number): string;
    destroy(): void;
    _setValueFromUser(value: any): void;
    _applyWheel(notches: any): void;
    _update(): void;
    _getMarkFraction(value: any): number;
    _renderMarks(): void;
    _updateMarkPositions(): void;
    _updateValuePosition(): void;
}

/** The declared properties of {@link Slider}. */
export interface Slider {
    canFocus: any;
    /**
     * The number of decimals of the value shown. Values set by the user are rounded to it. Use -1
     * to not round.
     */
    digits: number;
    /**
     * Whether the value is shown next to the thumb.
     */
    drawValue: boolean;
    /**
     * Where the value is shown: one of `Position`. On the sides along the trough it follows the
     * thumb.
     */
    valuePos: any;
    /**
     * Whether the trough is filled from the lower end up to the thumb.
     */
    hasOrigin: boolean;
}
