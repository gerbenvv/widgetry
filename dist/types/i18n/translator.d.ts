/**
 * @module i18n/translator
 */
import { LocaleAware } from './locale-aware.js';
import { StringFormatter } from './string-formatter.js';
export type TranslationEntry = string | Record<string, string>;
/**
 * The translator translates texts to the language of the locale. It holds a dictionary of
 * translations (entries) per language, where an entry maps an identifier to a translation. The
 * identifier can be a key (`'file.open'`) or the source text itself (`'Open file'`), and a text
 * without translation falls back to the identifier.
 *
 * Translations are formatted with the {@link StringFormatter}, so they can contain placeholders
 * such as `%s`, `%d` and `%1$s` (to reorder arguments). Like gettext, a text translated without
 * arguments is not formatted, so it can contain a plain `%` (and `%%` stays as it is). A translation can also have plural forms,
 * chosen with `Intl.PluralRules` of its language by the first argument:
 *
 * ```js
 * translator.addEntries({ 'Open': 'Openen', '%d files': { one: '%d bestand', other: '%d bestanden' } }, 'nl');
 * translator.translate('%d files', 1); // '1 bestand' when the language is Dutch
 * ```
 *
 * Entries are looked up for the locale (`'nl-BE'`), then its language (`'nl'`), and then the
 * `fallbackLanguage`. A `loader` can load dictionaries on demand.
 *
 * Signals: `language-change` (when the locale changed), `entries-change` (`translator, language`),
 * `change` (after either of them, when translations may have changed), `load-entries`
 * (`translator, language`, before the loader is called) and `load-error`
 * (`translator, language, error`).
 */
export declare class Translator extends LocaleAware {
    /** @type {Map<string, Record<string, TranslationEntry>>} */
    _dictionaries: Map<string, Record<string, TranslationEntry>>;
    /** @type {Set<string>} */
    _requestedLanguages: Set<string>;
    /** @type {Map<string, Promise<void>>} */
    _pendingLoads: Map<string, Promise<void>>;
    _formatter: StringFormatter;
    _initialize(): void;
    /**
     * The languages of the loaded dictionaries.
     *
     * @type {string[]}
     */
    get languages(): string[];
    /**
     * Gets a translation with its placeholders replaced, like the original toolkit's `getEntry`.
     *
     * @param {string} id The identifier: a key or the source text.
     * @param {unknown[]} [args] The arguments of the placeholders. The first one chooses the
     *     plural form.
     * @returns {string} The translation, or the identifier if there is none.
     */
    getEntry(id: string, args?: unknown[]): string;
    /**
     * Translates a text.
     *
     * @param {string} id
     * @param {...unknown} args
     * @returns {string}
     */
    translate(id: string, ...args: unknown[]): string;
    /**
     * Translates a text with a singular and a plural form, like gettext's `ngettext`. The
     * translation of `singular` (which should have plural forms) is used; without one, `singular`
     * is used for a count of 1 and `plural` otherwise. The count is the first argument of the
     * placeholders.
     *
     * @param {string} singular
     * @param {string} plural
     * @param {number} count
     * @param {...unknown} args More arguments.
     * @returns {string}
     */
    translatePlural(singular: string, plural: string, count: number, ...args: unknown[]): string;
    /**
     * Checks whether there is a translation for an identifier in the current language chain.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasEntry(id: string): boolean;
    /**
     * Adds entries to the dictionary of a language, replacing entries with the same identifier.
     *
     * @param {Record<string, TranslationEntry>} entries
     * @param {string} [language] A language or locale tag. Defaults to the current language.
     * @throws {TypeError} If the entries are malformed.
     */
    addEntries(entries: Record<string, TranslationEntry>, language?: string): void;
    /**
     * Removes the dictionary of a language.
     *
     * @param {string} language
     */
    removeEntries(language: string): void;
    /**
     * Returns a promise that settles when the dictionaries being loaded by the `loader` are
     * loaded. It rejects if one failed to load.
     *
     * @returns {Promise<void>}
     */
    whenLoaded(): Promise<void>;
    _onEffectiveLocaleChange(): void;
    /**
     * Returns the tags that are searched for entries, most specific first.
     *
     * @returns {string[]}
     */
    _getLanguageChain(): string[];
    _lookup(id: any): {
        entry: TranslationEntry;
        language: string;
    };
    _choosePluralForm(entry: any, language: any, count: any): any;
    _format(text: any, args: any): any;
    _requestDictionaries(): void;
}
/**
 * Returns the translator singleton, which follows the locale manager.
 *
 * @type {() => Translator}
 */
export declare const getTranslator: () => Translator;
/**
 * Translates a text with the singleton, e.g. `tr('Hello, %s!', name)`.
 *
 * @param {string} id
 * @param {...unknown} args
 * @returns {string}
 */
export declare function translate(id: string, ...args: unknown[]): string;
/**
 * A short alias of {@link translate}.
 *
 * @type {typeof translate}
 */
export declare const tr: typeof translate;
/**
 * Translates a text with singular and plural forms with the singleton, e.g.
 * `trn('%d file', '%d files', count)`.
 *
 * @param {string} singular
 * @param {string} plural
 * @param {number} count
 * @param {...unknown} args
 * @returns {string}
 */
export declare function translatePlural(singular: string, plural: string, count: number, ...args: unknown[]): string;
/**
 * A short alias of {@link translatePlural}.
 *
 * @type {typeof translatePlural}
 */
export declare const trn: typeof translatePlural;

/** The declared properties of {@link Translator}. */
export interface Translator {
    /**
     * The dictionary of the current language (as in `getLocaleManager().language`). Setting it
     * replaces that dictionary. Do not modify the returned object; use `addEntries()`.
     */
    entries: any;
    /**
     * The language to use when the current language has no translation, e.g. `'en'` when
     * identifiers are keys and the English dictionary has the source texts. `null` (the default)
     * falls back to the identifier.
     */
    fallbackLanguage: any;
    /**
     * A function that loads the dictionary of a language on demand: `(language) => entries`, where
     * the result may also be a promise, or `null` for no dictionary. It is called once per
     * language (and locale tag) that is needed, such as `'nl-BE'` and `'nl'`.
     */
    loader: any;
}
