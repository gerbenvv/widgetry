/**
 * @module i18n/translated-text
 */
import { Instance } from '../core/instance.js';
/**
 * A translated text: an identifier and arguments whose `text` is the translation in the current
 * language. A translated text is immutable, but its `text` changes with the language (or the
 * dictionaries), and then it emits `text-change`. Widgets can take one wherever they take a text,
 * and `String(text)` gives the current translation.
 *
 * The translated text only listens to the translator while handlers are connected to
 * `text-change`, so unused translated texts can be garbage collected.
 *
 * @example
 * const text = __('Hello, %s!', 'Anna');
 * text.connect('text-change', () => label.text = text.text);
 *
 * const files = new TranslatedText({ id: '%d file', plural: '%d files', arguments: [3] });
 */
export declare class TranslatedText extends Instance {
    /** @type {(() => void) | null} */
    _disconnectTranslator: (() => void) | null;
    /** @type {string | null} */
    _lastText: string | null;
    _initialize(): void;
    connect(name: any, method: any, context: any): any;
    connectFirst(name: any, method: any, context: any): any;
    connectLast(name: any, method: any, context: any): any;
    disconnect(name: any, method: any, context: any): void;
    /**
     * Returns the translation.
     *
     * @returns {string}
     */
    toString(): string;
    /**
     * Returns the translation, so a translated text serializes as its text.
     *
     * @returns {string}
     */
    toJSON(): string;
    destroy(): void;
    _getTranslator(): any;
    _watch(name: any, disconnect: any): any;
    _unwatchIfUnused(): void;
    _onTranslatorChange(): void;
}
/**
 * Creates a translated text, like the original toolkit's `__` shortcut:
 * `__('some-identifier', firstArgument, secondArgument)`.
 *
 * @param {string} id
 * @param {...unknown} args
 * @returns {TranslatedText}
 */
export declare function __(id: string, ...args: unknown[]): TranslatedText;
/**
 * Creates a translated text with singular and plural forms, e.g. `__n('%d file', '%d files', 3)`.
 *
 * @param {string} singular
 * @param {string} plural
 * @param {number} count
 * @param {...unknown} args
 * @returns {TranslatedText}
 */
export declare function __n(singular: string, plural: string, count: number, ...args: unknown[]): TranslatedText;

/** The declared properties of {@link TranslatedText}. */
export interface TranslatedText {
    /**
     * The identifier of the text, used to look up the translation: a key or the source text. It
     * can only be set once.
     */
    id: any;
    /**
     * The source text of the plural form, or `null`. When set, `id` is the singular form and the
     * first argument is the count, as in {@link Translator#translatePlural}. It can only be set
     * once.
     */
    plural: any;
    /**
     * The arguments of the placeholders in the text. It can only be set once.
     */
    arguments: any;
    /**
     * The translator to use, or `null` (the default) for the singleton.
     */
    translator: any;
    /**
     * The translated text in the current language.
     */
    readonly text: any;
}
