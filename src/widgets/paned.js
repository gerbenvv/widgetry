/**
 * @module widgets/paned
 */

import { getCursor } from '../core/cursor.js';
import { CursorShape, Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Container } from './container.js';

/**
 * The size of the splitter between the panes, in pixels.
 *
 * @type {number}
 */
export const SPLITTER_SIZE = 6;

/**
 * How far the arrow keys move the splitter, in pixels.
 *
 * @type {number}
 */
const KEY_STEP = 10;

/**
 * How far Page Up and Page Down move the splitter, as a fraction of the available size.
 *
 * @type {number}
 */
const KEY_PAGE_FRACTION = 0.1;

/**
 * @typedef {object} PaneOptions
 * @property {boolean} resize Whether the pane grows and shrinks when the paned is resized.
 * @property {boolean} shrink Whether the pane can be made smaller than its child's minimum size.
 */

/**
 * Two panes side by side (or above each other) with a splitter between them that the user can
 * drag to divide the space, like GTK's paned.
 *
 * Each child has two flags, given to `addChild(widget, resize, shrink)`:
 *
 * - `resize` (default `true`): whether the pane takes part in size changes of the paned. When
 *   both panes resize (or neither does), they keep their proportions; otherwise only the pane that
 *   resizes changes size.
 * - `shrink` (default `false`, as the original toolkit): whether the user can make the pane
 *   smaller than its child's minimum size, which then gets clipped.
 *
 * Until `position` is set (by the user dragging the splitter or by code), the space is divided
 * equally. Like in GTK, the splitter is not in the Tab order: F8 gives it the keyboard focus
 * (again for the next outer paned), Escape or Enter gives the focus back. With the focus, the
 * arrow keys move it by 10 pixels, Page Up and Page Down by a tenth of the space, and Home and
 * End move it to the ends. With `canFocus`, the splitter is in the Tab order as well.
 *
 * Signals: `position-change` whenever the position of the splitter changes.
 */
export class Paned extends Container {
    _initialize() {
        super._initialize();

        /** @type {Map<import('./widget.js').Widget, PaneOptions>} */
        this._paneOptions = new Map();

        // The pending options of the child being added by `addChild()`.
        /** @type {PaneOptions | null} */
        this._pendingOptions = null;

        // The available size (without the splitter) when the position was set, for keeping the
        // proportions or the size of the second pane when the paned is resized.
        this._reference = -1;

        this._lastPosition = null;
        this._drag = null;
        this._previousFocus = null;

        this._splitterEl.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this._splitterEl.addEventListener('keydown', (event) => this._onKeyDown(event));
        this.el.addEventListener('keydown', (event) => this._onPanedKeyDown(event));

        this._paneObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            this._paneObserver = new ResizeObserver(() => {
                if (!this.destroyed) {
                    this._checkPosition();
                }
            });

            this._paneObserver.observe(this._paneEls[0]);
            this._paneObserver.observe(this.el);
        }

        this._queueLayout();
    }

    _render() {
        const firstId = uniqueId('wy-paned-pane');

        const element = createElement(`
            <div class="wy-paned wy-horizontal">
                <div class="wy-paned-pane" id="${firstId}"></div>
                <div class="wy-paned-splitter" role="separator" tabindex="-1" aria-controls="${firstId}"></div>
                <div class="wy-paned-pane"></div>
            </div>
        `);

        this._paneEls = [...element.querySelectorAll('.wy-paned-pane')];
        this._splitterEl = element.querySelector('.wy-paned-splitter');

        return element;
    }

    /**
     * The splitter, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._splitterEl;
    }

    /**
     * The element of the splitter, e.g. for styling.
     *
     * @type {HTMLElement}
     */
    get splitterElement() {
        return this._splitterEl;
    }

    /**
     * Adds a child as the first or second pane.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize] Whether the pane takes part in resizing the paned.
     * @param {boolean} [shrink] Whether the pane may become smaller than the child's minimum size.
     * @returns {import('./widget.js').Widget} The widget.
     * @throws {Error} If the paned already has two children.
     */
    addChild(widget, resize = true, shrink = false) {
        this._pendingOptions = { resize: resize !== false, shrink: Boolean(shrink) };
        try {
            return super.addChild(widget);
        } finally {
            this._pendingOptions = null;
        }
    }

    /**
     * Adds the first pane, like GTK's `pack1()`.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize]
     * @param {boolean} [shrink]
     * @returns {import('./widget.js').Widget}
     */
    pack1(widget, resize = true, shrink = false) {
        this.addChild(widget, resize, shrink);
        this.reorderChild(widget, 0);

        return widget;
    }

    /**
     * Adds the second pane, like GTK's `pack2()`.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize]
     * @param {boolean} [shrink]
     * @returns {import('./widget.js').Widget}
     */
    pack2(widget, resize = true, shrink = false) {
        return this.addChild(widget, resize, shrink);
    }

    insertChild(widget, index) {
        if (this._children.length >= 2) {
            throw new Error('A paned can contain at most two children.');
        }

        const options = this._pendingOptions || { resize: true, shrink: false };

        this._paneOptions.set(widget, options);
        try {
            return super.insertChild(widget, index);
        } catch (error) {
            this._paneOptions.delete(widget);
            throw error;
        }
    }

    removeChild(widget) {
        const index = super.removeChild(widget);

        this._paneOptions.delete(widget);

        return index;
    }

    /**
     * Returns the pane flags of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {PaneOptions}
     * @throws {Error} If the widget is not a child.
     */
    getChildOptions(widget) {
        const options = this._paneOptions.get(widget);
        if (!options) {
            throw new Error('The widget is not a child of this paned.');
        }

        return { ...options };
    }

    /**
     * Changes the pane flags of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {Partial<PaneOptions>} options
     * @throws {Error} If the widget is not a child.
     */
    setChildOptions(widget, options) {
        const current = this.getChildOptions(widget);

        // Keep the current division as the starting point for later size changes.
        const position = this._measurePosition();
        if (this._positionSet && position !== null) {
            this._position = position;
            this._reference = this._getAvailableSize();
        }

        this._paneOptions.set(widget, {
            resize: options.resize ?? current.resize,
            shrink: options.shrink ?? current.shrink,
        });

        this._queueLayout();
    }

    destroy() {
        this._endDrag();
        this._paneObserver?.disconnect();

        super.destroy();
    }

    _attachChildElement(_widget, _index) {
        this._syncPaneElements();
    }

    _detachChildElement(widget) {
        widget.el.remove();
    }

    _onChildrenChange() {
        this._syncPaneElements();

        super._onChildrenChange();
    }

    _syncPaneElements() {
        this._children.forEach((child, index) => {
            const pane = this._paneEls[index];
            if (child.el.parentNode !== pane) {
                pane.append(child.el);
            }
        });
    }

    _getHorizontal() {
        return this._orientation === Orientation.HORIZONTAL;
    }

    /**
     * Returns the size available to both panes together, without the splitter, or -1 when the
     * paned is not rendered.
     *
     * @returns {number}
     */
    _getAvailableSize() {
        if (!this.el.isConnected) {
            return -1;
        }

        const size = this._getHorizontal() ? this.el.clientWidth : this.el.clientHeight;
        if (!size) {
            return -1;
        }

        return Math.max(0, size - SPLITTER_SIZE);
    }

    _getVisiblePanes() {
        return this._children.filter((x) => x.visible);
    }

    _updateLayout() {
        const horizontal = this._getHorizontal();
        const style = this.el.style;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);

        this._splitterEl.setAttribute('aria-orientation', horizontal ? 'vertical' : 'horizontal');

        const visible = this._getVisiblePanes();
        const [first, second] = this._children;

        this._paneEls[0].hidden = !first?.visible;
        this._paneEls[1].hidden = !second?.visible;
        this._splitterEl.hidden = visible.length !== 2;

        let template;
        if (visible.length === 2) {
            template = this._getTemplate(first, second);
        } else if (visible.length === 1) {
            const min = this._paneOptions.get(visible[0]).shrink ? '0px' : 'min-content';
            template =
                visible[0] === first
                    ? `minmax(${min}, 1fr) 0px 0px`
                    : `0px 0px minmax(${min}, 1fr)`;
        } else {
            template = '0px 0px 0px';
        }

        style.gridTemplateColumns = horizontal ? template : '';
        style.gridTemplateRows = horizontal ? '' : template;

        this._checkPosition();
    }

    _getTemplate(first, second) {
        const firstOptions = this._paneOptions.get(first);
        const secondOptions = this._paneOptions.get(second);

        const firstMin = firstOptions.shrink ? '0px' : 'min-content';
        const secondMin = secondOptions.shrink ? '0px' : 'min-content';
        const splitter = `${SPLITTER_SIZE}px`;

        if (!this._positionSet) {
            return `minmax(${firstMin}, 1fr) ${splitter} minmax(${secondMin}, 1fr)`;
        }

        if (this._reference < 0) {
            this._reference = this._getAvailableSize();
        }

        const reference = Math.max(this._reference, 0);
        const position = this._clampPosition(this._position, reference);
        const rest = Math.max(0, reference - position);

        if (firstOptions.resize === secondOptions.resize) {
            // Both panes keep their proportions.
            return (
                `minmax(${firstMin}, ${position}fr) ${splitter} ` +
                `minmax(${secondMin}, ${rest}fr)`
            );
        }

        if (firstOptions.resize) {
            // The second pane keeps its size.
            return `minmax(${firstMin}, 1fr) ${splitter} minmax(${secondMin}, ${rest}px)`;
        }

        // The first pane keeps its size.
        return `minmax(${firstMin}, ${position}px) ${splitter} minmax(${secondMin}, 1fr)`;
    }

    _clampPosition(position, available) {
        const maximum = Math.min(this._maxSplitterPosition, available);
        const minimum = Math.min(this._minSplitterPosition, maximum);

        return clamp(position, Math.max(0, minimum), Math.max(0, maximum));
    }

    /**
     * Returns the rendered position of the splitter, or `null` when it is not shown.
     *
     * @returns {number | null}
     */
    _measurePosition() {
        if (this._splitterEl.hidden || !this.el.isConnected) {
            return null;
        }

        const splitter = this._splitterEl.getBoundingClientRect();
        const own = this.el.getBoundingClientRect();
        if (!own.width && !own.height) {
            return null;
        }

        const position = this._getHorizontal()
            ? splitter.left - own.left - this.el.clientLeft
            : splitter.top - own.top - this.el.clientTop;

        return Math.round(position);
    }

    _checkPosition() {
        const position = this._measurePosition();
        if (position === null) {
            return;
        }

        const available = this._getAvailableSize();
        this._splitterEl.setAttribute('aria-valuenow', String(position));
        this._splitterEl.setAttribute('aria-valuemin', '0');
        this._splitterEl.setAttribute('aria-valuemax', String(Math.max(0, available)));

        if (position !== this._lastPosition) {
            this._lastPosition = position;
            this.emit('position-change', this);
        }
    }

    /**
     * Moves the splitter as the user does: the position is clamped to the minimum sizes of the
     * panes, and the rendered position is stored.
     *
     * @param {number} position
     */
    _moveSplitter(position) {
        const available = this._getAvailableSize();
        if (available < 0) {
            this.position = position;

            return;
        }

        this._position = this._clampPosition(Math.round(position), available);
        this._reference = available;
        this._positionSet = true;

        this._updateLayout();

        // Store what the panes' minimum sizes allowed.
        const actual = this._measurePosition();
        if (actual !== null) {
            this._position = actual;
        }
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive || this._drag) {
            return;
        }

        event.preventDefault();

        const horizontal = this._getHorizontal();
        const splitter = this._splitterEl.getBoundingClientRect();
        const offset = horizontal ? event.clientX - splitter.left : event.clientY - splitter.top;

        this._splitterEl.setPointerCapture(event.pointerId);

        const move = (moveEvent) => {
            const own = this.el.getBoundingClientRect();
            const pointer = horizontal
                ? moveEvent.clientX - own.left - this.el.clientLeft
                : moveEvent.clientY - own.top - this.el.clientTop;

            this._moveSplitter(pointer - offset);
        };

        const end = () => this._endDrag();

        this._splitterEl.addEventListener('pointermove', move);
        this._splitterEl.addEventListener('pointerup', end);
        this._splitterEl.addEventListener('pointercancel', end);

        this._drag = { move, end };
        this.el.classList.add('wy-dragging');

        getCursor().pushShape(horizontal ? CursorShape.RESIZE_H : CursorShape.RESIZE_V, 'paned');
    }

    _endDrag() {
        const drag = this._drag;
        if (!drag) {
            return;
        }

        this._drag = null;
        this.el.classList.remove('wy-dragging');

        this._splitterEl.removeEventListener('pointermove', drag.move);
        this._splitterEl.removeEventListener('pointerup', drag.end);
        this._splitterEl.removeEventListener('pointercancel', drag.end);

        getCursor().popShape('paned');
    }

    /**
     * Gives the splitter the keyboard focus, as F8 does.
     *
     * @returns {boolean} Whether the splitter got the focus.
     */
    focusSplitter() {
        if (this._splitterEl.hidden || !this.isSensitive || !this.isVisible) {
            return false;
        }

        this._previousFocus = this.window?.focusWidget ?? null;
        this._splitterEl.focus({ preventScroll: true });

        return document.activeElement === this._splitterEl;
    }

    _onPanedKeyDown(event) {
        if (event.key !== Key.F8 || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        // F8 focuses the splitter of the innermost paned, and again the next outer one.
        if (event.target === this._splitterEl) {
            return;
        }

        if (this.focusSplitter()) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    _onKeyDown(event) {
        if (event.ctrlKey || event.altKey || event.metaKey || this._splitterEl.hidden) {
            return;
        }

        // Escape and Enter give the focus back to where it was before F8.
        if (event.key === Key.ESCAPE || event.key === Key.ENTER) {
            const previous = this._previousFocus;
            this._previousFocus = null;

            if (previous && !previous.destroyed && previous.focus()) {
                event.preventDefault();
                event.stopPropagation();
            } else {
                this._splitterEl.blur();
            }

            return;
        }

        const horizontal = this._getHorizontal();
        const available = this._getAvailableSize();
        const current = this._measurePosition() ?? 0;
        const page = Math.max(KEY_STEP, Math.round(available * KEY_PAGE_FRACTION));

        const decrease = horizontal ? Key.LEFT : Key.UP;
        const increase = horizontal ? Key.RIGHT : Key.DOWN;

        let position;
        switch (event.key) {
            case decrease:
                position = current - KEY_STEP;
                break;

            case increase:
                position = current + KEY_STEP;
                break;

            case Key.PAGE_UP:
                position = current - page;
                break;

            case Key.PAGE_DOWN:
                position = current + page;
                break;

            case Key.HOME:
                position = 0;
                break;

            case Key.END:
                position = available;
                break;

            default:
                return;
        }

        event.preventDefault();
        event.stopPropagation();

        this._moveSplitter(position);
    }
}

defineProperties(Paned, {
    /**
     * The direction the panes are placed in: one of `Orientation`. Horizontal places them side
     * by side, with a vertical splitter.
     */
    orientation: {
        value: Orientation.HORIZONTAL,
        changed() {
            this._reference = -1;
            this._queueLayout();
        },
    },

    /**
     * The position of the splitter: the size of the first pane in pixels. Reading it returns
     * the rendered position when the paned is shown. Setting it sets `positionSet`.
     */
    position: {
        value: -1,
        signal: false,
        get() {
            return this._measurePosition() ?? this._position;
        },
        set(position) {
            const value = Number(position);
            if (!Number.isFinite(value)) {
                throw new TypeError(`Invalid paned position: ${position}.`);
            }

            if (value < 0) {
                this.positionSet = false;

                return false;
            }

            this._position = Math.round(value);
            this._reference = this._getAvailableSize();

            if (!this._positionSet) {
                this._positionSet = true;
                this.emit('position-set-change', this);
            }

            this._queueLayout();

            return false;
        },
    },

    /**
     * Whether `position` was set. When `false`, the panes share the space equally.
     */
    positionSet: {
        value: false,
        changed(positionSet) {
            if (!positionSet) {
                this._position = -1;
                this._reference = -1;
            } else if (this._position < 0) {
                this._position = this._measurePosition() ?? 0;
                this._reference = this._getAvailableSize();
            }

            this._queueLayout();
        },
    },

    /**
     * The original toolkit's name of `position`.
     */
    splitterPosition: {
        signal: false,
        get() {
            return this.position;
        },
        set(position) {
            this.position = position;

            return false;
        },
    },

    /**
     * The smallest position the splitter can have, in pixels.
     */
    minSplitterPosition: {
        value: 0,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The largest position the splitter can have, in pixels.
     */
    maxSplitterPosition: {
        value: Infinity,
        changed() {
            this._queueLayout();
        },
    },
});

Paned.builderProperties = {
    /**
     * Builds the (at most two) children. A child object may have `resize` and `shrink` flags
     * besides the widget's own properties.
     *
     * @param {object} builder
     * @param {Paned} paned
     * @param {object[]} children
     */
    children(builder, paned, children) {
        if (!Array.isArray(children)) {
            throw new Error('Paned children must be an array.');
        }

        for (const child of children) {
            const { resize, shrink, ...spec } = child;

            paned.addChild(builder.build(spec)[0], resize ?? true, shrink ?? false);
        }
    },
};

registerType('paned', Paned);
