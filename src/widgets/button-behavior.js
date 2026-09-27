/**
 * The press-and-activate behavior shared by buttons, tool items and similar widgets.
 *
 * @module widgets/button-behavior
 */

import { settings } from '../core/settings.js';
import { Key } from '../events/constants.js';

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
export function attachButtonBehavior(widget, options) {
    const element = options.element || widget.el;
    const focusOnPress = options.focusOnPress !== false;
    const keyboard = options.keyboard !== false;

    let pointerId = null;
    let pointerInside = false;
    let spacePressed = false;
    let enterTimer = 0;

    function setPressed(pressed) {
        element.classList.toggle('wy-pressed', pressed);
    }

    function clearEnterTimer() {
        if (enterTimer) {
            clearTimeout(enterTimer);
            enterTimer = 0;
        }
    }

    function activate() {
        if (!widget.destroyed && widget.isSensitive) {
            options.onActivate();
        }
    }

    function activateWithFlash() {
        clearEnterTimer();
        setPressed(true);

        enterTimer = setTimeout(() => {
            enterTimer = 0;

            if (widget.destroyed) {
                return;
            }

            setPressed(false);
            activate();
        }, settings.keyActivateDelay);
    }

    function onPointerDown(event) {
        // Another press of the pointer that is down means that its release got lost.
        const busy = pointerId !== null && event.pointerId !== pointerId;
        if (event.button !== 0 || !widget.isSensitive || busy) {
            return;
        }

        clearEnterTimer();

        pointerId = event.pointerId;
        pointerInside = true;

        try {
            element.setPointerCapture(pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        setPressed(true);

        if (focusOnPress) {
            widget.focus();
        }
    }

    function onPointerMove(event) {
        if (event.pointerId !== pointerId) {
            return;
        }

        // With the pointer captured, hit-test to follow leaving and re-entering.
        const rect = element.getBoundingClientRect();
        const inside =
            event.clientX >= rect.left &&
            event.clientX < rect.right &&
            event.clientY >= rect.top &&
            event.clientY < rect.bottom;

        if (inside !== pointerInside) {
            pointerInside = inside;
            setPressed(inside);
        }
    }

    function onPointerUp(event) {
        if (event.pointerId !== pointerId) {
            return;
        }

        pointerId = null;
        setPressed(false);

        if (pointerInside && event.type === 'pointerup') {
            activate();
        }
    }

    function onKeyDown(event) {
        if (!keyboard || !widget.isSensitive || event.target !== widget.focusElement) {
            return;
        }

        if (event.key === Key.ENTER && !event.repeat) {
            event.preventDefault();
            activateWithFlash();
        } else if (event.key === Key.SPACE) {
            event.preventDefault();

            spacePressed = true;
            setPressed(true);
        }
    }

    function onKeyUp(event) {
        if (!keyboard || event.key !== Key.SPACE || !spacePressed) {
            return;
        }

        event.preventDefault();

        spacePressed = false;
        setPressed(false);
        activate();
    }

    function onBlur() {
        // Losing the focus cancels a held Space.
        if (spacePressed) {
            spacePressed = false;
            setPressed(false);
        }
    }

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    element.addEventListener('focusout', onBlur);

    return {
        isPressed: () => element.classList.contains('wy-pressed'),
        activate: activateWithFlash,
        destroy() {
            clearEnterTimer();

            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointermove', onPointerMove);
            element.removeEventListener('pointerup', onPointerUp);
            element.removeEventListener('pointercancel', onPointerUp);
            element.removeEventListener('keydown', onKeyDown);
            element.removeEventListener('keyup', onKeyUp);
            element.removeEventListener('focusout', onBlur);
        },
    };
}
