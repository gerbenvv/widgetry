/**
 * @module data/validators/double-validator
 */
import { DoubleParser } from '../../i18n/double-parser.js';
import { NumberValidator } from './number-validator.js';
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
     * The maximum number of decimals (fraction digits), or `null` (the default) for any number.
     * Named like the `digits` of a spin button.
     */
    digits: any;
    /**
     * The same as `digits`.
     */
    decimals: any;
}
