/**
 * Global toolkit settings. They are exposed as properties of the `Application` singleton; this
 * module exists so low-level code can read them without importing the application.
 *
 * @module core/settings
 */
/**
 * @type {{
 *     tooltipAppearDelay: number,
 *     tooltipDisappearDelay: number,
 *     multiplePressInterval: number,
 *     submenuDelay: number,
 *     dragThreshold: number,
 *     keyActivateDelay: number,
 *     repeatInitialDelay: number,
 *     repeatInterval: number,
 * }}
 */
export declare const settings: {
    tooltipAppearDelay: number;
    tooltipDisappearDelay: number;
    multiplePressInterval: number;
    submenuDelay: number;
    dragThreshold: number;
    keyActivateDelay: number;
    repeatInitialDelay: number;
    repeatInterval: number;
};
