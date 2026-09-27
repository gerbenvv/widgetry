/**
 * @module widgets/window
 */

import { getCursor } from '../core/cursor.js';
import { CursorShape } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { getScreen } from '../core/screen.js';
import { clamp, createElement, uniqueId } from '../core/util.js';
import { MouseButton } from '../events/constants.js';
import { AbstractWindow } from './abstract-window.js';
import { attachDoublePress } from './double-press.js';

/**
 * Resize handle directions and their cursors.
 *
 * @type {Readonly<Record<string, string>>}
 */
const RESIZE_CURSORS = Object.freeze({
    n: CursorShape.RESIZE_N,
    ne: CursorShape.RESIZE_NE,
    e: CursorShape.RESIZE_E,
    se: CursorShape.RESIZE_SE,
    s: CursorShape.RESIZE_S,
    sw: CursorShape.RESIZE_SW,
    w: CursorShape.RESIZE_W,
    nw: CursorShape.RESIZE_NW,
});

/**
 * A floating window with a title bar, which the user can move, resize, maximize and close.
 *
 * Windows are hidden until shown with `show()` or `present()`. By default a window is centered
 * when first shown; set `x` and `y` (or call `move()`) to place it. Closing destroys the window,
 * unless `destroyOnClose` is `false`, in which case it is hidden.
 *
 * Signals: `close-request` (return `true` from a handler to keep the window open), `close`,
 * `position-change`, `size-change`, `maximized-change`.
 */
export class Window extends AbstractWindow {
    _initialize() {
        super._initialize();

        this._placed = false;
        this._userSize = null;
        this._restoreRect = null;
        this._overlayEl = null;
        this._gesture = null;

        this._onScreenSizeChange = this._onScreenSizeChange.bind(this);
        getScreen().connect('size-change', this._onScreenSizeChange);

        this._headerEl.addEventListener('pointerdown', (event) => this._onHeaderPointerDown(event));
        attachDoublePress(this._headerEl, (event) => this._onHeaderDoubleClick(event));

        for (const button of this._headerEl.querySelectorAll('button')) {
            button.addEventListener('click', () =>
                this._onHeaderButtonClick(button.dataset.action)
            );
        }

        for (const resizer of this.el.querySelectorAll('[data-resize]')) {
            resizer.addEventListener('pointerdown', (event) =>
                this._onResizerPointerDown(event, resizer.dataset.resize)
            );
        }

        this._syncDecorations();
    }

    _render() {
        const titleId = uniqueId('wy-window-title');

        const element = createElement(`
            <div class="wy-window" role="dialog" aria-labelledby="${titleId}">
                <div class="wy-window-header">
                    <div class="wy-window-title" id="${titleId}"></div>
                    <div class="wy-window-buttons">
                        <button type="button" class="wy-window-button wy-window-maximize" data-action="maximize" tabindex="-1" data-wy-label="Maximize"></button>
                        <button type="button" class="wy-window-button wy-window-restore" data-action="restore" tabindex="-1" data-wy-label="Restore"></button>
                        <button type="button" class="wy-window-button wy-window-close" data-action="close" tabindex="-1" data-wy-label="Close"></button>
                    </div>
                </div>
                <div class="wy-window-body"></div>
                <div class="wy-window-resizer" data-resize="n"></div>
                <div class="wy-window-resizer" data-resize="e"></div>
                <div class="wy-window-resizer" data-resize="s"></div>
                <div class="wy-window-resizer" data-resize="w"></div>
                <div class="wy-window-resizer" data-resize="ne"></div>
                <div class="wy-window-resizer" data-resize="se"></div>
                <div class="wy-window-resizer" data-resize="sw"></div>
                <div class="wy-window-resizer" data-resize="nw"></div>
                <div class="wy-window-grip" data-resize="se"></div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-window-header');
        this._titleEl = element.querySelector('.wy-window-title');
        this._bodyEl = element.querySelector('.wy-window-body');

        return element;
    }

    /**
     * Moves the window. The same as setting `position`.
     *
     * @param {number} x
     * @param {number} y
     */
    move(x, y) {
        this.position = { x, y };
    }

    /**
     * Resizes the window.
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this._userSize = { width, height };
        this._applySize();
        this._constrain();

        this.emit('size-change', this);
    }

    /**
     * Centers the window on the screen, or over `transientFor` if set.
     */
    center() {
        const size = this._getSize();
        const screen = getScreen().size;

        let x = (screen.width - size.width) / 2;
        let y = (screen.height - size.height) / 2;

        const parent = this._transientFor;
        if (parent?.visible && !parent.el.classList.contains('wy-main-window')) {
            const rect = parent.el.getBoundingClientRect();
            x = rect.left + (rect.width - size.width) / 2;
            y = rect.top + (rect.height - size.height) / 3;
        }

        this._setPosition(Math.round(x), Math.round(y));
    }

    /**
     * Requests to close the window, as if the close button was clicked. Handlers of
     * `close-request` can cancel it by returning `true`.
     *
     * @returns {boolean} Whether the window closed.
     */
    close() {
        if (this.emit('close-request', this)) {
            return false;
        }

        this.emit('close', this);

        // A handler may have destroyed the window already.
        if (this.destroyed) {
            return true;
        }

        if (this._destroyOnClose) {
            this.destroy();
        } else {
            this.hide();
        }

        return true;
    }

    destroy() {
        getScreen().disconnect('size-change', this._onScreenSizeChange);

        this._endGesture();
        this._overlayEl?.remove();

        super.destroy();
    }

    _onVisibleChange(visible) {
        if (visible) {
            getScreen().layer.append(this.el);
        }

        super._onVisibleChange(visible);

        if (visible) {
            this._raise();
            this._syncOverlay();

            if (!this._placed) {
                this._placed = true;

                if (this._x < 0 || this._y < 0) {
                    const x = this._x;
                    const y = this._y;
                    this.center();

                    // Keep an explicitly given coordinate.
                    this._setPosition(x < 0 ? this._x : x, y < 0 ? this._y : y);
                } else {
                    this._setPosition(this._x, this._y);
                }
            }

            this._constrain();
        } else {
            this._endGesture();
            this._syncOverlay();
            this.el.remove();
        }
    }

    _raise() {
        if (!this._visible) {
            return;
        }

        const screen = getScreen();

        if (this._modal && this._overlayEl) {
            this._overlayEl.style.zIndex = String(screen.nextZIndex());
        }

        this.el.style.zIndex = String(screen.nextZIndex());
    }

    _syncOverlay() {
        const wanted = this._modal && this._visible;

        if (wanted && !this._overlayEl) {
            this._overlayEl = createElement('<div class="wy-overlay"></div>');
            this._overlayEl.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                this._blink();
            });
        }

        if (wanted) {
            this.el.before(this._overlayEl);
            this._overlayEl.style.zIndex = String(Math.max(0, this.zIndex - 1));
        } else {
            this._overlayEl?.remove();
        }
    }

    _applyLayoutStyle() {
        // The size request is the default size of the window, until the user resizes it.
        this._applySize();
    }

    _applySize() {
        const style = this.el.style;
        const size = this._userSize || { width: this._width, height: this._height };

        style.width = size.width >= 0 ? `${size.width}px` : '';
        style.height = size.height >= 0 ? `${size.height}px` : '';
    }

    _getSize() {
        return { width: this.el.offsetWidth, height: this.el.offsetHeight };
    }

    _setPosition(x, y) {
        this._x = x;
        this._y = y;

        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
    }

    _constrain() {
        if (!this._visible || this._maximized) {
            return;
        }

        const screen = getScreen().size;
        const size = this._getSize();

        // Shrink to the screen first, then keep the whole window (and so its title bar) on it.
        if (size.width > screen.width || size.height > screen.height) {
            this._userSize = this._userSize || { ...size };
        }

        if (this._userSize) {
            let changed = false;
            if (size.width > screen.width) {
                this._userSize.width = screen.width;
                changed = true;
            }

            if (size.height > screen.height) {
                this._userSize.height = screen.height;
                changed = true;
            }

            if (changed) {
                this._applySize();
            }
        }

        const width = Math.min(this.el.offsetWidth, screen.width);
        const height = Math.min(this.el.offsetHeight, screen.height);

        this._setPosition(
            clamp(this._x, 0, Math.max(0, screen.width - width)),
            clamp(this._y, 0, Math.max(0, screen.height - height))
        );
    }

    _syncDecorations() {
        const decorated = this._decorated;
        const resizable = this._resizable && decorated && !this._maximized;

        this.el.classList.toggle('wy-undecorated', !decorated);
        this.el.classList.toggle('wy-resizable', resizable);
        this.el.classList.toggle('wy-maximized', this._maximized);
        this.el.classList.toggle('wy-has-grip', resizable && this._hasResizeGrip);
        this.el.classList.toggle('wy-closable', this._closable);
        this.el.classList.toggle('wy-maximizable', this._maximizable);
    }

    _onScreenSizeChange() {
        this._constrain();
    }

    _onHeaderButtonClick(action) {
        switch (action) {
            case 'close':
                this.close();
                break;

            case 'maximize':
                this.maximized = true;
                break;

            case 'restore':
                this.maximized = false;
                break;
        }
    }

    _onHeaderDoubleClick(event) {
        if (event.target.closest('button') || !this._maximizable) {
            return;
        }

        this.maximized = !this._maximized;
    }

    _onHeaderPointerDown(event) {
        if (event.button !== MouseButton.PRIMARY - 1 || event.target.closest('button')) {
            return;
        }

        if (!this._movable || this._maximized) {
            return;
        }

        const rect = this.el.getBoundingClientRect();
        this._startGesture(
            event,
            CursorShape.MOVE,
            (moveEvent) => {
                const screen = getScreen().size;

                const x = moveEvent.clientX - (event.clientX - rect.left);
                const y = moveEvent.clientY - (event.clientY - rect.top);

                this._setPosition(
                    Math.round(clamp(x, 0, Math.max(0, screen.width - rect.width))),
                    Math.round(clamp(y, 0, Math.max(0, screen.height - rect.height)))
                );
            },
            () => this.emit('position-change', this)
        );
    }

    _onResizerPointerDown(event, direction) {
        if (event.button !== MouseButton.PRIMARY - 1 || !this._resizable || this._maximized) {
            return;
        }

        event.stopPropagation();

        const start = this.el.getBoundingClientRect();
        const screen = getScreen().size;

        this._startGesture(
            event,
            RESIZE_CURSORS[direction],
            (moveEvent) => {
                const dx = clamp(moveEvent.clientX, 0, screen.width) - event.clientX;
                const dy = clamp(moveEvent.clientY, 0, screen.height) - event.clientY;

                let width = start.width;
                let height = start.height;

                if (direction.includes('e')) {
                    width = start.width + dx;
                } else if (direction.includes('w')) {
                    width = start.width - dx;
                }

                if (direction.includes('s')) {
                    height = start.height + dy;
                } else if (direction.includes('n')) {
                    height = start.height - dy;
                }

                this._userSize = { width: Math.round(width), height: Math.round(height) };
                this._applySize();

                // The minimum size may have limited the new size; anchor the opposite edge.
                const actual = this._getSize();
                const x = direction.includes('w') ? start.right - actual.width : start.left;
                const y = direction.includes('n') ? start.bottom - actual.height : start.top;

                this._setPosition(Math.round(x), Math.round(y));
            },
            () => {
                this._userSize = this._getSize();
                this._applySize();

                this.emit('size-change', this);
            }
        );
    }

    _startGesture(event, shape, onMove, onEnd) {
        this._endGesture();

        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);

        const move = (moveEvent) => onMove(moveEvent);
        const end = () => {
            this._endGesture();
            onEnd?.();
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);

        getCursor().pushShape(shape, 'window');

        this._gesture = { target, move, end };

        event.preventDefault();
    }

    _endGesture() {
        const gesture = this._gesture;
        if (!gesture) {
            return;
        }

        this._gesture = null;

        gesture.target.removeEventListener('pointermove', gesture.move);
        gesture.target.removeEventListener('pointerup', gesture.end);
        gesture.target.removeEventListener('pointercancel', gesture.end);

        getCursor().popShape('window');
    }
}

defineProperties(Window, {
    title: {
        value: '',
        changed(title) {
            this._titleEl.textContent = title;
        },
    },

    /**
     * The position of the window's top-left corner on the screen, as `{x, y}`. A negative
     * coordinate centers the window in that direction when it is first shown.
     */
    position: {
        get() {
            return { x: this._x, y: this._y };
        },
        set(position) {
            if (position.x === this._x && position.y === this._y) {
                return false;
            }

            this._placed = this._visible || this._placed;

            if (this._visible) {
                this._setPosition(position.x, position.y);
                this._constrain();
            } else {
                this._x = position.x;
                this._y = position.y;
            }
        },
    },

    /**
     * The x coordinate of the window, or -1 to center it.
     */
    x: {
        value: -1,
        signal: false,
        set(x) {
            this.position = { x, y: this._y };

            return false;
        },
    },

    /**
     * The y coordinate of the window, or -1 to center it.
     */
    y: {
        value: -1,
        signal: false,
        set(y) {
            this.position = { x: this._x, y };

            return false;
        },
    },

    /**
     * The window whose top this window floats on, e.g. the parent of a dialog. It is centered over
     * it when first shown.
     */
    transientFor: { value: null },

    /**
     * Whether the window fills the screen. Only has an effect when `maximizable`.
     */
    maximized: {
        value: false,
        set(maximized) {
            if (maximized && !this._maximizable) {
                return false;
            }

            if (maximized) {
                this._restoreRect = {
                    x: this._x,
                    y: this._y,
                    size: this._userSize && { ...this._userSize },
                };
            }

            this._maximized = maximized;
            this._syncDecorations();

            if (!maximized && this._restoreRect) {
                this._userSize = this._restoreRect.size;
                this._applySize();
                this._setPosition(this._restoreRect.x, this._restoreRect.y);
                this._constrain();

                this._restoreRect = null;
            }
        },
    },

    /**
     * Whether the window can be maximized. Shows or hides the maximize button.
     */
    maximizable: {
        value: true,
        changed(maximizable) {
            if (!maximizable && this._maximized) {
                this.maximized = false;
            }

            this._syncDecorations();
        },
    },

    /**
     * Whether the user can resize the window.
     */
    resizable: {
        value: true,
        changed() {
            this._syncDecorations();
        },
    },

    /**
     * Whether the window has a close button.
     */
    closable: {
        value: true,
        changed() {
            this._syncDecorations();
        },
    },

    /**
     * Whether the user can move the window by dragging its title bar.
     */
    movable: { value: true },

    /**
     * Whether closing destroys the window. If `false`, closing hides it, so it can be shown again.
     */
    destroyOnClose: { value: true },

    modal: {
        value: false,
        changed() {
            this._syncOverlay();
            this._raise();
        },
    },

    /**
     * The opacity of the window, from 0 to 1.
     */
    opacity: {
        value: 1,
        coerce(opacity) {
            return clamp(Number(opacity), 0, 1);
        },
        changed(opacity) {
            this.el.style.opacity = opacity === 1 ? '' : String(opacity);
        },
    },

    /**
     * Whether the window has a title bar and border. Undecorated windows cannot be resized by the
     * user.
     */
    decorated: {
        value: true,
        changed() {
            this._syncDecorations();
        },
    },

    /**
     * Whether a resizable window shows a resize grip in its bottom-right corner.
     */
    hasResizeGrip: {
        value: true,
        changed() {
            this._syncDecorations();
        },
    },
});

registerType('window', Window);
