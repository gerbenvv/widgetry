/**
 * @module i18n/string-formatter
 */
import { LocaleAware } from './locale-aware.js';
/**
 * The string formatter formats strings like C's `sprintf`, with the syntax of the original toolkit
 * (which is PHP's): `%[argnum$][flags][width][.precision]specifier`.
 *
 * - `argnum$` picks an argument by number, starting at 1, e.g. `%2$s`. It does not consume an
 *   argument.
 * - Flags: `-` justifies left, `+` adds a plus sign to non-negative numbers, and `0`, a space or
 *   `'c` (any character `c`) set the padding character. Zeros are inserted after a sign.
 * - `width` is the minimum length; `precision` the number of decimals of `e`, `E`, `f`, `F`, `g`
 *   and `G`, or the maximum length of `s`.
 * - Specifiers: `%` (a percent sign), `b` (binary), `c` (the character with a code point), `d`
 *   (integer), `u` (integer without sign), `e`/`E` (scientific), `f` (fixed point, always with a
 *   period), `F` (fixed point in the locale: its decimal and group separators), `g`/`G` (the
 *   shorter of `f` and `e`), `o` (octal), `s` (string) and `x`/`X` (hexadecimal).
 *
 * A `%` that does not start a valid placeholder is copied as is.
 *
 * @example
 * getStringFormatter().format('%s has %d new messages.', 'Anna', 3);
 * getStringFormatter().format('%2$s, %1$s', 'world', 'Hello'); // 'Hello, world'
 * formatString('%08.3f', -3.14159); // '-003.142'
 */
export declare class StringFormatter extends LocaleAware {
    /**
     * Formats a string by replacing the placeholders in it.
     *
     * @param {string} format
     * @param {...unknown} args The arguments of the placeholders.
     * @returns {string}
     * @throws {TypeError} If the format is not a string.
     * @throws {RangeError} If an argument is missing.
     */
    format(format: string, ...args: unknown[]): string;
    /**
     * Formats a number in the locale, with its decimal and group separators (as set in the locale
     * manager) and digit grouping.
     *
     * @param {number | bigint} value
     * @param {Intl.NumberFormatOptions & {digits?: number, decimals?: number}} [options]
     *     `Intl.NumberFormat` options. `digits` is a shortcut for an exact number of fraction
     *     digits, and `decimals` is the same.
     * @returns {string}
     * @throws {TypeError} If the value is not a number.
     */
    formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions & {
        digits?: number;
        decimals?: number;
    }): string;
    _formatPlaceholder(argument: any, flags: any, width: any, precision: any, specifier: any): any;
    _pad(text: any, flags: any, width: any, specifier: any): any;
}
/**
 * Returns the string formatter singleton, which follows the locale manager.
 *
 * @type {() => StringFormatter}
 */
export declare const getStringFormatter: () => StringFormatter;
/**
 * Formats a string with {@link StringFormatter#format} of the singleton.
 *
 * @param {string} format
 * @param {...unknown} args
 * @returns {string}
 */
export declare function formatString(format: string, ...args: unknown[]): string;
/**
 * Formats a number in the current locale with {@link StringFormatter#formatNumber}.
 *
 * @example
 * formatNumber(1234.5); // '1,234.5' in English, '1.234,5' in Dutch
 * formatNumber(0.25, { style: 'percent' }); // '25%'
 * formatNumber(3, { digits: 2 }); // '3.00'
 *
 * @param {number | bigint} value
 * @param {Intl.NumberFormatOptions & {digits?: number, decimals?: number}} [options]
 * @returns {string}
 */
export declare function formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions & {
    digits?: number;
    decimals?: number;
}): string;
