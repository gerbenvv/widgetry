/**
 * Translations of the toolkit's own texts: dialog button labels and accessible names.
 *
 * The toolkit's texts are English. They are translated by the application's translator when it
 * has an entry for them (so an application can override them), and otherwise by the built-in
 * dictionaries below, for the current language.
 *
 * @module i18n/toolkit-text
 */
/**
 * The built-in translations of the toolkit's texts, by language. Underscores mark mnemonics.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export declare const TOOLKIT_TRANSLATIONS: Readonly<Record<string, Readonly<Record<string, string>>>>;
/**
 * Translates a text of the toolkit to the current language.
 *
 * @param {string} text The English text, e.g. `'_Cancel'` or `'Close'`.
 * @returns {string}
 */
export declare function toolkitText(text: string): string;
/**
 * Calls `update` now and whenever the translations may have changed (the locale or the
 * application's dictionaries), until `owner` is destroyed. Widgets use it to keep their texts in
 * the current language.
 *
 * @param {import('../core/instance.js').Instance} owner
 * @param {() => void} update
 * @returns {() => void} A function that stops the updates.
 */
export declare function bindToolkitText(owner: import('../core/instance.js').Instance, update: () => void): () => void;
/**
 * Sets the translated accessible name (`aria-label`) of an element and its descendants that have
 * a `data-wy-label` attribute with the English text.
 *
 * @param {Element} root
 */
export declare function translateLabels(root: Element): void;
