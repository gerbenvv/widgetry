/**
 * Double press detection that does not depend on the browser's `dblclick` event.
 *
 * Like GTK, the toolkit counts presses itself: two primary button presses within
 * `settings.multiplePressInterval` milliseconds and a few pixels of each other make a double press.
 * This works the same in every browser and with pointer capture, which can make browsers retarget
 * or drop `dblclick`.
 *
 * @module widgets/double-press
 */

import { settings } from '../core/settings.js';

/**
 * The maximum distance in pixels between the presses of a double (or triple) press.
 *
 * @type {number}
 */
export const MULTIPLE_PRESS_DISTANCE = 5;

/**
 * Calls `handler` on every second primary button press of a double press on an element.
 *
 * @param {HTMLElement} element
 * @param {(event: PointerEvent) => void} handler Called with the second `pointerdown` event.
 * @param {object} [options]
 * @param {(event: PointerEvent) => unknown} [options.key] Returns what was pressed (e.g. a row
 *     index); presses on different keys do not make a double press.
 * @returns {() => void} A function that removes the detection again.
 */
export function attachDoublePress(element, handler, options = {}) {
    let last = null;

    function onPointerDown(event) {
        if (event.button !== 0) {
            last = null;

            return;
        }

        const key = options.key ? options.key(event) : null;
        const now = event.timeStamp || performance.now();

        const isDouble =
            last &&
            now - last.time <= settings.multiplePressInterval &&
            Math.hypot(event.clientX - last.x, event.clientY - last.y) <= MULTIPLE_PRESS_DISTANCE &&
            key === last.key;

        if (isDouble) {
            // A third press starts counting anew.
            last = null;
            handler(event);
        } else {
            last = { time: now, x: event.clientX, y: event.clientY, key };
        }
    }

    element.addEventListener('pointerdown', onPointerDown);

    return () => element.removeEventListener('pointerdown', onPointerDown);
}
