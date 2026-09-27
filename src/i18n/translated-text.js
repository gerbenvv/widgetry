/**
 * @module i18n/translated-text
 */

import { defineProperties, Instance } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { getTranslator, Translator } from './translator.js';

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
export class TranslatedText extends Instance {
    _initialize() {
        super._initialize();

        /** @type {(() => void) | null} */
        this._disconnectTranslator = null;

        /** @type {string | null} */
        this._lastText = null;
    }

    connect(name, method, context) {
        return this._watch(name, super.connect(name, method, context));
    }

    connectFirst(name, method, context) {
        return this._watch(name, super.connectFirst(name, method, context));
    }

    connectLast(name, method, context) {
        return this._watch(name, super.connectLast(name, method, context));
    }

    disconnect(name, method, context) {
        super.disconnect(name, method, context);

        this._unwatchIfUnused();
    }

    /**
     * Returns the translation.
     *
     * @returns {string}
     */
    toString() {
        return this.text;
    }

    /**
     * Returns the translation, so a translated text serializes as its text.
     *
     * @returns {string}
     */
    toJSON() {
        return this.text;
    }

    destroy() {
        this._disconnectTranslator?.();
        this._disconnectTranslator = null;

        super.destroy();
    }

    _getTranslator() {
        return this._translator || getTranslator();
    }

    _watch(name, disconnect) {
        if (name !== 'text-change') {
            return disconnect;
        }

        if (!this._disconnectTranslator) {
            this._lastText = this.text;
            this._disconnectTranslator = this._getTranslator().connect(
                'change',
                this._onTranslatorChange,
                this
            );
        }

        return () => {
            disconnect();
            this._unwatchIfUnused();
        };
    }

    _unwatchIfUnused() {
        if (this._disconnectTranslator && !this._signalDispatcher?.hasHandlers('text-change')) {
            this._disconnectTranslator();
            this._disconnectTranslator = null;
        }
    }

    _onTranslatorChange() {
        const text = this.text;
        if (text !== this._lastText) {
            this._lastText = text;
            this.emit('text-change', this);
        }
    }
}

/**
 * Creates a setter that allows a property to be set only once, which keeps the text immutable.
 *
 * @param {string} name
 * @param {(value: unknown) => unknown} check Validates and converts the value.
 * @returns {(this: TranslatedText, value: unknown) => void}
 */
function setOnce(name, check) {
    const field = '_' + name;

    return function (value) {
        if (this[field] !== null) {
            throw new Error(`The ${name} of a translated text cannot be changed.`);
        }

        this[field] = check(value);
    };
}

defineProperties(TranslatedText, {
    /**
     * The identifier of the text, used to look up the translation: a key or the source text. It
     * can only be set once.
     */
    id: {
        value: null,
        set: setOnce('id', (id) => {
            if (typeof id !== 'string') {
                throw new TypeError('The id of a translated text must be a string.');
            }

            return id;
        }),
    },

    /**
     * The source text of the plural form, or `null`. When set, `id` is the singular form and the
     * first argument is the count, as in {@link Translator#translatePlural}. It can only be set
     * once.
     */
    plural: {
        value: null,
        set: setOnce('plural', (plural) => {
            if (typeof plural !== 'string') {
                throw new TypeError('The plural of a translated text must be a string.');
            }

            return plural;
        }),
    },

    /**
     * The arguments of the placeholders in the text. It can only be set once.
     */
    arguments: {
        value: null,
        get() {
            return this._arguments || [];
        },
        set: setOnce('arguments', (args) => {
            if (!Array.isArray(args)) {
                throw new TypeError('The arguments of a translated text must be an array.');
            }

            return Object.freeze([...args]);
        }),
    },

    /**
     * The translator to use, or `null` (the default) for the singleton.
     */
    translator: {
        value: null,
        coerce(translator) {
            if (translator && !(translator instanceof Translator)) {
                throw new TypeError('The translator must be a Translator.');
            }

            return translator || null;
        },
        changed() {
            if (this._disconnectTranslator) {
                this._disconnectTranslator();
                this._disconnectTranslator = this._getTranslator().connect(
                    'change',
                    this._onTranslatorChange,
                    this
                );
                this._onTranslatorChange();
            }
        },
    },

    /**
     * The translated text in the current language.
     */
    text: {
        readOnly: true,
        get() {
            if (this._id === null) {
                return '';
            }

            const translator = this._getTranslator();
            const args = this.arguments;

            if (this._plural !== null) {
                const [count, ...rest] = args;

                return translator.translatePlural(this._id, this._plural, count, ...rest);
            }

            return translator.getEntry(this._id, [...args]);
        },
    },
});

/**
 * Creates a translated text, like the original toolkit's `__` shortcut:
 * `__('some-identifier', firstArgument, secondArgument)`.
 *
 * @param {string} id
 * @param {...unknown} args
 * @returns {TranslatedText}
 */
export function __(id, ...args) {
    return new TranslatedText({ id, arguments: args });
}

/**
 * Creates a translated text with singular and plural forms, e.g. `__n('%d file', '%d files', 3)`.
 *
 * @param {string} singular
 * @param {string} plural
 * @param {number} count
 * @param {...unknown} args
 * @returns {TranslatedText}
 */
export function __n(singular, plural, count, ...args) {
    return new TranslatedText({ id: singular, plural, arguments: [count, ...args] });
}

registerType('translated-text', TranslatedText);
