/**
 * @module i18n/double-parser
 */

import { lazySingleton } from '../core/instance.js';
import { INTEGER_DIGITS_PATTERN, NumberParser } from './number-parser.js';

/**
 * Matches a canonical floating-point number: an optional sign, digits with an optional fraction
 * (or only a fraction, like `.5`) and an optional exponent, as in the original toolkit.
 *
 * @type {RegExp}
 */
const DOUBLE_REGEXP = new RegExp(
    `^[+-]?(?:${INTEGER_DIGITS_PATTERN}(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?$`
);

/**
 * The double parser reads floating-point numbers in the locale, e.g. `'1,234.5'` in English or
 * `'1.234,5'` in Dutch. Numbers that overflow to infinity are rejected. See {@link NumberParser}
 * for the rules.
 *
 * @example
 * new DoubleParser({ locale: 'nl-NL' }).parse('−1.234,5'); // -1234.5
 * parseDouble('abc'); // null
 */
export class DoubleParser extends NumberParser {
    _getRegExp() {
        return DOUBLE_REGEXP;
    }

    _toNumber(text) {
        const value = Number(text);

        return Number.isFinite(value) ? value : null;
    }
}

/**
 * Returns the double parser singleton, which follows the locale manager.
 *
 * @type {() => DoubleParser}
 */
export const getDoubleParser = lazySingleton(() => new DoubleParser());

/**
 * Parses a floating-point number in the current locale with the singleton.
 *
 * @param {string} input
 * @returns {number | null}
 */
export function parseDouble(input) {
    return getDoubleParser().parse(input);
}
