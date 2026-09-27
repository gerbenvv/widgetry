/**
 * @module data/validators/validator
 */

import { defineProperties } from '../../core/instance.js';
import { LocaleAware } from '../../i18n/locale-aware.js';
import { translate } from '../../i18n/translator.js';

/**
 * Base class of text validators, which line edits use to check their text. A validator checks a
 * whole text with `validate()`, can normalize a text with `fixup()`, and describes what it expects
 * in `message`, e.g. for a tooltip.
 *
 * Subclasses implement `_validate()`. Empty (or whitespace-only) texts are valid only when
 * `allowEmpty` is set.
 *
 * Signals: `change` when anything that affects validation changed (a property or the locale), so
 * texts should be validated again.
 */
export class Validator extends LocaleAware {
    connect(name, method, context) {
        const disconnect = super.connect(name, method, context);

        // Locale changes change the accepted separators and the message.
        if (name === 'change') {
            this._watchLocaleManager();
        }

        return disconnect;
    }

    /**
     * Checks whether a text is valid.
     *
     * @param {string} text
     * @returns {boolean}
     * @throws {TypeError} If the text is not a string.
     */
    validate(text) {
        if (typeof text !== 'string') {
            throw new TypeError('The text to validate must be a string.');
        }

        if (!text.trim()) {
            return this._allowEmpty;
        }

        return this._validate(text);
    }

    /**
     * Checks whether a text is valid; the name of the original toolkit for
     * {@link Validator#validate}.
     *
     * @param {string} text
     * @returns {boolean}
     */
    isValid(text) {
        return this.validate(text);
    }

    /**
     * Normalizes a text, e.g. to the locale's notation of a number. The default returns the text
     * unchanged. The result is not necessarily valid.
     *
     * @param {string} text
     * @returns {string}
     * @throws {TypeError} If the text is not a string.
     */
    fixup(text) {
        if (typeof text !== 'string') {
            throw new TypeError('The text to fix up must be a string.');
        }

        return text;
    }

    /**
     * Checks a non-empty text.
     *
     * @protected
     * @abstract
     * @param {string} _text
     * @returns {boolean}
     */
    _validate(_text) {
        throw new Error(`${this.constructor.name} does not implement '_validate'.`);
    }

    /**
     * Returns the message used when `message` is not set.
     *
     * @protected
     * @returns {string}
     */
    _getDefaultMessage() {
        return translate('The value is not valid.');
    }

    _onEffectiveLocaleChange() {
        super._onEffectiveLocaleChange();

        this.emit('change', this);
    }

    /**
     * Emits `change`. Used as the `changed` hook of properties that affect validation.
     *
     * @protected
     */
    _emitChange() {
        this.emit('change', this);
    }
}

defineProperties(Validator, {
    /**
     * Whether an empty (or whitespace-only) text is valid.
     */
    allowEmpty: {
        value: false,
        coerce: Boolean,
        changed() {
            this._emitChange();
        },
    },

    /**
     * A description of the valid input, e.g. `'Enter a whole number.'`. By default a translated
     * message that fits the validator's settings; setting it overrides that, and setting `null`
     * restores it.
     */
    message: {
        value: null,
        get() {
            return this._message ?? this._getDefaultMessage();
        },
        coerce(message) {
            if (message !== null && typeof message !== 'string') {
                throw new TypeError('The message must be a string or null.');
            }

            return message;
        },
    },
});
