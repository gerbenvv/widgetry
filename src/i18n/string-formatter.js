/**
 * @module i18n/string-formatter
 */

import { lazySingleton } from '../core/instance.js';
import { getNumberFormat } from './intl-util.js';
import { LocaleAware } from './locale-aware.js';

/**
 * Matches a placeholder after its `%`: an optional argument number (`2$`), flags, a width, a
 * precision and the specifier.
 *
 * @type {RegExp}
 */
const PLACEHOLDER_REGEXP = /(?:(\d+)\$)?((?:[-+ 0]|'.)*)(\d+)?(?:\.(\d+))?([%bcdeEufFgGosxX])/uy;

/**
 * The specifiers that never get a plus sign.
 *
 * @type {Set<string>}
 */
const UNSIGNED_SPECIFIERS = new Set(['%', 'c', 's', 'F']);

/**
 * The specifiers whose value is uppercased.
 *
 * @type {Set<string>}
 */
const UPPERCASE_SPECIFIERS = new Set(['E', 'G', 'X']);

/**
 * The largest number of fraction digits `Intl.NumberFormat` shows when no precision is given.
 *
 * @type {number}
 */
const MAXIMUM_FRACTION_DIGITS = 20;

/**
 * Converts an argument to an integer (a number or a bigint).
 *
 * @param {unknown} value
 * @returns {number | bigint}
 */
function toInteger(value) {
    if (typeof value === 'bigint') {
        return value;
    }

    return Math.trunc(toFloat(value));
}

/**
 * Converts an argument to a floating-point number. Strings are parsed like `parseFloat`.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toFloat(value) {
    if (typeof value === 'string') {
        return parseFloat(value);
    }

    return Number(value);
}

function toAbsolute(value) {
    return typeof value === 'bigint' ? (value < 0n ? -value : value) : Math.abs(value);
}

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
export class StringFormatter extends LocaleAware {
    /**
     * Formats a string by replacing the placeholders in it.
     *
     * @param {string} format
     * @param {...unknown} args The arguments of the placeholders.
     * @returns {string}
     * @throws {TypeError} If the format is not a string.
     * @throws {RangeError} If an argument is missing.
     */
    format(format, ...args) {
        if (typeof format !== 'string') {
            throw new TypeError('The format must be a string.');
        }

        const output = [];

        let index = 0;
        let position = 0;
        while (position < format.length) {
            const percent = format.indexOf('%', position);
            if (percent < 0) {
                output.push(format.slice(position));
                break;
            }

            output.push(format.slice(position, percent));

            PLACEHOLDER_REGEXP.lastIndex = percent + 1;
            const matches = PLACEHOLDER_REGEXP.exec(format);
            if (!matches) {
                output.push('%');
                position = percent + 1;
                continue;
            }

            const [placeholder, argumentNumber, flags, width, precision, specifier] = matches;

            let argument;
            if (specifier !== '%') {
                let argumentIndex;
                if (argumentNumber === undefined) {
                    argumentIndex = index;
                    index += 1;
                } else {
                    argumentIndex = Number(argumentNumber) - 1;
                }

                if (argumentIndex < 0 || argumentIndex >= args.length) {
                    throw new RangeError(
                        `Missing argument ${argumentIndex + 1} for '%${placeholder}' in format ` +
                            `'${format}'.`
                    );
                }

                argument = args[argumentIndex];
            }

            output.push(
                this._formatPlaceholder(
                    argument,
                    flags,
                    width === undefined ? 0 : Number(width),
                    precision === undefined ? -1 : Number(precision),
                    specifier
                )
            );

            position = percent + 1 + placeholder.length;
        }

        return output.join('');
    }

    /**
     * Formats a number in the locale, with its decimal and group separators (as set in the locale
     * manager) and digit grouping.
     *
     * @param {number | bigint} value
     * @param {Intl.NumberFormatOptions & {decimals?: number}} [options] `Intl.NumberFormat`
     *     options. `decimals` is a shortcut for an exact number of fraction digits.
     * @returns {string}
     * @throws {TypeError} If the value is not a number.
     */
    formatNumber(value, options = {}) {
        if (typeof value !== 'number' && typeof value !== 'bigint') {
            throw new TypeError('The value must be a number.');
        }

        const { decimals, ...intlOptions } = options;
        if (decimals !== undefined) {
            if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
                throw new RangeError('The number of decimals must be an integer from 0 to 100.');
            }

            intlOptions.minimumFractionDigits = decimals;
            intlOptions.maximumFractionDigits = decimals;
        }

        const manager = this.effectiveLocaleManager;
        const parts = getNumberFormat(manager.locale, intlOptions).formatToParts(value);

        return parts
            .map((part) => {
                if (part.type === 'group') {
                    return manager.groupSeparator;
                }

                if (part.type === 'decimal') {
                    return manager.decimalSeparator;
                }

                return part.value;
            })
            .join('');
    }

    _formatPlaceholder(argument, flags, width, precision, specifier) {
        let text;
        switch (specifier) {
            case '%':
                text = '%';
                break;

            case 'b':
                text = toInteger(argument).toString(2);
                break;

            case 'c':
                text = String.fromCodePoint(Number(toInteger(argument)));
                break;

            case 'd':
                text = String(toInteger(argument));
                break;

            case 'u':
                text = String(toAbsolute(toInteger(argument)));
                break;

            case 'e':
            case 'E': {
                const value = toFloat(argument);
                text = precision >= 0 ? value.toExponential(precision) : value.toExponential();
                break;
            }

            case 'f': {
                const value = toFloat(argument);
                text = precision >= 0 ? value.toFixed(precision) : String(value);
                break;
            }

            case 'F': {
                const value = toFloat(argument);
                text = this.formatNumber(value, {
                    minimumFractionDigits: precision >= 0 ? precision : 0,
                    maximumFractionDigits: precision >= 0 ? precision : MAXIMUM_FRACTION_DIGITS,
                    signDisplay: flags.includes('+') ? 'always' : 'auto',
                });
                break;
            }

            case 'g':
            case 'G': {
                // Use the shorter of the fixed-point and the scientific notation.
                const value = toFloat(argument);
                const fixed = precision >= 0 ? value.toFixed(precision) : String(value);
                const exponential =
                    precision >= 0 ? value.toExponential(precision) : value.toExponential();

                text = fixed.length <= exponential.length ? fixed : exponential;
                break;
            }

            case 'o':
                text = toInteger(argument).toString(8);
                break;

            case 's':
                text = String(argument);
                if (precision >= 0) {
                    text = Array.from(text).slice(0, precision).join('');
                }
                break;

            case 'x':
            case 'X':
                text = toInteger(argument).toString(16);
                break;
        }

        if (
            flags.includes('+') &&
            !UNSIGNED_SPECIFIERS.has(specifier) &&
            !text.startsWith('-') &&
            text !== 'NaN'
        ) {
            text = '+' + text;
        }

        if (UPPERCASE_SPECIFIERS.has(specifier)) {
            text = text.toUpperCase();
        }

        return this._pad(text, flags, width, specifier);
    }

    _pad(text, flags, width, specifier) {
        const length = Array.from(text).length;
        if (width <= length) {
            return text;
        }

        // The last padding flag wins; `'c` sets any character.
        let paddingCharacter = ' ';
        for (const flag of flags.match(/'.|[ 0]/gu) || []) {
            paddingCharacter = flag.length > 1 ? Array.from(flag)[1] : flag;
        }

        const padding = paddingCharacter.repeat(width - length);

        if (flags.includes('-')) {
            return text + padding;
        }

        // Zeros go between the sign and the digits, as in C.
        const numeric = !['%', 'c', 's'].includes(specifier);
        if (paddingCharacter === '0' && numeric && /^[-+\u2212]/.test(text)) {
            return text[0] + padding + text.slice(1);
        }

        return padding + text;
    }
}

/**
 * Returns the string formatter singleton, which follows the locale manager.
 *
 * @type {() => StringFormatter}
 */
export const getStringFormatter = lazySingleton(() => new StringFormatter());

/**
 * Formats a string with {@link StringFormatter#format} of the singleton.
 *
 * @param {string} format
 * @param {...unknown} args
 * @returns {string}
 */
export function formatString(format, ...args) {
    return getStringFormatter().format(format, ...args);
}

/**
 * Formats a number in the current locale with {@link StringFormatter#formatNumber}.
 *
 * @example
 * formatNumber(1234.5); // '1,234.5' in English, '1.234,5' in Dutch
 * formatNumber(0.25, { style: 'percent' }); // '25%'
 * formatNumber(3, { decimals: 2 }); // '3.00'
 *
 * @param {number | bigint} value
 * @param {Intl.NumberFormatOptions & {decimals?: number}} [options]
 * @returns {string}
 */
export function formatNumber(value, options) {
    return getStringFormatter().formatNumber(value, options);
}
