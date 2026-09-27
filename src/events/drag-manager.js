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

import { getCursor } from '../core/cursor.js';
import { CursorShape } from '../core/enums.js';
import { lazySingleton } from '../core/instance.js';
import { getScreen } from '../core/screen.js';
import { settings } from '../core/settings.js';
import { Widget } from '../widgets/widget.js';
import { EVENT_MASKS, Key } from './constants.js';
import { DragContext } from './drag-context.js';
import {
    DragCrossingEvent,
    DragDataRequestEvent,
    DragDropEvent,
    DragEndEvent,
    DragMotionEvent,
    DragStartEvent,
    getModifiers,
} from './events.js';

/**
 * Returns the chain of widgets from `widget` up to its top-level widget.
 *
 * @param {Widget | null} widget
 * @returns {Widget[]}
 */
function getChain(widget) {
    const chain = [];
    while (widget) {
        chain.push(widget);
        widget = widget.parent;
    }

    return chain;
}

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
export function dispatchThroughChain(event, chain, propagate = true) {
    const mask = EVENT_MASKS[event.type];
    const captureMask = propagate ? mask << 1 : 0;

    if (!propagate) {
        const widget = chain[0];

        return widget && widget.events & mask && widget._dispatchEvent(event, false)
            ? widget
            : null;
    }

    for (let i = chain.length - 1; i >= 0; --i) {
        const widget = chain[i];
        if (widget.events & captureMask && widget._dispatchEvent(event, true)) {
            return widget;
        }
    }

    for (const widget of chain) {
        if (widget.events & mask && widget._dispatchEvent(event, false)) {
            return widget;
        }
    }

    return null;
}

/**
 * Manages drag and drop sessions. There is one, created on first use; importing the toolkit
 * creates it.
 */
export class DragManager {
    constructor() {
        this._pending = null;
        this._context = null;
        this._sourceWidget = null;
        this._targetWidget = null;
        this._iconEl = null;
        this._suppressClick = false;

        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);

        document.addEventListener('pointerdown', (event) => this._onPointerDown(event), true);
        document.addEventListener(
            'click',
            (event) => {
                // A drag ends with a release, which must not also click.
                if (this._suppressClick) {
                    this._suppressClick = false;
                    event.stopPropagation();
                    event.preventDefault();
                }
            },
            true
        );
    }

    /**
     * The context of the current drag session, or `null`.
     *
     * @type {DragContext | null}
     */
    get context() {
        return this._context;
    }

    /**
     * Whether a drag is in progress.
     *
     * @type {boolean}
     */
    get dragging() {
        return this._context !== null;
    }

    /**
     * Cancels the current drag, if any.
     */
    cancel() {
        if (this._context) {
            this._context.canceled = true;
            this._finish(null);
        }

        this._pending = null;
        this._removeListeners();
    }

    _onPointerDown(event) {
        if (event.button !== 0 || this._context) {
            return;
        }

        let widget = Widget.fromElement(event.target);
        while (widget && !widget.draggable) {
            widget = widget.parent;
        }

        if (!widget || !widget.isSensitive) {
            return;
        }

        this._pending = {
            pointerId: event.pointerId,
            x: event.pageX,
            y: event.pageY,
            target: event.target,
            nativeEvent: event,
        };

        this._addListeners();
    }

    _addListeners() {
        document.addEventListener('pointermove', this._onPointerMove, true);
        document.addEventListener('pointerup', this._onPointerUp, true);
        document.addEventListener('pointercancel', this._onPointerUp, true);
        document.addEventListener('keydown', this._onKeyDown, true);
    }

    _removeListeners() {
        document.removeEventListener('pointermove', this._onPointerMove, true);
        document.removeEventListener('pointerup', this._onPointerUp, true);
        document.removeEventListener('pointercancel', this._onPointerUp, true);
        document.removeEventListener('keydown', this._onKeyDown, true);
    }

    _onPointerMove(event) {
        const pending = this._pending;
        if (pending && event.pointerId === pending.pointerId && !this._context) {
            const distance = Math.hypot(event.pageX - pending.x, event.pageY - pending.y);
            if (distance >= settings.dragThreshold) {
                this._start(event);
            }

            return;
        }

        if (this._context) {
            this._move(event);
        }
    }

    _start(event) {
        const pending = this._pending;
        this._pending = null;

        const context = new DragContext();
        const chain = getChain(Widget.fromElement(pending.target));
        const startEvent = new DragStartEvent(
            chain[0],
            getModifiers(event),
            pending.x,
            pending.y,
            context,
            event
        );

        const source = dispatchThroughChain(startEvent, chain);
        if (!source) {
            context.destroy();
            this._removeListeners();

            return;
        }

        context.source = source;
        context.connect('data-request', (_context, type) => {
            const request = new DragDataRequestEvent(
                source,
                getModifiers(event),
                event.pageX,
                event.pageY,
                context,
                type
            );

            dispatchThroughChain(request, [source], false);
        });

        this._context = context;
        this._sourceWidget = source;

        // The pointer may have been captured by a widget on press; release it so the widgets under
        // the pointer can be found.
        try {
            pending.target.releasePointerCapture?.(pending.pointerId);
        } catch (_error) {
            // The capture may already be gone.
        }

        source.el.classList.add('wy-drag-source');
        getCursor().pushShape(CursorShape.CLOSED_HAND, 'drag');

        this._showIcon(event);
        this._move(event);
    }

    _move(event) {
        const context = this._context;

        this._placeIcon(event);

        const target = this._findDroppable(event);
        if (target !== this._targetWidget) {
            const modifiers = getModifiers(event);

            if (this._targetWidget) {
                const leave = new DragCrossingEvent(
                    this._targetWidget,
                    modifiers,
                    event.pageX,
                    event.pageY,
                    false,
                    context,
                    target,
                    event
                );

                dispatchThroughChain(leave, [this._targetWidget], false);
                this._targetWidget.el.classList.remove('wy-drop-target');
            }

            const previous = this._targetWidget;
            this._targetWidget = target;

            if (target) {
                const enter = new DragCrossingEvent(
                    target,
                    modifiers,
                    event.pageX,
                    event.pageY,
                    true,
                    context,
                    previous,
                    event
                );

                dispatchThroughChain(enter, [target], false);
                target.el.classList.add('wy-drop-target');
            }
        }

        if (target) {
            const motion = new DragMotionEvent(
                Widget.fromElement(this._hitTest(event)) || target,
                getModifiers(event),
                event.pageX,
                event.pageY,
                context,
                event
            );

            dispatchThroughChain(motion, getChain(motion.source));
        }

        getCursor().popShape('drag');
        getCursor().pushShape(target ? CursorShape.CLOSED_HAND : CursorShape.NO_DROP, 'drag');
    }

    _onPointerUp(event) {
        if (this._pending && event.pointerId === this._pending.pointerId) {
            this._pending = null;
            this._removeListeners();

            return;
        }

        if (!this._context) {
            return;
        }

        this._suppressClick = true;
        setTimeout(() => (this._suppressClick = false), 0);

        let dropWidget = null;
        const target = this._findDroppable(event);
        if (target) {
            const drop = new DragDropEvent(
                Widget.fromElement(this._hitTest(event)) || target,
                getModifiers(event),
                event.pageX,
                event.pageY,
                this._context,
                event
            );

            dropWidget = dispatchThroughChain(drop, getChain(drop.source));
        }

        this._finish(dropWidget, event);
    }

    _onKeyDown(event) {
        if (event.key === Key.ESCAPE && (this._context || this._pending)) {
            event.preventDefault();
            event.stopPropagation();

            this.cancel();
        }
    }

    _finish(dropWidget, event = null) {
        const context = this._context;
        const source = this._sourceWidget;

        if (this._targetWidget) {
            if (!dropWidget && !context.canceled && event) {
                const leave = new DragCrossingEvent(
                    this._targetWidget,
                    getModifiers(event),
                    event.pageX,
                    event.pageY,
                    false,
                    context,
                    null,
                    event
                );

                dispatchThroughChain(leave, [this._targetWidget], false);
            }

            this._targetWidget.el.classList.remove('wy-drop-target');
        }

        if (dropWidget) {
            context.target = dropWidget;
            context.accepted = true;
        }

        this._context = null;
        this._sourceWidget = null;
        this._targetWidget = null;

        this._removeListeners();
        this._hideIcon();

        getCursor().popShape('drag');

        if (source && !source.destroyed) {
            source.el.classList.remove('wy-drag-source');

            const end = new DragEndEvent(
                source,
                event ? getModifiers(event) : 0,
                event?.pageX ?? 0,
                event?.pageY ?? 0,
                context,
                event
            );

            dispatchThroughChain(end, [source], false);
        }

        context.destroy();
    }

    _hitTest(event) {
        return document.elementFromPoint(event.clientX, event.clientY);
    }

    _findDroppable(event) {
        let widget = Widget.fromElement(this._hitTest(event));
        while (widget && !(widget.droppable && widget.isSensitive)) {
            widget = widget.parent;
        }

        return widget;
    }

    _showIcon(event) {
        const icon = this._context.icon;
        if (!icon) {
            return;
        }

        const element = document.createElement('div');
        element.className = 'wy-drag-icon';

        if (typeof icon === 'string') {
            element.textContent = icon;
        } else {
            element.append(icon);
        }

        element.style.zIndex = String(getScreen().nextZIndex());
        getScreen().layer.append(element);

        this._iconEl = element;
        this._placeIcon(event);
    }

    _placeIcon(event) {
        if (this._iconEl) {
            this._iconEl.style.left = `${event.clientX + 12}px`;
            this._iconEl.style.top = `${event.clientY + 12}px`;
        }
    }

    _hideIcon() {
        this._iconEl?.remove();
        this._iconEl = null;
    }
}

/**
 * Returns the drag manager singleton.
 *
 * @type {() => DragManager}
 */
export const getDragManager = lazySingleton(() => new DragManager());

// Start listening as soon as the toolkit is loaded in a browser.
if (typeof document !== 'undefined') {
    getDragManager();
}
