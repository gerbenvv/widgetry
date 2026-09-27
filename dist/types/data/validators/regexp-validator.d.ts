/**
 * @module data/validators/regexp-validator
 */
import { Validator } from './validator.js';
/**
 * Validates texts with a regular expression, which must match the whole text.
 *
 * @example
 * const validator = new RegexpValidator({ regexp: /[A-Z]{2}\d{4}/ });
 * validator.validate('AB1234'); // true
 * validator.validate('xAB1234'); // false
 */
export declare class RegexpValidator extends Validator {
    /** @type {RegExp | null} */
    _anchoredRegexp: RegExp | null;
    _initialize(): void;
    _validate(text: any): boolean;
    _getDefaultMessage(): string;
}

/** The declared properties of {@link RegexpValidator}. */
export interface RegexpValidator {
    /**
     * The regular expression, as a `RegExp` or a pattern string. It must match the whole text, so
     * it does not need `^` and `$`. The `g` and `y` flags are ignored.
     */
    regexp: any;
}
