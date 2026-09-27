/**
 * @module data/validators/double-validator
 */

import { defineProperties } from '../../core/instance.js';
import { registerType } from '../../core/registry.js';
import { DoubleParser } from '../../i18n/double-parser.js';
import { translatePlural } from '../../i18n/translator.js';
import { NumberValidator } from './number-validator.js';

/**
 * Returns the number of decimals of a canonical number such as `'12.345'` or `'1.5e-3'`.
 *
 * @param {string} canonical
 * @returns {number}
 */
function countDecimals(canonical) {
    const [mantissa, exponent = '0'] = canonical.toLowerCase().split('e');
    const fraction = mantissa.split('.')[1] || '';

    return Math.max(0, fraction.replace(/0+$/, '').length - Number(exponent));
}

/**
 * Validates floating-point numbers in the locale (with its decimal and group separators, e.g.
 * `1,234.5` or `1.234,5`) with the {@link DoubleParser}, optionally within a range and with a
 * maximum number of decimals (`digits`).
 *
 * @example
 * const validator = new DoubleValidator({ minimum: 0, digits: 2 });
 * validator.validate('3.14'); // true
 * validator.validate('3.14159'); // false
 * validator.fixup('3.14159'); // '3.14'
 */
export class DoubleValidator extends NumberValidator {
    _createParser() {
        return new DoubleParser();
    }

    _hasValidPrecision(text) {
        if (this._digits === null) {
            return true;
        }

        this._parser.localeManager = this.effectiveLocaleManager;
        this._parser.lenient = this._lenient;

        return countDecimals(this._parser.normalize(text)) <= this._digits;
    }

    _round(value) {
        if (this._digits === null) {
            return value;
        }

        return Number(value.toFixed(this._digits));
    }

    _getFormatOptions() {
        return { maximumFractionDigits: this._digits ?? 20 };
    }

    _getDefaultMessage() {
        const message = this._getRangeMessage({
            any: 'Enter a number.',
            between: 'Enter a number from %s to %s.',
            minimum: 'Enter a number of at least %s.',
            maximum: 'Enter a number of at most %s.',
        });

        if (this._digits === null) {
            return message;
        }

        const decimals = translatePlural(
            'At most %d decimal is allowed.',
            'At most %d decimals are allowed.',
            this._digits
        );

        return `${message} ${decimals}`;
    }
}

defineProperties(DoubleValidator, {
    /**
     * The maximum number of decimals (fraction digits), or `null` (the default) for any number.
     * Named like the `digits` of a spin button.
     */
    digits: {
        value: null,
        coerce(digits) {
            if (digits === null || digits === undefined) {
                return null;
            }

            if (!Number.isInteger(digits) || digits < 0 || digits > 20) {
                throw new RangeError('The number of digits must be an integer from 0 to 20.');
            }

            return digits;
        },
        changed() {
            this._emitChange();
        },
    },

    /**
     * The same as `digits`.
     */
    decimals: {
        signal: false,
        get() {
            return this._digits;
        },
        set(decimals) {
            this.digits = decimals;

            return false;
        },
    },
});

registerType('double-validator', DoubleValidator);
