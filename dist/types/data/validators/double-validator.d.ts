/**
 * @module data/validators/double-validator
 */
import { DoubleParser } from '../../i18n/double-parser.js';
import { NumberValidator } from './number-validator.js';
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
export declare class DoubleValidator extends NumberValidator {
    _createParser(): DoubleParser;
    _hasValidPrecision(text: any): boolean;
    _round(value: any): any;
    _getFormatOptions(): {
        maximumFractionDigits: any;
    };
    _getDefaultMessage(): string;
}

/** The declared properties of {@link DoubleValidator}. */
export interface DoubleValidator {
    /**
     * The maximum number of decimals, or `null` (the default) for any number.
     */
    decimals: any;
}
