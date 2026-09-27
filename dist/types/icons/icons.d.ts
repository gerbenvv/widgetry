/**
 * The built-in icons: small, monochrome SVG icons with freedesktop (GTK) names, drawn with
 * `currentColor` so they follow the text color. Register more with `registerIcon()`.
 *
 * @module icons/icons
 */
/**
 * Registers an icon, or replaces a built-in one.
 *
 * @param {string} name
 * @param {string} svg The SVG markup. Use `currentColor` to follow the text color.
 */
export declare function registerIcon(name: string, svg: string): void;
/**
 * Returns the SVG markup of an icon, or `null` if there is no such icon.
 *
 * @param {string} name
 * @returns {string | null}
 */
export declare function getIcon(name: string): string | null;
/**
 * Returns the names of all registered icons.
 *
 * @returns {string[]}
 */
export declare function getIconNames(): string[];
