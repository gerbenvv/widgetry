/**
 * @module i18n/translator
 */

import { defineProperties, lazySingleton } from '../core/instance.js';
import { getPluralRules } from './intl-util.js';
import { LocaleAware } from './locale-aware.js';
import { StringFormatter } from './string-formatter.js';

/**
 * The plural categories of `Intl.PluralRules`.
 *
 * @type {Set<string>}
 */
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

/**
 * The language whose plural rules choose between the singular and the plural source text when
 * there is no translation.
 *
 * @type {string}
 */
const SOURCE_LANGUAGE = 'en';

/**
 * @typedef {string | Record<string, string>} TranslationEntry A translation, or its plural forms
 *     keyed by plural category (`zero`, `one`, `two`, `few`, `many`, `other`) or exact count
 *     (`'=0'`).
 */

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function checkEntry(id, entry) {
    if (typeof entry === 'string') {
        return;
    }

    if (!isPlainObject(entry)) {
        throw new TypeError(`The translation of '${id}' must be a string or an object.`);
    }

    for (const [key, form] of Object.entries(entry)) {
        if (!PLURAL_CATEGORIES.has(key) && !/^=\d+$/.test(key)) {
            throw new TypeError(`Invalid plural form '${key}' in the translation of '${id}'.`);
        }

        if (typeof form !== 'string') {
            throw new TypeError(`The plural forms of '${id}' must be strings.`);
        }
    }

    if (entry.other === undefined) {
        throw new TypeError(`The translation of '${id}' has no 'other' plural form.`);
    }
}

function canonicalizeLanguage(language) {
    if (typeof language !== 'string' || !language) {
        throw new TypeError('The language must be a non-empty string.');
    }

    return Intl.getCanonicalLocales(language.replace(/_/g, '-'))[0];
}

/**
 * Returns a tag and its less specific forms, e.g. `['zh-Hant-TW', 'zh-Hant', 'zh']`.
 *
 * @param {string} tag
 * @returns {string[]}
 */
function getTagChain(tag) {
    const subtags = tag.split('-');

    return subtags.map((_x, i) => subtags.slice(0, subtags.length - i).join('-'));
}

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
export class Translator extends LocaleAware {
    _initialize() {
        super._initialize();

        /** @type {Map<string, Record<string, TranslationEntry>>} */
        this._dictionaries = new Map();

        /** @type {Set<string>} */
        this._requestedLanguages = new Set();

        /** @type {Map<string, Promise<void>>} */
        this._pendingLoads = new Map();

        this._formatter = new StringFormatter();

        this._watchLocaleManager();
    }

    /**
     * The languages of the loaded dictionaries.
     *
     * @type {string[]}
     */
    get languages() {
        return [...this._dictionaries.keys()];
    }

    /**
     * Gets a translation with its placeholders replaced, like the original toolkit's `getEntry`.
     *
     * @param {string} id The identifier: a key or the source text.
     * @param {unknown[]} [args] The arguments of the placeholders. The first one chooses the
     *     plural form.
     * @returns {string} The translation, or the identifier if there is none.
     */
    getEntry(id, args = []) {
        if (typeof id !== 'string') {
            throw new TypeError('The identifier must be a string.');
        }

        if (!Array.isArray(args)) {
            throw new TypeError('The arguments must be an array.');
        }

        const found = this._lookup(id);
        if (!found) {
            return this._format(id, args);
        }

        return this._format(this._choosePluralForm(found.entry, found.language, args[0]), args);
    }

    /**
     * Translates a text.
     *
     * @param {string} id
     * @param {...unknown} args
     * @returns {string}
     */
    translate(id, ...args) {
        return this.getEntry(id, args);
    }

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
    translatePlural(singular, plural, count, ...args) {
        if (typeof singular !== 'string' || typeof plural !== 'string') {
            throw new TypeError('The singular and plural texts must be strings.');
        }

        if (typeof count !== 'number') {
            throw new TypeError('The count must be a number.');
        }

        const found = this._lookup(singular);
        if (found) {
            return this.getEntry(singular, [count, ...args]);
        }

        const category = getPluralRules(SOURCE_LANGUAGE).select(count);

        return this._format(category === 'one' ? singular : plural, [count, ...args]);
    }

    /**
     * Checks whether there is a translation for an identifier in the current language chain.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasEntry(id) {
        return this._lookup(id) !== null;
    }

    /**
     * Adds entries to the dictionary of a language, replacing entries with the same identifier.
     *
     * @param {Record<string, TranslationEntry>} entries
     * @param {string} [language] A language or locale tag. Defaults to the current language.
     * @throws {TypeError} If the entries are malformed.
     */
    addEntries(entries, language = this.effectiveLocaleManager.language) {
        if (!isPlainObject(entries)) {
            throw new TypeError('The entries must be an object.');
        }

        for (const [id, entry] of Object.entries(entries)) {
            checkEntry(id, entry);
        }

        const tag = canonicalizeLanguage(language);

        this._dictionaries.set(tag, { ...this._dictionaries.get(tag), ...entries });

        this.emit('entries-change', this, tag);
        this.emit('change', this);
    }

    /**
     * Removes the dictionary of a language.
     *
     * @param {string} language
     */
    removeEntries(language) {
        const tag = canonicalizeLanguage(language);

        if (this._dictionaries.delete(tag)) {
            this.emit('entries-change', this, tag);
            this.emit('change', this);
        }
    }

    /**
     * Returns a promise that settles when the dictionaries being loaded by the `loader` are
     * loaded. It rejects if one failed to load.
     *
     * @returns {Promise<void>}
     */
    whenLoaded() {
        this._requestDictionaries();

        return Promise.all(this._pendingLoads.values()).then(() => undefined);
    }

    _onEffectiveLocaleChange() {
        super._onEffectiveLocaleChange();

        this._requestDictionaries();

        this.emit('language-change', this);
        this.emit('change', this);
    }

    /**
     * Returns the tags that are searched for entries, most specific first.
     *
     * @returns {string[]}
     */
    _getLanguageChain() {
        const chain = getTagChain(canonicalizeLanguage(this.effectiveLocale));

        if (this._fallbackLanguage) {
            for (const tag of getTagChain(this._fallbackLanguage)) {
                if (!chain.includes(tag)) {
                    chain.push(tag);
                }
            }
        }

        return chain;
    }

    _lookup(id) {
        this._requestDictionaries();

        for (const language of this._getLanguageChain()) {
            const dictionary = this._dictionaries.get(language);
            if (dictionary && Object.hasOwn(dictionary, id)) {
                return { entry: dictionary[id], language };
            }
        }

        return null;
    }

    _choosePluralForm(entry, language, count) {
        if (typeof entry === 'string') {
            return entry;
        }

        if (typeof count !== 'number') {
            return entry.other;
        }

        const exact = entry['=' + count];
        if (exact !== undefined) {
            return exact;
        }

        return entry[getPluralRules(language).select(count)] ?? entry.other;
    }

    _format(text, args) {
        // Like gettext, texts without arguments are not formatted, so `50% off` needs no escaping.
        if (!args.length) {
            return text;
        }

        this._formatter.localeManager = this.effectiveLocaleManager;

        return this._formatter.format(text, ...args);
    }

    _requestDictionaries() {
        if (!this._loader) {
            return;
        }

        for (const language of this._getLanguageChain()) {
            if (this._requestedLanguages.has(language)) {
                continue;
            }

            this._requestedLanguages.add(language);
            this.emit('load-entries', this, language);

            const result = this._loader(language);
            if (result && typeof result.then === 'function') {
                const promise = Promise.resolve(result)
                    .then((entries) => {
                        if (entries) {
                            this.addEntries(entries, language);
                        }
                    })
                    .catch((error) => {
                        // Allow a later attempt.
                        this._requestedLanguages.delete(language);
                        this.emit('load-error', this, language, error);

                        throw error;
                    })
                    .finally(() => {
                        this._pendingLoads.delete(language);
                    });

                // Failures are reported through `load-error` and `whenLoaded()`.
                promise.catch(() => {});

                this._pendingLoads.set(language, promise);
            } else if (result) {
                this.addEntries(result, language);
            }
        }
    }
}

defineProperties(Translator, {
    /**
     * The dictionary of the current language (as in `getLocaleManager().language`). Setting it
     * replaces that dictionary. Do not modify the returned object; use `addEntries()`.
     */
    entries: {
        get() {
            return this._dictionaries.get(this.effectiveLocaleManager.language) || {};
        },
        set(entries) {
            const language = this.effectiveLocaleManager.language;

            this._dictionaries.delete(language);
            this.addEntries(entries, language);
        },
        signal: false,
    },

    /**
     * The language to use when the current language has no translation, e.g. `'en'` when
     * identifiers are keys and the English dictionary has the source texts. `null` (the default)
     * falls back to the identifier.
     */
    fallbackLanguage: {
        value: null,
        coerce(language) {
            return language ? canonicalizeLanguage(language) : null;
        },
        changed() {
            this._requestDictionaries();
            this.emit('change', this);
        },
    },

    /**
     * A function that loads the dictionary of a language on demand: `(language) => entries`, where
     * the result may also be a promise, or `null` for no dictionary. It is called once per
     * language (and locale tag) that is needed, such as `'nl-BE'` and `'nl'`.
     */
    loader: {
        value: null,
        coerce(loader) {
            if (loader !== null && typeof loader !== 'function') {
                throw new TypeError('The loader must be a function.');
            }

            return loader;
        },
        changed() {
            this._requestedLanguages.clear();
        },
    },
});

/**
 * Returns the translator singleton, which follows the locale manager.
 *
 * @type {() => Translator}
 */
export const getTranslator = lazySingleton(() => new Translator());

/**
 * Translates a text with the singleton, e.g. `tr('Hello, %s!', name)`.
 *
 * @param {string} id
 * @param {...unknown} args
 * @returns {string}
 */
export function translate(id, ...args) {
    return getTranslator().getEntry(id, args);
}

/**
 * A short alias of {@link translate}.
 *
 * @type {typeof translate}
 */
export const tr = translate;

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
export function translatePlural(singular, plural, count, ...args) {
    return getTranslator().translatePlural(singular, plural, count, ...args);
}

/**
 * A short alias of {@link translatePlural}.
 *
 * @type {typeof translatePlural}
 */
export const trn = translatePlural;
