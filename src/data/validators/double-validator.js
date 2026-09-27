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
 * maximum number of decimals.
 *
 * @example
 * const validator = new DoubleValidator({ minimum: 0, decimals: 2 });
 * validator.validate('3.14'); // true
 * validator.validate('3.14159'); // false
 * validator.fixup('3.14159'); // '3.14'
 */
export class DoubleValidator extends NumberValidator {
    _createParser() {
        return new DoubleParser();
    }

    _hasValidPrecision(text) {
        if (this._decimals === null) {
            return true;
        }

        this._parser.localeManager = this.effectiveLocaleManager;
        this._parser.lenient = this._lenient;

        return countDecimals(this._parser.normalize(text)) <= this._decimals;
    }

    _round(value) {
        if (this._decimals === null) {
            return value;
        }

        return Number(value.toFixed(this._decimals));
    }

    _getFormatOptions() {
        return { maximumFractionDigits: this._decimals ?? 20 };
    }

    _getDefaultMessage() {
        const message = this._getRangeMessage({
            any: 'Enter a number.',
            between: 'Enter a number from %s to %s.',
            minimum: 'Enter a number of at least %s.',
            maximum: 'Enter a number of at most %s.',
        });

        if (this._decimals === null) {
            return message;
        }

        const decimals = translatePlural(
            'At most %d decimal is allowed.',
            'At most %d decimals are allowed.',
            this._decimals
        );

        return `${message} ${decimals}`;
    }
}

defineProperties(DoubleValidator, {
    /**
     * The maximum number of decimals, or `null` (the default) for any number.
     */
    decimals: {
        value: null,
        coerce(decimals) {
            if (decimals === null || decimals === undefined) {
                return null;
            }

            if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
                throw new RangeError('The number of decimals must be an integer from 0 to 20.');
            }

            return decimals;
        },
        changed() {
            this._emitChange();
        },
    },
});

registerType('double-validator', DoubleValidator);
