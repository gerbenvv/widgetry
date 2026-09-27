/**
 * @module i18n/double-parser
 */
import { NumberParser } from './number-parser.js';
/**
 * The double parser reads floating-point numbers in the locale, e.g. `'1,234.5'` in English or
 * `'1.234,5'` in Dutch. Numbers that overflow to infinity are rejected. See {@link NumberParser}
 * for the rules.
 *
 * @example
 * new DoubleParser({ locale: 'nl-NL' }).parse('−1.234,5'); // -1234.5
 * parseDouble('abc'); // null
 */
export declare class DoubleParser extends NumberParser {
    _getRegExp(): RegExp;
    _toNumber(text: any): number;
}
/**
 * Returns the double parser singleton, which follows the locale manager.
 *
 * @type {() => DoubleParser}
 */
export declare const getDoubleParser: () => DoubleParser;
/**
 * Parses a floating-point number in the current locale with the singleton.
 *
 * @param {string} input
 * @returns {number | null}
 */
export declare function parseDouble(input: string): number | null;
