/**
 * @module data/validators/number-validator
 */
import { StringFormatter } from '../../i18n/string-formatter.js';
import { Validator } from './validator.js';
/**
 * Base class of {@link IntegerValidator} and {@link DoubleValidator}: validates numbers in the
 * locale with a number parser, within an optional range.
 */
export declare class NumberValidator extends Validator {
    _parser: import("../../index.js").NumberParser;
    _formatter: StringFormatter;
    _initialize(): void;
    /**
     * Parses a text to its number, if it is valid.
     *
     * @param {string} text
     * @returns {number | null} The number, or `null` if the text is not valid (or empty).
     */
    parse(text: string): number | null;
    /**
     * Rewrites a number in the locale's notation, limited to the range (and rounded, for
     * doubles). Texts that are no number are returned unchanged.
     *
     * @param {string} text
     * @returns {string}
     */
    fixup(text: string): string;
    _validate(text: any): boolean;
    _parseNumber(text: any): number;
    _isInRange(value: any): boolean;
    _hasValidPrecision(_text: any): boolean;
    _round(value: any): any;
    _format(value: any): string;
    _formatBound(value: any): string;
    /**
     * Returns the message for a range: for the four combinations of bounds.
     *
     * @protected
     * @param {{any: string, between: string, minimum: string, maximum: string}} messages
     *     Untranslated messages, with `%s` placeholders for the bounds.
     * @returns {string}
     */
    protected _getRangeMessage(messages: {
        any: string;
        between: string;
        minimum: string;
        maximum: string;
    }): string;
    /**
     * Creates the parser.
     *
     * @protected
     * @abstract
     * @returns {import('../../i18n/number-parser.js').NumberParser}
     */
    protected _createParser(): import('../../i18n/number-parser.js').NumberParser;
    /**
     * Returns the `Intl.NumberFormat` options of `fixup()`.
     *
     * @protected
     * @returns {Intl.NumberFormatOptions}
     */
    protected _getFormatOptions(): Intl.NumberFormatOptions;
}

/** The declared properties of {@link NumberValidator}. */
export interface NumberValidator {
    /**
     * The smallest valid number, or `null` for no minimum.
     */
    minimum: any;
    /**
     * The largest valid number, or `null` for no maximum.
     */
    maximum: any;
    /**
     * Whether the parser is lenient (see {@link NumberParser}): it ignores whitespace and accepts
     * swapped decimal and group separators.
     */
    lenient: boolean;
}
