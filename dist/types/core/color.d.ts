/**
 * Parsing, formatting and conversion of CSS colors, as used by the color chooser.
 *
 * Colors are plain objects with the red, green and blue channels in [0, 255] and the alpha in
 * [0, 1]: `{ r: 52, g: 101, b: 164, a: 1 }`. The channels may have fractions; formatting rounds
 * them.
 *
 * @module core/color
 */
export type Rgba = {
    /**
     * The red channel, in [0, 255].
     */
    r: number;
    /**
     * The green channel, in [0, 255].
     */
    g: number;
    /**
     * The blue channel, in [0, 255].
     */
    b: number;
    /**
     * The alpha (opacity), in [0, 1].
     */
    a: number;
};
export type Hsv = {
    /**
     * The hue in degrees, in [0, 360).
     */
    h: number;
    /**
     * The saturation, in [0, 1].
     */
    s: number;
    /**
     * The value (brightness), in [0, 1].
     */
    v: number;
};
export type Hsl = {
    /**
     * The hue in degrees, in [0, 360).
     */
    h: number;
    /**
     * The saturation, in [0, 1].
     */
    s: number;
    /**
     * The lightness, in [0, 1].
     */
    l: number;
};
/**
 * Parses the color syntaxes that need no browser: hex colors (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, `color(srgb ...)` and `transparent`.
 *
 * @param {string} text
 * @returns {Rgba | null} The color, or `null` if the text is not one of these syntaxes.
 */
export declare function parseColorSyntax(text: string): Rgba | null;
/**
 * Parses a CSS color. The common syntaxes are parsed directly (see {@link parseColorSyntax});
 * other colors, such as named colors, are resolved with the browser.
 *
 * @param {string} text
 * @returns {Rgba | null} The color, or `null` if the text is not a valid color.
 */
export declare function parseColor(text: string): Rgba | null;
/**
 * Formats a color as a hex color: `#rrggbb`, or `#rrggbbaa` when it is not opaque (or with
 * `alpha` set to `true`).
 *
 * @param {Rgba} color
 * @param {boolean} [alpha] Whether to always include the alpha (`true`) or never (`false`).
 *     Defaults to including it when the color is not opaque.
 * @returns {string}
 */
export declare function formatHex(color: Rgba, alpha?: boolean): string;
/**
 * Formats a color as `rgb(r, g, b)`, or `rgba(r, g, b, a)` when it is not opaque.
 *
 * @param {Rgba} color
 * @returns {string}
 */
export declare function formatRgb(color: Rgba): string;
/**
 * Normalizes a CSS color to a hex color (see {@link formatHex}).
 *
 * @param {string} text
 * @returns {string | null} The hex color, or `null` if the text is not a valid color.
 */
export declare function normalizeColor(text: string): string | null;
/**
 * Converts RGB channels in [0, 255] to HSV.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Hsv}
 */
export declare function rgbToHsv(r: number, g: number, b: number): Hsv;
/**
 * Converts HSV to RGB channels in [0, 255] (with fractions).
 *
 * @param {number} h The hue in degrees.
 * @param {number} s The saturation, in [0, 1].
 * @param {number} v The value, in [0, 1].
 * @returns {{r: number, g: number, b: number}}
 */
export declare function hsvToRgb(h: number, s: number, v: number): {
    r: number;
    g: number;
    b: number;
};
/**
 * Converts RGB channels in [0, 255] to HSL.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Hsl}
 */
export declare function rgbToHsl(r: number, g: number, b: number): Hsl;
/**
 * Converts HSL to RGB channels in [0, 255] (with fractions).
 *
 * @param {number} h The hue in degrees.
 * @param {number} s The saturation, in [0, 1].
 * @param {number} l The lightness, in [0, 1].
 * @returns {{r: number, g: number, b: number}}
 */
export declare function hslToRgb(h: number, s: number, l: number): {
    r: number;
    g: number;
    b: number;
};
/**
 * Returns the relative luminance of a color (as in WCAG), from 0 for black to 1 for white.
 *
 * @param {Rgba | {r: number, g: number, b: number}} color
 * @returns {number}
 */
export declare function getLuminance(color: Rgba | {
    r: number;
    g: number;
    b: number;
}): number;
