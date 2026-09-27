/**
 * @module i18n/integer-parser
 */
import { NumberParser } from './number-parser.js';
/**
 * The integer parser reads integers in the locale, e.g. `'1,234'` in English or `'1.234'` in
 * Dutch. Integers beyond the safe integer range of JavaScript are rejected. See
 * {@link NumberParser} for the rules.
 *
 * @example
 * new IntegerParser({ locale: 'de-DE' }).parse('1.234.567'); // 1234567
 * parseInteger('12.5'); // null
 */
export declare class IntegerParser extends NumberParser {
    _getRegExp(): RegExp;
    _toNumber(text: any): number;
}
/**
 * Returns the integer parser singleton, which follows the locale manager.
 *
 * @type {() => IntegerParser}
 */
export declare const getIntegerParser: () => IntegerParser;
/**
 * Parses an integer in the current locale with the singleton.
 *
 * @param {string} input
 * @returns {number | null}
 */
export declare function parseInteger(input: string): number | null;
