/**
 * @module data/validators/validator
 */
import { LocaleAware } from '../../i18n/locale-aware.js';
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
export declare class Validator extends LocaleAware {
    connect(name: any, method: any, context: any): () => void;
    /**
     * Checks whether a text is valid.
     *
     * @param {string} text
     * @returns {boolean}
     * @throws {TypeError} If the text is not a string.
     */
    validate(text: string): boolean;
    /**
     * Checks whether a text is valid; the name of the original toolkit for
     * {@link Validator#validate}.
     *
     * @param {string} text
     * @returns {boolean}
     */
    isValid(text: string): boolean;
    /**
     * Normalizes a text, e.g. to the locale's notation of a number. The default returns the text
     * unchanged. The result is not necessarily valid.
     *
     * @param {string} text
     * @returns {string}
     * @throws {TypeError} If the text is not a string.
     */
    fixup(text: string): string;
    /**
     * Checks a non-empty text.
     *
     * @protected
     * @abstract
     * @param {string} _text
     * @returns {boolean}
     */
    protected _validate(_text: string): boolean;
    /**
     * Returns the message used when `message` is not set.
     *
     * @protected
     * @returns {string}
     */
    protected _getDefaultMessage(): string;
    _onEffectiveLocaleChange(): void;
    /**
     * Emits `change`. Used as the `changed` hook of properties that affect validation.
     *
     * @protected
     */
    protected _emitChange(): void;
}

/** The declared properties of {@link Validator}. */
export interface Validator {
    /**
     * Whether an empty (or whitespace-only) text is valid.
     */
    allowEmpty: boolean;
    /**
     * A description of the valid input, e.g. `'Enter a whole number.'`. By default a translated
     * message that fits the validator's settings; setting it overrides that, and setting `null`
     * restores it.
     */
    message: any;
}
