/**
 * @module data/validators/integer-validator
 */
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
export declare class IntegerValidator extends NumberValidator {
    _createParser(): IntegerParser;
    _getDefaultMessage(): string;
}
