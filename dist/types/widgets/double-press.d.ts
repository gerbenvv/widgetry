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
export declare function attachDoublePress(element: HTMLElement, handler: (event: PointerEvent) => void, options?: {
    key?: (event: PointerEvent) => unknown;
}): () => void;
