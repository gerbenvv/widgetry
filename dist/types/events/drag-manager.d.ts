/**
 * Drag and drop between widgets, with pointer events.
 *
 * A drag can start on a widget that is `draggable` (or has a draggable ancestor). Once the pointer
 * moved `settings.dragThreshold` pixels with the primary button pressed, a `drag-start` event is
 * sent through the widgets under the press; a widget that handles it (returns `true`, usually
 * after adding data to `event.context`) becomes the drag source. While dragging, droppable widgets
 * under the pointer receive `drag-enter`, `drag-motion` and `drag-leave`, and on release
 * `drag-drop`, which a target accepts by handling it. Finally the source receives `drag-end`.
 * Escape cancels a drag.
 *
 * Widgets receive the events whose masks are enabled in their `events` property.
 *
 * @module events/drag-manager
 */
import { Widget } from '../widgets/widget.js';
import { DragContext } from './drag-context.js';
/**
 * Sends a toolkit event through a chain of widgets (innermost first), with a capture phase from
 * the outermost widget inwards and a bubble phase back out. Only widgets whose event mask selects
 * the event receive it.
 *
 * @param {import('./events.js').ToolkitEvent} event
 * @param {Widget[]} chain
 * @param {boolean} [propagate] Whether the event propagates; if not, only `chain[0]` gets it.
 * @returns {Widget | null} The widget that handled the event.
 */
export declare function dispatchThroughChain(event: import('./events.js').ToolkitEvent, chain: Widget[], propagate?: boolean): Widget | null;
/**
 * Manages drag and drop sessions. There is one, created on first use; importing the toolkit
 * creates it.
 */
export declare class DragManager {
    _pending: {
        pointerId: any;
        x: any;
        y: any;
        target: any;
        nativeEvent: any;
    };
    _context: DragContext;
    _sourceWidget: Widget;
    _targetWidget: any;
    _pointerId: any;
    _iconEl: HTMLDivElement;
    _suppressClick: boolean;
    constructor();
    /**
     * The context of the current drag session, or `null`.
     *
     * @type {DragContext | null}
     */
    get context(): DragContext | null;
    /**
     * Whether a drag is in progress.
     *
     * @type {boolean}
     */
    get dragging(): boolean;
    /**
     * Cancels the current drag, if any.
     */
    cancel(): void;
    _onPointerDown(event: any): void;
    _addListeners(): void;
    _removeListeners(): void;
    _onPointerMove(event: any): void;
    _start(event: any): void;
    _move(event: any): void;
    _onPointerUp(event: any): void;
    _onKeyDown(event: any): void;
    _finish(dropWidget: any, event?: any): void;
    _hitTest(event: any): Element;
    _findDroppable(event: any): Widget;
    _showIcon(event: any): void;
    _placeIcon(event: any): void;
    _hideIcon(): void;
}
/**
 * Returns the drag manager singleton.
 *
 * @type {() => DragManager}
 */
export declare const getDragManager: () => DragManager;
