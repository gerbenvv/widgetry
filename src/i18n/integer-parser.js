/**
 * @module i18n/integer-parser
 */

import { lazySingleton } from '../core/instance.js';
import { INTEGER_DIGITS_PATTERN, NumberParser } from './number-parser.js';

/**
 * Matches a canonical integer: an optional sign, the digits and an optional positive exponent
 * (so `1e3` is the integer 1000), as in the original toolkit.
 *
 * @type {RegExp}
 */
const INTEGER_REGEXP = new RegExp(`^[+-]?${INTEGER_DIGITS_PATTERN}(?:[eE]\\+?\\d+)?$`);

/**
 * The integer parser reads integers in the locale, e.g. `'1,234'` in English or `'1.234'` in
 * Dutch. Integers beyond the safe integer range of JavaScript are rejected. See
 * {@link NumberParser} for the rules.
 *
 * @example
 * new IntegerParser({ locale: 'de-DE' }).parse('1.234.567'); // 1234567
 * parseInteger('12.5'); // null
 */
export class IntegerParser extends NumberParser {
    _getRegExp() {
        return INTEGER_REGEXP;
    }

    _toNumber(text) {
        const value = Number(text);

        // Normalize negative zero.
        return Number.isSafeInteger(value) ? value + 0 : null;
    }
}

/**
 * Returns the integer parser singleton, which follows the locale manager.
 *
 * @type {() => IntegerParser}
 */
export const getIntegerParser = lazySingleton(() => new IntegerParser());

/**
 * Parses an integer in the current locale with the singleton.
 *
 * @param {string} input
 * @returns {number | null}
 */
export function parseInteger(input) {
    return getIntegerParser().parse(input);
}
