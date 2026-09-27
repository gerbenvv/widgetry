/**
 * @module data/validators/regexp-validator
 */

import { defineProperties } from '../../core/instance.js';
import { registerType } from '../../core/registry.js';
import { translate } from '../../i18n/translator.js';
import { Validator } from './validator.js';

/**
 * Validates texts with a regular expression, which must match the whole text.
 *
 * @example
 * const validator = new RegexpValidator({ regexp: /[A-Z]{2}\d{4}/ });
 * validator.validate('AB1234'); // true
 * validator.validate('xAB1234'); // false
 */
export class RegexpValidator extends Validator {
    _initialize() {
        super._initialize();

        /** @type {RegExp | null} */
        this._anchoredRegexp = null;
    }

    _validate(text) {
        if (!this._anchoredRegexp) {
            throw new Error('The regular expression validator has no regular expression.');
        }

        return this._anchoredRegexp.test(text);
    }

    _getDefaultMessage() {
        return translate('The text does not have the right format.');
    }
}

defineProperties(RegexpValidator, {
    /**
     * The regular expression, as a `RegExp` or a pattern string. It must match the whole text, so
     * it does not need `^` and `$`. The `g` and `y` flags are ignored.
     */
    regexp: {
        value: null,
        coerce(regexp) {
            if (regexp === null || regexp instanceof RegExp) {
                return regexp;
            }

            if (typeof regexp !== 'string') {
                throw new TypeError('The regular expression must be a RegExp, a string or null.');
            }

            return new RegExp(regexp);
        },
        changed(regexp) {
            this._anchoredRegexp = regexp
                ? new RegExp(`^(?:${regexp.source})$`, regexp.flags.replace(/[gy]/g, ''))
                : null;

            this._emitChange();
        },
    },
});

registerType('regexp-validator', RegexpValidator);
