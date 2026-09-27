/**
 * @module i18n/number-parser
 */
import { LocaleAware } from './locale-aware.js';
/**
 * Base class of {@link IntegerParser} and {@link DoubleParser}. A parser reads numbers as typed by
 * people: with the decimal and group separators of the locale (from the locale manager), in any of
 * the common digit sets and with either a hyphen or a minus sign. Group separators must be in the
 * right places (groups of three digits, or the Indian grouping), and the whole text must be a
 * number: `parse()` returns `null` for anything else.
 *
 * In lenient mode (the default, as in the original toolkit) whitespace between the digits is
 * ignored, and when the text is not a number with the locale's separators it is tried with the
 * decimal and group separators swapped, so `1,5` is also read as 1.5 in English. Strict mode
 * accepts only the locale's separators.
 */
export declare class NumberParser extends LocaleAware {
    /**
     * Parses a text to a number.
     *
     * @param {string} input
     * @returns {number | null} The number, or `null` if the text is not a valid number.
     * @throws {TypeError} If the input is not a string.
     */
    parse(input: string): number | null;
    /**
     * Checks whether a text is a valid number.
     *
     * @param {string} input
     * @returns {boolean}
     */
    isValid(input: string): boolean;
    /**
     * Converts a text to the canonical notation of JavaScript: without group separators, with a
     * period as decimal separator and Latin digits, e.g. `'-1234.5'` for `'-1.234,5'` in Dutch.
     *
     * @param {string} input
     * @returns {string | null} The canonical text, or `null` if the text is not a valid number.
     * @throws {TypeError} If the input is not a string.
     */
    normalize(input: string): string | null;
    _toCanonical(text: any, swap: any): any;
    /**
     * Returns the regular expression a canonical candidate (with `,` for groups and `.` as
     * decimal separator) must match.
     *
     * @protected
     * @abstract
     * @returns {RegExp}
     */
    protected _getRegExp(): RegExp;
    /**
     * Converts a canonical text to a number, or `null` if it is out of range.
     *
     * @protected
     * @abstract
     * @param {string} _text
     * @returns {number | null}
     */
    protected _toNumber(_text: string): number | null;
}
/**
 * The part of a pattern that matches the integer digits, either without group separators or
 * correctly grouped (in groups of three, or the Indian grouping of twos followed by a three).
 *
 * @type {string}
 */
export declare const INTEGER_DIGITS_PATTERN: string;

/** The declared properties of {@link NumberParser}. */
export interface NumberParser {
    /**
     * Whether whitespace is ignored and swapped decimal and group separators are accepted.
     */
    lenient: any;
}
