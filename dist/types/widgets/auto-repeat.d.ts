/**
 * Repeating an action while a pointer button is held, as scroll bar and spin button steppers do.
 *
 * @module widgets/auto-repeat
 */
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
export declare function startAutoRepeat(step: (count: number) => (boolean | void), options?: {
    initialDelay?: number;
    interval?: number;
}): () => void;
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
export declare function attachPressRepeat(element: HTMLElement, options: {
    onStep: (count: number, event: PointerEvent) => (boolean | void);
    canStart?: (event: PointerEvent) => boolean;
    onStop?: () => void;
}): () => void;
