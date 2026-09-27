/**
 * Repeating an action while a pointer button is held, as scroll bar and spin button steppers do.
 *
 * @module widgets/auto-repeat
 */

import { settings } from '../core/settings.js';

/**
 * Runs a step now and then repeatedly, first after `initialDelay` and then every `interval`,
 * until the returned function is called or the step returns `false`.
 *
 * @param {(count: number) => (boolean | void)} step Called with the number of the step, starting
 *     at 0. Return `false` to stop repeating.
 * @param {object} [options]
 * @param {number} [options.initialDelay] Defaults to `settings.repeatInitialDelay`.
 * @param {number} [options.interval] Defaults to `settings.repeatInterval`.
 * @returns {() => void} Stops repeating.
 */
export function startAutoRepeat(step, options = {}) {
    const initialDelay = options.initialDelay ?? settings.repeatInitialDelay;
    const interval = options.interval ?? settings.repeatInterval;

    let timer = 0;
    let count = 0;
    let stopped = false;

    function run() {
        if (stopped) {
            return;
        }

        if (step(count) === false) {
            stopped = true;

            return;
        }

        count += 1;
        timer = setTimeout(run, count === 1 ? initialDelay : interval);
    }

    run();

    return () => {
        stopped = true;
        clearTimeout(timer);
    };
}

/**
 * Makes an element repeat an action while the primary pointer button is held on it. The element
 * gets the `wy-pressed` class while held. Repeating pauses while the pointer is outside the
 * element, like a desktop stepper.
 *
 * @param {HTMLElement} element
 * @param {object} options
 * @param {(count: number, event: PointerEvent) => (boolean | void)} options.onStep Runs on the
 *     press and on every repeat. Return `false` to stop repeating.
 * @param {(event: PointerEvent) => boolean} [options.canStart] Checked on a press; return `false`
 *     to ignore it.
 * @param {() => void} [options.onStop] Called when the button is released.
 * @returns {() => void} Removes the listeners.
 */
export function attachPressRepeat(element, options) {
    let pointerId = null;
    let inside = false;
    let lastEvent = null;
    let stop = null;

    function onPointerDown(event) {
        if (event.button !== 0 || pointerId !== null) {
            return;
        }

        if (options.canStart && !options.canStart(event)) {
            return;
        }

        event.preventDefault();

        pointerId = event.pointerId;
        inside = true;
        lastEvent = event;

        try {
            element.setPointerCapture(pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        element.classList.add('wy-pressed');

        stop = startAutoRepeat((count) => {
            // Skip repeats while the pointer is outside, but keep the timer running.
            if (!inside && count > 0) {
                return true;
            }

            return options.onStep(count, lastEvent);
        });
    }

    function onPointerMove(event) {
        if (event.pointerId !== pointerId) {
            return;
        }

        lastEvent = event;

        const rect = element.getBoundingClientRect();
        inside =
            event.clientX >= rect.left &&
            event.clientX < rect.right &&
            event.clientY >= rect.top &&
            event.clientY < rect.bottom;

        element.classList.toggle('wy-pressed', inside);
    }

    function onPointerUp(event) {
        if (event.pointerId !== pointerId) {
            return;
        }

        pointerId = null;

        stop?.();
        stop = null;

        element.classList.remove('wy-pressed');

        options.onStop?.();
    }

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('lostpointercapture', onPointerUp);

    return () => {
        stop?.();

        element.removeEventListener('pointerdown', onPointerDown);
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('pointercancel', onPointerUp);
        element.removeEventListener('lostpointercapture', onPointerUp);
    };
}
