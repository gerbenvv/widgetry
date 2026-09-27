/**
 * The press-and-activate behavior shared by buttons, tool items and similar widgets.
 *
 * @module widgets/button-behavior
 */
export type ButtonBehavior = {
    /**
     * Whether the element currently looks pressed.
     */
    isPressed: () => boolean;
    /**
     * Shows a short press and then activates, like pressing Enter.
     */
    activate: () => void;
    /**
     * Removes the listeners.
     */
    destroy: () => void;
};
/**
 * @typedef {object} ButtonBehavior
 * @property {() => boolean} isPressed Whether the element currently looks pressed.
 * @property {() => void} activate Shows a short press and then activates, like pressing Enter.
 * @property {() => void} destroy Removes the listeners.
 */
/**
 * Makes an element behave like a push button, following the original toolkit and GTK:
 *
 * - A primary button press shows the element pressed (`wy-pressed`) and focuses the widget; the
 *   press follows the pointer leaving and re-entering, and releasing over the element activates.
 * - Space shows the element pressed while held and activates on release; Enter shows a short press
 *   (`settings.keyActivateDelay`) and then activates.
 * - Nothing happens while the widget is insensitive.
 *
 * @param {import('./widget.js').Widget} widget
 * @param {object} [options]
 * @param {HTMLElement} [options.element] The element to attach to. Defaults to `widget.el`.
 * @param {() => void} options.onActivate Called on activation.
 * @param {boolean} [options.focusOnPress] Whether a press focuses the widget. Defaults to true.
 * @param {boolean} [options.keyboard] Whether Space and Enter activate. Defaults to true.
 * @returns {ButtonBehavior}
 */
export declare function attachButtonBehavior(widget: import('./widget.js').Widget, options?: {
    element?: HTMLElement;
    onActivate: () => void;
    focusOnPress?: boolean;
    keyboard?: boolean;
}): ButtonBehavior;
