/**
 * @module i18n/number-parser
 */

import { defineProperties } from '../core/instance.js';
import { escapeRegExp } from '../core/util.js';
import { LocaleAware } from './locale-aware.js';

/**
 * The code points of the digit zero of the non-Latin digit sets that are accepted in input:
 * Arabic-Indic, extended Arabic-Indic (Persian), Devanagari, Bengali, Thai and full-width digits.
 *
 * @type {number[]}
 */
const ZERO_CODE_POINTS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50, 0xff10];

/**
 * Matches the digits of {@link ZERO_CODE_POINTS}.
 *
 * @type {RegExp}
 */
const NON_LATIN_DIGIT_REGEXP = new RegExp(
    `[${ZERO_CODE_POINTS.map((zero) => `\\u{${zero.toString(16)}}-\\u{${(zero + 9).toString(16)}}`).join('')}]`,
    'gu'
);

/**
 * Minus signs other than the hyphen-minus: the Unicode minus sign, the full-width hyphen-minus and
 * the small hyphen-minus.
 *
 * @type {RegExp}
 */
const MINUS_REGEXP = /[\u2212\uff0d\ufe63]/g;

/**
 * Matches whitespace, including the no-break spaces used as group separators.
 *
 * @type {RegExp}
 */
const WHITESPACE_REGEXP = /\s+/gu;

/**
 * Stand-ins for the separators while they are being swapped. They are control characters, which
 * cannot occur in the digits.
 *
 * @type {{group: string, decimal: string}}
 */
const PLACEHOLDERS = { group: '\u0001', decimal: '\u0002' };

function toLatinDigits(text) {
    return text.replace(NON_LATIN_DIGIT_REGEXP, (digit) => {
        const code = digit.codePointAt(0);
        const zero = ZERO_CODE_POINTS.find((x) => code >= x && code <= x + 9);

        return String(code - zero);
    });
}

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
export class NumberParser extends LocaleAware {
    /**
     * Parses a text to a number.
     *
     * @param {string} input
     * @returns {number | null} The number, or `null` if the text is not a valid number.
     * @throws {TypeError} If the input is not a string.
     */
    parse(input) {
        const normalized = this.normalize(input);

        return normalized === null ? null : this._toNumber(normalized);
    }

    /**
     * Checks whether a text is a valid number.
     *
     * @param {string} input
     * @returns {boolean}
     */
    isValid(input) {
        return this.parse(input) !== null;
    }

    /**
     * Converts a text to the canonical notation of JavaScript: without group separators, with a
     * period as decimal separator and Latin digits, e.g. `'-1234.5'` for `'-1.234,5'` in Dutch.
     *
     * @param {string} input
     * @returns {string | null} The canonical text, or `null` if the text is not a valid number.
     * @throws {TypeError} If the input is not a string.
     */
    normalize(input) {
        if (typeof input !== 'string') {
            throw new TypeError('The input must be a string.');
        }

        const manager = this.effectiveLocaleManager;
        const group = manager.groupSeparator;
        const decimal = manager.decimalSeparator;

        let text = toLatinDigits(input.trim()).replace(MINUS_REGEXP, '-');

        // Whitespace can only be a group separator, when the locale uses a space for that.
        if (/^\s$/u.test(group)) {
            text = text.replace(WHITESPACE_REGEXP, PLACEHOLDERS.group);
        } else if (this._lenient) {
            text = text.replace(WHITESPACE_REGEXP, '');
        }

        // Accept an ASCII apostrophe for the right single quotation mark used in Switzerland.
        if (group === '\u2019') {
            text = text.replace(/'/g, PLACEHOLDERS.group);
        }

        text = text
            .replace(new RegExp(escapeRegExp(group), 'g'), PLACEHOLDERS.group)
            .replace(new RegExp(escapeRegExp(decimal), 'g'), PLACEHOLDERS.decimal);

        const canonical = this._toCanonical(text, false);
        if (canonical !== null) {
            return canonical;
        }

        if (!this._lenient) {
            return null;
        }

        // Try the other convention, with the decimal and group separators swapped.
        return this._toCanonical(text, true);
    }

    _toCanonical(text, swap) {
        // Separators other than the locale's are kept, so a period is a decimal separator and a
        // comma a group separator, unless swapped.
        let candidate = text
            .replaceAll(PLACEHOLDERS.group, ',')
            .replaceAll(PLACEHOLDERS.decimal, '.');
        if (swap) {
            candidate = candidate.replace(/[.,]/g, (x) => (x === '.' ? ',' : '.'));
        }

        // In strict mode only the locale's own separators are allowed.
        if (!this._lenient && /[.,]/.test(text)) {
            return null;
        }

        if (!this._getRegExp().test(candidate)) {
            return null;
        }

        return candidate.replace(/,/g, '');
    }

    /**
     * Returns the regular expression a canonical candidate (with `,` for groups and `.` as
     * decimal separator) must match.
     *
     * @protected
     * @abstract
     * @returns {RegExp}
     */
    _getRegExp() {
        throw new Error(`${this.constructor.name} does not implement '_getRegExp'.`);
    }

    /**
     * Converts a canonical text to a number, or `null` if it is out of range.
     *
     * @protected
     * @abstract
     * @param {string} _text
     * @returns {number | null}
     */
    _toNumber(_text) {
        throw new Error(`${this.constructor.name} does not implement '_toNumber'.`);
    }
}

defineProperties(NumberParser, {
    /**
     * Whether whitespace is ignored and swapped decimal and group separators are accepted.
     */
    lenient: { value: true, coerce: Boolean },
});

/**
 * The part of a pattern that matches the integer digits, either without group separators or
 * correctly grouped (in groups of three, or the Indian grouping of twos followed by a three).
 *
 * @type {string}
 */
export const INTEGER_DIGITS_PATTERN = '(?:\\d+|\\d{1,3}(?:,\\d{3})+|\\d{1,2}(?:,\\d{2})+,\\d{3})';
