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
export function clamp(value, minimum, maximum) {
    return value > maximum ? maximum : value < minimum ? minimum : value;
}

/**
 * Linearly interpolates between two values.
 *
 * @param {number} alpha A value in [0, 1].
 * @param {number} first The value at `alpha = 0`.
 * @param {number} second The value at `alpha = 1`.
 * @returns {number}
 */
export function lerp(alpha, first, second) {
    return first * (1 - alpha) + second * alpha;
}

/**
 * Converts a kebab-case name to camelCase, e.g. `'h-expand'` to `'hExpand'`.
 *
 * @param {string} name
 * @returns {string}
 */
export function toCamelCase(name) {
    return name.replace(/-([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase name to kebab-case, e.g. `'hExpand'` to `'h-expand'`.
 *
 * @param {string} name
 * @returns {string}
 */
export function toKebabCase(name) {
    return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

/**
 * Escapes text for use inside HTML. Newlines become line breaks and runs of spaces are preserved.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/ {2}/g, '&nbsp; ')
        .replace(/\n/g, '<br>');
}

/**
 * Escapes a string for literal use inside a regular expression (outside a character class). The
 * result is also valid with the `u` flag.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeRegExp(text) {
    return text.replace(/[[\]/{}()*+?.\\^$|]/g, '\\$&');
}

/**
 * Checks two values for deep (structural) equality. Handles primitives, arrays, dates and plain
 * objects.
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean}
 */
export function areEqual(first, second) {
    if (first === second) {
        return true;
    }

    if (
        first === null ||
        second === null ||
        typeof first !== 'object' ||
        typeof second !== 'object'
    ) {
        // Treat NaN as equal to itself.
        return Number.isNaN(first) && Number.isNaN(second);
    }

    if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) {
        return false;
    }

    if (first instanceof Date) {
        return first.getTime() === second.getTime();
    }

    if (Array.isArray(first)) {
        return first.length === second.length && first.every((x, i) => areEqual(x, second[i]));
    }

    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);
    if (firstKeys.length !== secondKeys.length) {
        return false;
    }

    return firstKeys.every(
        (key) => Object.hasOwn(second, key) && areEqual(first[key], second[key])
    );
}

/**
 * Parses a CSS pixel length such as `'12px'`. Returns 0 for anything that is not a number.
 *
 * @param {string} value
 * @returns {number}
 */
export function parsePixels(value) {
    const result = parseFloat(value);

    return Number.isFinite(result) ? result : 0;
}

/**
 * Creates an element from an HTML string. The string must contain exactly one root element.
 *
 * @param {string} html
 * @returns {HTMLElement}
 */
export function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    const element = template.content.firstElementChild;
    if (!element || template.content.childElementCount !== 1) {
        throw new Error('HTML must contain exactly one root element.');
    }

    return /** @type {HTMLElement} */ (element);
}

/**
 * Returns a function that calls `method` at most once per animation frame with the latest
 * arguments.
 *
 * @template {(...args: any[]) => void} T
 * @param {T} method
 * @returns {T}
 */
export function throttleToFrame(method) {
    let frame = 0;
    let latestArguments = [];

    return /** @type {T} */ (
        function (...args) {
            latestArguments = args;

            if (!frame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    method.apply(this, latestArguments);
                });
            }
        }
    );
}

/**
 * Generates a document-unique id with the given prefix, for ARIA relationships.
 *
 * @param {string} [prefix]
 * @returns {string}
 */
export function uniqueId(prefix = 'wy') {
    uniqueId.counter = (uniqueId.counter || 0) + 1;

    return `${prefix}-${uniqueId.counter}`;
}
