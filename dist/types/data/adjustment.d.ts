/**
 * @module data/adjustment
 */
import { Instance } from '../core/instance.js';
/**
 * A bounded value with step and page increments and a page size, shared by scroll bars,
 * sliders, spin buttons and scroll areas.
 *
 * The value is kept between `lower` and `upper - pageSize`. Besides the property change signals,
 * the adjustment emits `change` whenever any of its values changed (once for `set()`), and
 * `value-change` when the value changed.
 *
 * @example
 * const adjustment = new Adjustment({ lower: 0, upper: 100, value: 75 });
 * const slider = new Slider({ adjustment });
 */
export declare class Adjustment extends Instance {
    _batch: number;
    _batchChanged: boolean;
    _value: any;
    _initialize(): void;
    /**
     * Sets several values at once, emitting `change` once.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * The largest value the adjustment can have: `upper - pageSize`, but at least `lower`.
     *
     * @type {number}
     */
    get maximum(): number;
    /**
     * Increases the value by `stepIncrement`.
     */
    increment(): void;
    /**
     * Decreases the value by `stepIncrement`.
     */
    decrement(): void;
    /**
     * Increases the value by `pageIncrement`.
     */
    incrementPage(): void;
    /**
     * Decreases the value by `pageIncrement`.
     */
    decrementPage(): void;
    /**
     * Changes the value as little as possible so that the range [`lower`, `upper`] is visible,
     * as far as it fits in the page. Used to scroll something into view.
     *
     * @param {number} lower
     * @param {number} upper
     */
    clampPage(lower: number, upper: number): void;
    _changed(): void;
    _clampValue(): void;
}

/** The declared properties of {@link Adjustment}. */
export interface Adjustment {
    /**
     * The value, clamped to [`lower`, `upper - pageSize`].
     */
    value: number;
    /**
     * The value as a fraction from 0 (at `lower`) to 1 (at `upper - pageSize`).
     */
    fraction: any;
    /**
     * The minimum value.
     */
    lower: number;
    /**
     * The maximum value. The value itself is at most `upper - pageSize`.
     */
    upper: number;
    /**
     * The small step, e.g. for arrow keys and scroll bar steppers.
     */
    stepIncrement: number;
    /**
     * The large step, e.g. for Page Up and Page Down.
     */
    pageIncrement: number;
    /**
     * The size of the visible page, for scrolling. Use 0 for plain values, such as in a slider.
     */
    pageSize: number;
}
