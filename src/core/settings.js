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
export const settings = {
    // Delay in milliseconds before a tooltip appears.
    tooltipAppearDelay: 500,

    // Delay in milliseconds before a tooltip disappears after the pointer left.
    tooltipDisappearDelay: 100,

    // Maximum time in milliseconds between presses that count as a double (or triple) press.
    multiplePressInterval: 400,

    // Delay in milliseconds before a submenu opens when hovering its item.
    submenuDelay: 250,

    // Distance in pixels the pointer must move with a button pressed before a drag starts.
    dragThreshold: 4,

    // How long in milliseconds a button looks pressed when activated with the keyboard.
    keyActivateDelay: 100,

    // Delay in milliseconds before a held stepper or scroll arrow starts repeating.
    repeatInitialDelay: 300,

    // Interval in milliseconds between repeats of a held stepper or scroll arrow.
    repeatInterval: 50,
};
