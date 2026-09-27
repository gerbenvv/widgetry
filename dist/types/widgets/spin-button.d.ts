/**
 * @module widgets/spin-button
 */
import { Adjustment } from '../data/adjustment.js';
import { LineEdit } from './line-edit.js';
/**
 * Parses a number typed in a locale: with the locale's decimal separator (or a period), optional
 * digit group separators and an optional sign.
 *
 * @param {string} text
 * @param {string} [locale] Defaults to the current locale.
 * @returns {number | null} The number, or `null` if the text is not a number.
 */
export declare function parseLocaleNumber(text: string, locale?: string): number | null;
/**
 * A numeric entry with steppers to increase and decrease its value.
 *
 * The value is kept in an `Adjustment`, which gives its bounds and increments. The text shows the
 * value with `digits` decimals and the locale's decimal separator. Typed text is applied when
 * Enter is pressed, when the spin button loses the focus or when it steps; text that is not a
 * number is then replaced by the current value again.
 *
 * Keyboard: Up and Down step, Page Up and Page Down step by a page. The wheel steps as well.
 * Holding a stepper repeats, faster over time with `climbRate`.
 *
 * Signals: `value-change`, `activate`, `change` (the text changed), `wrapped` (the value wrapped
 * around with `wrap`).
 */
export declare class SpinButton extends LineEdit {
    _adjustmentDisconnects: any[];
    _formatter: Intl.NumberFormat;
    _climbStep: any;
    _localeDisconnect: () => void;
    adjustment: Adjustment;
    _upEl: Element;
    _downEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Sets several properties, applying the bounds before the value so that it is not clamped to
     * the old bounds.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Increases the value by `stepIncrement`, or by `pageIncrement` with `page`.
     *
     * @param {boolean} [page]
     */
    stepUp(page?: boolean): void;
    /**
     * Decreases the value by `stepIncrement`, or by `pageIncrement` with `page`.
     *
     * @param {boolean} [page]
     */
    stepDown(page?: boolean): void;
    /**
     * Changes the value by an amount, applying typed text first, and wrapping around at the bounds
     * with `wrap`.
     *
     * @param {number} delta
     */
    spin(delta: number): void;
    /**
     * Applies typed text to the value. Text that is not a number is replaced by the current value.
     */
    update(): void;
    activate(): void;
    /**
     * Formats a value for display. Override to show values differently; `parseValue` must then
     * accept the result.
     *
     * @param {number} value
     * @returns {string}
     */
    formatValue(value: number): string;
    destroy(): void;
    _validate(text: any): boolean;
    _setValueFromUser(value: any): void;
    _updateText(): void;
    _updateAria(): void;
    _connectAdjustment(adjustment: any): void;
    _onStepperStep(direction: any, count: any): any;
    _onInputKeyDown(event: any): void;
    _onInputBlur(): void;
    _onBeforeInput(event: any): void;
    _onWheel(event: any): void;
}

/** The declared properties of {@link SpinButton}. */
export interface SpinButton {
    xAlign: any;
    /**
     * The value, forwarded to the adjustment.
     */
    value: any;
    /**
     * The minimum value, forwarded to the adjustment.
     */
    lower: any;
    /**
     * The maximum value, forwarded to the adjustment.
     */
    upper: any;
    /**
     * The step of the steppers and arrow keys, forwarded to the adjustment.
     */
    stepIncrement: any;
    /**
     * The step of Page Up and Page Down, forwarded to the adjustment.
     */
    pageIncrement: any;
    /**
     * The number of decimals shown. Values set by the user are rounded to it.
     */
    digits: number;
    /**
     * Whether only numeric characters can be typed.
     */
    numeric: any;
    /**
     * Whether stepping past a bound wraps around to the other bound.
     */
    wrap: boolean;
    /**
     * Whether values set by the user are rounded to the nearest step increment.
     */
    snapToTicks: any;
    /**
     * How much the step grows while a stepper is held, or 0 to always step by the step
     * increment.
     */
    climbRate: number;
}
