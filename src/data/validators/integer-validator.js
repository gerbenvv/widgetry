/**
 * @module data/validators/integer-validator
 */

import { registerType } from '../../core/registry.js';
import { IntegerParser } from '../../i18n/integer-parser.js';
import { NumberValidator } from './number-validator.js';

/**
 * Validates integers in the locale (with its group separator, e.g. `1,234` or `1.234`) with the
 * {@link IntegerParser}, optionally within a range.
 *
 * @example
 * const validator = new IntegerValidator({ minimum: 0, maximum: 100 });
 * validator.validate('42'); // true
 * validator.validate('4.5'); // false
 * validator.fixup('1000'); // '100'
 */
export class IntegerValidator extends NumberValidator {
    _createParser() {
        return new IntegerParser();
    }

    _getDefaultMessage() {
        return this._getRangeMessage({
            any: 'Enter a whole number.',
            between: 'Enter a whole number from %s to %s.',
            minimum: 'Enter a whole number of at least %s.',
            maximum: 'Enter a whole number of at most %s.',
        });
    }
}

registerType('integer-validator', IntegerValidator);
