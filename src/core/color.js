/**
 * Parsing, formatting and conversion of CSS colors, as used by the color chooser.
 *
 * Colors are plain objects with the red, green and blue channels in [0, 255] and the alpha in
 * [0, 1]: `{ r: 52, g: 101, b: 164, a: 1 }`. The channels may have fractions; formatting rounds
 * them.
 *
 * @module core/color
 */

import { clamp } from './util.js';

/**
 * @typedef {object} Rgba
 * @property {number} r The red channel, in [0, 255].
 * @property {number} g The green channel, in [0, 255].
 * @property {number} b The blue channel, in [0, 255].
 * @property {number} a The alpha (opacity), in [0, 1].
 */

/**
 * @typedef {object} Hsv
 * @property {number} h The hue in degrees, in [0, 360).
 * @property {number} s The saturation, in [0, 1].
 * @property {number} v The value (brightness), in [0, 1].
 */

/**
 * @typedef {object} Hsl
 * @property {number} h The hue in degrees, in [0, 360).
 * @property {number} s The saturation, in [0, 1].
 * @property {number} l The lightness, in [0, 1].
 */

/**
 * The number of degrees in one unit of each CSS angle unit.
 *
 * @type {Readonly<Record<string, number>>}
 */
const ANGLE_UNITS = Object.freeze({
    deg: 1,
    grad: 360 / 400,
    rad: 180 / Math.PI,
    turn: 360,
});

/**
 * A CSS number: an optional sign, digits with an optional fraction, and an optional exponent.
 *
 * @type {string}
 */
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';

/**
 * A number with an optional unit or percent sign, or the keyword `none`.
 *
 * @type {RegExp}
 */
const COMPONENT_PATTERN = new RegExp(`^(?:(${NUMBER})(%|deg|grad|rad|turn)?|none)$`, 'i');

/**
 * Matches the CSS-wide keywords and `currentcolor`, which are valid values of `color` but depend on
 * where they are used.
 *
 * @type {RegExp}
 */
const CONTEXT_KEYWORD_PATTERN = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i;

/**
 * Two different inherited colors, for finding colors that depend on where they are used.
 *
 * @type {ReadonlyArray<string>}
 */
const PROBE_COLORS = Object.freeze(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);

/**
 * Matches a color function: its name and its arguments.
 *
 * @type {RegExp}
 */
const FUNCTION_PATTERN = /^([a-z-]+)\(\s*(.*?)\s*\)$/i;

/**
 * Parses one argument of a color function, as a number and its unit (`''`, `'%'` or an angle
 * unit). `none` counts as zero.
 *
 * @param {string} text
 * @returns {{value: number, unit: string} | null}
 */
function parseComponent(text) {
    const match = COMPONENT_PATTERN.exec(text);
    if (!match) {
        return null;
    }

    if (match[1] === undefined) {
        return { value: 0, unit: '' };
    }

    return { value: Number(match[1]), unit: (match[2] || '').toLowerCase() };
}

/**
 * Splits the arguments of a color function into its channels and its alpha. Both the legacy
 * comma syntax (`rgb(1, 2, 3)`) and the modern space syntax (`rgb(1 2 3 / 50%)`) work.
 *
 * @param {string} text
 * @returns {{channels: string[], alpha: string | null} | null}
 */
function splitArguments(text) {
    if (text.includes(',')) {
        const parts = text.split(',').map((x) => x.trim());
        if (parts.length !== 3 && parts.length !== 4) {
            return null;
        }

        return { channels: parts.slice(0, 3), alpha: parts[3] ?? null };
    }

    const [channelText, alphaText, ...rest] = text.split('/').map((x) => x.trim());
    if (rest.length) {
        return null;
    }

    const channels = channelText.split(/\s+/).filter(Boolean);
    if (channels.length !== 3 || alphaText === '') {
        return null;
    }

    return { channels, alpha: alphaText ?? null };
}

/**
 * Parses an alpha argument: a number in [0, 1] or a percentage.
 *
 * @param {string | null} text
 * @returns {number | null}
 */
function parseAlpha(text) {
    if (text === null) {
        return 1;
    }

    const component = parseComponent(text);
    if (!component || (component.unit && component.unit !== '%')) {
        return null;
    }

    const value = component.unit === '%' ? component.value / 100 : component.value;

    return clamp(value, 0, 1);
}

/**
 * Parses a hue argument in degrees: a number or an angle with a unit.
 *
 * @param {string} text
 * @returns {number | null}
 */
function parseHue(text) {
    const component = parseComponent(text);
    if (!component || component.unit === '%') {
        return null;
    }

    const degrees = component.value * (ANGLE_UNITS[component.unit] ?? 1);

    return ((degrees % 360) + 360) % 360;
}

/**
 * Parses a percentage argument (or a plain number, as the modern syntax allows) as a fraction in
 * [0, 1], where a plain number counts as a percentage.
 *
 * @param {string} text
 * @returns {number | null}
 */
function parsePercentage(text) {
    const component = parseComponent(text);
    if (!component || (component.unit && component.unit !== '%')) {
        return null;
    }

    return clamp(component.value / 100, 0, 1);
}

function parseHex(text) {
    const digits = text.slice(1);
    if (!/^[0-9a-f]+$/i.test(digits) || ![3, 4, 6, 8].includes(digits.length)) {
        return null;
    }

    // Expand the short forms, such as #fa0 to #ffaa00.
    const full = digits.length <= 4 ? [...digits].map((x) => x + x).join('') : digits;
    const channel = (index) => parseInt(full.slice(index * 2, index * 2 + 2), 16);

    return {
        r: channel(0),
        g: channel(1),
        b: channel(2),
        a: full.length === 8 ? channel(3) / 255 : 1,
    };
}

function parseRgbFunction(argumentsText) {
    const parts = splitArguments(argumentsText);
    if (!parts) {
        return null;
    }

    const channels = parts.channels.map((text) => {
        const component = parseComponent(text);
        if (!component || (component.unit && component.unit !== '%')) {
            return null;
        }

        const value = component.unit === '%' ? (component.value / 100) * 255 : component.value;

        return clamp(value, 0, 255);
    });

    const alpha = parseAlpha(parts.alpha);
    if (channels.includes(null) || alpha === null) {
        return null;
    }

    return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
}

function parseHslFunction(argumentsText) {
    const parts = splitArguments(argumentsText);
    if (!parts) {
        return null;
    }

    const h = parseHue(parts.channels[0]);
    const s = parsePercentage(parts.channels[1]);
    const l = parsePercentage(parts.channels[2]);
    const alpha = parseAlpha(parts.alpha);

    if (h === null || s === null || l === null || alpha === null) {
        return null;
    }

    return { ...hslToRgb(h, s, l), a: alpha };
}

function parseColorFunction(argumentsText) {
    // Only the sRGB color space, as computed styles give for colors such as `color-mix()`.
    const match = /^srgb\s+(.*)$/i.exec(argumentsText);
    if (!match) {
        return null;
    }

    const parts = splitArguments(match[1]);
    if (!parts || argumentsText.includes(',')) {
        return null;
    }

    const channels = parts.channels.map((text) => {
        const component = parseComponent(text);
        if (!component || (component.unit && component.unit !== '%')) {
            return null;
        }

        const fraction = component.unit === '%' ? component.value / 100 : component.value;

        return clamp(fraction, 0, 1) * 255;
    });

    const alpha = parseAlpha(parts.alpha);
    if (channels.includes(null) || alpha === null) {
        return null;
    }

    return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
}

/**
 * Parses the color syntaxes that need no browser: hex colors (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, `color(srgb ...)` and `transparent`.
 *
 * @param {string} text
 * @returns {Rgba | null} The color, or `null` if the text is not one of these syntaxes.
 */
export function parseColorSyntax(text) {
    if (typeof text !== 'string') {
        return null;
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('#')) {
        return parseHex(trimmed);
    }

    if (trimmed.toLowerCase() === 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    const match = FUNCTION_PATTERN.exec(trimmed);
    if (!match) {
        return null;
    }

    switch (match[1].toLowerCase()) {
        case 'rgb':
        case 'rgba':
            return parseRgbFunction(match[2]);

        case 'hsl':
        case 'hsla':
            return parseHslFunction(match[2]);

        case 'color':
            return parseColorFunction(match[2]);

        default:
            return null;
    }
}

/**
 * Resolves any other CSS color (such as a named color like `'rebeccapurple'`) with the browser:
 * the color is checked with `CSS.supports()` and converted by reading the computed style of a
 * temporary element. Values that depend on where they are used, such as `currentColor`,
 * `inherit` or an undefined custom property, are not colors. Returns `null` outside a browser.
 *
 * @param {string} text
 * @returns {Rgba | null}
 */
function resolveWithBrowser(text) {
    if (
        typeof document === 'undefined' ||
        typeof CSS === 'undefined' ||
        typeof getComputedStyle === 'undefined' ||
        CONTEXT_KEYWORD_PATTERN.test(text) ||
        !CSS.supports('color', text)
    ) {
        return null;
    }

    const parent = document.createElement('span');
    const element = document.createElement('span');
    parent.style.display = 'none';
    parent.append(element);
    document.documentElement.append(parent);

    try {
        // Resolve the color with two different inherited colors; a color that follows them is
        // not a color of its own.
        const [first, second] = PROBE_COLORS.map((inherited) => {
            parent.style.color = inherited;

            return resolveElementColor(element, text);
        });

        if (!first || !second || formatHex(first, true) !== formatHex(second, true)) {
            return null;
        }

        return first;
    } finally {
        parent.remove();
    }
}

/**
 * Sets a color on an element and reads back its computed color.
 *
 * @param {HTMLElement} element
 * @param {string} text
 * @returns {Rgba | null}
 */
function resolveElementColor(element, text) {
    // Plain colors compute to rgb(); other color spaces are converted to sRGB by mixing.
    for (const value of [text, `color-mix(in srgb, ${text} 100%, transparent)`]) {
        element.style.color = '';
        element.style.color = value;

        if (!element.style.color) {
            continue;
        }

        const color = parseColorSyntax(getComputedStyle(element).color);
        if (color) {
            return color;
        }
    }

    return null;
}

/**
 * Parses a CSS color. The common syntaxes are parsed directly (see {@link parseColorSyntax});
 * other colors, such as named colors, are resolved with the browser.
 *
 * @param {string} text
 * @returns {Rgba | null} The color, or `null` if the text is not a valid color.
 */
export function parseColor(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return null;
    }

    return parseColorSyntax(text) || resolveWithBrowser(text.trim());
}

function toHexByte(value) {
    return Math.round(clamp(value, 0, 255))
        .toString(16)
        .padStart(2, '0');
}

/**
 * Formats a color as a hex color: `#rrggbb`, or `#rrggbbaa` when it is not opaque (or with
 * `alpha` set to `true`).
 *
 * @param {Rgba} color
 * @param {boolean} [alpha] Whether to always include the alpha (`true`) or never (`false`).
 *     Defaults to including it when the color is not opaque.
 * @returns {string}
 */
export function formatHex(color, alpha) {
    const hex = `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
    const opacity = color.a ?? 1;
    const withAlpha = alpha ?? Math.round(clamp(opacity, 0, 1) * 255) < 255;

    return withAlpha ? hex + toHexByte(opacity * 255) : hex;
}

/**
 * Formats a color as `rgb(r, g, b)`, or `rgba(r, g, b, a)` when it is not opaque.
 *
 * @param {Rgba} color
 * @returns {string}
 */
export function formatRgb(color) {
    const channels = [color.r, color.g, color.b].map((x) => Math.round(clamp(x, 0, 255)));
    const opacity = Math.round(clamp(color.a ?? 1, 0, 1) * 1000) / 1000;

    return opacity < 1 ? `rgba(${channels.join(', ')}, ${opacity})` : `rgb(${channels.join(', ')})`;
}

/**
 * Normalizes a CSS color to a hex color (see {@link formatHex}).
 *
 * @param {string} text
 * @returns {string | null} The hex color, or `null` if the text is not a valid color.
 */
export function normalizeColor(text) {
    const color = parseColor(text);

    return color ? formatHex(color) : null;
}

/**
 * Converts RGB channels in [0, 255] to HSV.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Hsv}
 */
export function rgbToHsv(r, g, b) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;

    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;

    let h = 0;
    if (delta > 0) {
        if (maximum === red) {
            h = ((green - blue) / delta) % 6;
        } else if (maximum === green) {
            h = (blue - red) / delta + 2;
        } else {
            h = (red - green) / delta + 4;
        }

        h = (h * 60 + 360) % 360;
    }

    return { h, s: maximum > 0 ? delta / maximum : 0, v: maximum };
}

/**
 * Converts HSV to RGB channels in [0, 255] (with fractions).
 *
 * @param {number} h The hue in degrees.
 * @param {number} s The saturation, in [0, 1].
 * @param {number} v The value, in [0, 1].
 * @returns {{r: number, g: number, b: number}}
 */
export function hsvToRgb(h, s, v) {
    const hue = (((h % 360) + 360) % 360) / 60;
    const saturation = clamp(s, 0, 1);
    const value = clamp(v, 0, 1);

    const channel = (n) => {
        const k = (n + hue) % 6;

        return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
    };

    return { r: channel(5) * 255, g: channel(3) * 255, b: channel(1) * 255 };
}

/**
 * Converts RGB channels in [0, 255] to HSL.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Hsl}
 */
export function rgbToHsl(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);
    const l = v * (1 - s / 2);
    const saturation = l > 0 && l < 1 ? (v - l) / Math.min(l, 1 - l) : 0;

    return { h, s: saturation, l };
}

/**
 * Converts HSL to RGB channels in [0, 255] (with fractions).
 *
 * @param {number} h The hue in degrees.
 * @param {number} s The saturation, in [0, 1].
 * @param {number} l The lightness, in [0, 1].
 * @returns {{r: number, g: number, b: number}}
 */
export function hslToRgb(h, s, l) {
    const saturation = clamp(s, 0, 1);
    const lightness = clamp(l, 0, 1);
    const v = lightness + saturation * Math.min(lightness, 1 - lightness);

    return hsvToRgb(h, v > 0 ? 2 * (1 - lightness / v) : 0, v);
}

/**
 * Returns the relative luminance of a color (as in WCAG), from 0 for black to 1 for white.
 *
 * @param {Rgba | {r: number, g: number, b: number}} color
 * @returns {number}
 */
export function getLuminance(color) {
    const linear = (value) => {
        const channel = clamp(value, 0, 255) / 255;

        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}
