/**
 * @module data/validators/number-validator
 */

import { defineProperties } from '../../core/instance.js';
import { StringFormatter } from '../../i18n/string-formatter.js';
import { translate } from '../../i18n/translator.js';
import { Validator } from './validator.js';

function checkBound(bound) {
    if (bound === null || bound === undefined) {
        return null;
    }

    if (typeof bound !== 'number' || Number.isNaN(bound)) {
        throw new TypeError('A bound must be a number or null.');
    }

    return bound;
}

/**
 * Base class of {@link IntegerValidator} and {@link DoubleValidator}: validates numbers in the
 * locale with a number parser, within an optional range.
 */
export class NumberValidator extends Validator {
    _initialize() {
        super._initialize();

        this._parser = this._createParser();
        this._formatter = new StringFormatter();
    }

    /**
     * Parses a text to its number, if it is valid.
     *
     * @param {string} text
     * @returns {number | null} The number, or `null` if the text is not valid (or empty).
     */
    parse(text) {
        if (!this.validate(text) || !text.trim()) {
            return null;
        }

        return this._parseNumber(text);
    }

    /**
     * Rewrites a number in the locale's notation, limited to the range (and rounded, for
     * doubles). Texts that are no number are returned unchanged.
     *
     * @param {string} text
     * @returns {string}
     */
    fixup(text) {
        super.fixup(text);

        const value = this._parseNumber(text);
        if (value === null) {
            return text;
        }

        let fixed = this._round(value);
        if (this._minimum !== null && fixed < this._minimum) {
            fixed = this._minimum;
        }

        if (this._maximum !== null && fixed > this._maximum) {
            fixed = this._maximum;
        }

        return this._format(fixed);
    }

    _validate(text) {
        const value = this._parseNumber(text);

        return value !== null && this._isInRange(value) && this._hasValidPrecision(text);
    }

    _parseNumber(text) {
        this._parser.localeManager = this.effectiveLocaleManager;
        this._parser.lenient = this._lenient;

        return this._parser.parse(text);
    }

    _isInRange(value) {
        return (
            (this._minimum === null || value >= this._minimum) &&
            (this._maximum === null || value <= this._maximum)
        );
    }

    _hasValidPrecision(_text) {
        return true;
    }

    _round(value) {
        return value;
    }

    _format(value) {
        this._formatter.localeManager = this.effectiveLocaleManager;

        return this._formatter.formatNumber(value, this._getFormatOptions());
    }

    _formatBound(value) {
        this._formatter.localeManager = this.effectiveLocaleManager;

        return this._formatter.formatNumber(value, { maximumFractionDigits: 20 });
    }

    /**
     * Returns the message for a range: for the four combinations of bounds.
     *
     * @protected
     * @param {{any: string, between: string, minimum: string, maximum: string}} messages
     *     Untranslated messages, with `%s` placeholders for the bounds.
     * @returns {string}
     */
    _getRangeMessage(messages) {
        const minimum = this._minimum === null ? null : this._formatBound(this._minimum);
        const maximum = this._maximum === null ? null : this._formatBound(this._maximum);

        if (minimum !== null && maximum !== null) {
            return translate(messages.between, minimum, maximum);
        }

        if (minimum !== null) {
            return translate(messages.minimum, minimum);
        }

        if (maximum !== null) {
            return translate(messages.maximum, maximum);
        }

        return translate(messages.any);
    }

    /**
     * Creates the parser.
     *
     * @protected
     * @abstract
     * @returns {import('../../i18n/number-parser.js').NumberParser}
     */
    _createParser() {
        throw new Error(`${this.constructor.name} does not implement '_createParser'.`);
    }

    /**
     * Returns the `Intl.NumberFormat` options of `fixup()`.
     *
     * @protected
     * @returns {Intl.NumberFormatOptions}
     */
    _getFormatOptions() {
        return {};
    }
}

defineProperties(NumberValidator, {
    /**
     * The smallest valid number, or `null` for no minimum.
     */
    minimum: {
        value: null,
        coerce: checkBound,
        changed() {
            this._emitChange();
        },
    },

    /**
     * The largest valid number, or `null` for no maximum.
     */
    maximum: {
        value: null,
        coerce: checkBound,
        changed() {
            this._emitChange();
        },
    },

    /**
     * Whether the parser is lenient (see {@link NumberParser}): it ignores whitespace and accepts
     * swapped decimal and group separators.
     */
    lenient: {
        value: true,
        coerce: Boolean,
        changed() {
            this._emitChange();
        },
    },
});
