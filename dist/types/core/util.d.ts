/**
 * Small, dependency-free helpers shared by the whole toolkit.
 *
 * @module core/util
 */
/**
 * Clamps a value to the range [`minimum`, `maximum`].
 *
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum Must be greater than or equal to `minimum`.
 * @returns {number}
 */
export declare function clamp(value: number, minimum: number, maximum: number): number;
/**
 * Linearly interpolates between two values.
 *
 * @param {number} alpha A value in [0, 1].
 * @param {number} first The value at `alpha = 0`.
 * @param {number} second The value at `alpha = 1`.
 * @returns {number}
 */
export declare function lerp(alpha: number, first: number, second: number): number;
/**
 * Converts a kebab-case name to camelCase, e.g. `'h-expand'` to `'hExpand'`.
 *
 * @param {string} name
 * @returns {string}
 */
export declare function toCamelCase(name: string): string;
/**
 * Converts a camelCase name to kebab-case, e.g. `'hExpand'` to `'h-expand'`.
 *
 * @param {string} name
 * @returns {string}
 */
export declare function toKebabCase(name: string): string;
/**
 * Escapes text for use inside HTML. Newlines become line breaks and runs of spaces are preserved.
 *
 * @param {unknown} text
 * @returns {string}
 */
export declare function escapeHtml(text: unknown): string;
/**
 * Escapes a string for literal use inside a regular expression (outside a character class). The
 * result is also valid with the `u` flag.
 *
 * @param {string} text
 * @returns {string}
 */
export declare function escapeRegExp(text: string): string;
/**
 * Checks two values for deep (structural) equality. Handles primitives, arrays, dates and plain
 * objects.
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean}
 */
export declare function areEqual(first: unknown, second: unknown): boolean;
/**
 * Parses a CSS pixel length such as `'12px'`. Returns 0 for anything that is not a number.
 *
 * @param {string} value
 * @returns {number}
 */
export declare function parsePixels(value: string): number;
/**
 * Creates an element from an HTML string. The string must contain exactly one root element.
 *
 * @param {string} html
 * @returns {HTMLElement}
 */
export declare function createElement(html: string): HTMLElement;
/**
 * Returns a function that calls `method` at most once per animation frame with the latest
 * arguments.
 *
 * @template {(...args: any[]) => void} T
 * @param {T} method
 * @returns {T}
 */
export declare function throttleToFrame<T extends (...args: any[]) => void>(method: T): T;
/**
 * Generates a document-unique id with the given prefix, for ARIA relationships.
 *
 * @param {string} [prefix]
 * @returns {string}
 */
export declare function uniqueId(prefix?: string): string;
