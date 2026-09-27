/**
 * Helpers for auxiliary widgets: widgets that a container owns besides its children, such as the
 * label widget of a frame or an expander, or the tab labels of a notebook.
 *
 * An auxiliary widget has the container as its parent (so it inherits visibility, sensitivity
 * and its window), but it is not one of the container's `children`. The container must include
 * it in `_getFocusChain()`, propagate visibility and sensitivity changes to it (see
 * {@link refreshAuxiliaryWidgets}) and destroy it when it is destroyed itself.
 *
 * @module widgets/auxiliary
 */
import { Widget } from './widget.js';
/**
 * Makes a widget an auxiliary widget of a container and places its element in `slot`.
 *
 * @param {import('./container.js').Container} container
 * @param {Widget} widget
 * @param {HTMLElement} slot The element the widget's element is appended to.
 * @param {(widget: Widget) => void} onDestroy Called when the widget is destroyed.
 * @returns {() => void} A function that releases the widget again, without destroying it.
 * @throws {TypeError} If `widget` is not a widget.
 */
export declare function attachAuxiliaryWidget(container: import('./container.js').Container, widget: Widget, slot: HTMLElement, onDestroy: (widget: Widget) => void): () => void;
/**
 * Recomputes the effective visibility and sensitivity of auxiliary widgets, after the
 * container's own changed.
 *
 * @param {Iterable<Widget | null>} widgets
 */
export declare function refreshAuxiliaryWidgets(widgets: Iterable<Widget | null>): void;
/**
 * Returns the focus chain contribution of an auxiliary widget: the widget itself when it can
 * take the focus, followed by its own focus chain if it is a container.
 *
 * @param {Widget | null} widget
 * @returns {Widget[]}
 */
export declare function getAuxiliaryFocusChain(widget: Widget | null): Widget[];
