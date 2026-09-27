/**
 * @module widgets/abstract-window
 */

import { Application } from '../core/application.js';
import { FocusDirection } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { Key } from '../events/constants.js';
import { Bin } from './bin.js';
import { Widget } from './widget.js';

/**
 * Base class of top-level widgets.
 *
 * A window remembers its own focus widget. Only the active window has the keyboard focus; when
 * a window becomes active again, its focus widget gets the focus back. Tab and Shift+Tab move the
 * focus through the window's focusable widgets in tree order, wrapping around at the ends.
 *
 * Windows are hidden until shown. Signals: `active-change` (`window`) when the window becomes
 * active or inactive, and `focus-widget-change` (`window`).
 */
export class AbstractWindow extends Bin {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-window-base', 'wy-inactive');

        this.el.addEventListener('focusin', (event) => this._onFocusIn(event));
        this.el.addEventListener('focusout', (event) => this._onFocusOut(event));
        this.el.addEventListener('keydown', (event) => this._onWindowKeyDown(event));

        Application._addWindow(this);
    }

    /**
     * Shows the window and makes it active.
     */
    present() {
        this.visible = true;
        this.active = true;
    }

    /**
     * Moves the focus within the window.
     *
     * @param {string} direction One of `FocusDirection`.
     * @returns {boolean} Whether a widget got the focus.
     */
    moveFocus(direction) {
        if (!Object.values(FocusDirection).includes(direction)) {
            throw new RangeError(`Invalid focus direction '${direction}'.`);
        }

        const chain = this._getFocusChain();
        if (!chain.length) {
            return false;
        }

        const current = chain.indexOf(this._focusWidget);

        let order;
        switch (direction) {
            case FocusDirection.START:
                order = chain;
                break;

            case FocusDirection.END:
                order = [...chain].reverse();
                break;

            case FocusDirection.BACKWARD: {
                const start = current < 0 ? chain.length - 1 : current - 1;
                order = [
                    ...chain.slice(0, start + 1).reverse(),
                    ...chain.slice(start + 1).reverse(),
                ];
                break;
            }

            default: {
                const start = current < 0 ? 0 : current + 1;
                order = [...chain.slice(start), ...chain.slice(0, start)];
                break;
            }
        }

        for (const widget of order) {
            if (widget !== this._focusWidget && widget.focus()) {
                return true;
            }
        }

        return false;
    }

    destroy() {
        const wasActive = this._active;
        if (wasActive) {
            Application.activeWindow = null;
        }

        super.destroy();

        Application._removeWindow(this);

        if (wasActive) {
            Application._activateNextWindow(this);
        }
    }

    /**
     * The stacking order of the window; higher is on top.
     *
     * @type {number}
     */
    get zIndex() {
        return Number(this.el.style.zIndex) || 0;
    }

    /**
     * Whether this window is stacked above another window.
     *
     * @protected
     * @param {AbstractWindow} window
     * @returns {boolean}
     */
    _isAbove(window) {
        return this.zIndex > window.zIndex;
    }

    /**
     * Draws attention to the window, e.g. when a click on another window was blocked because this
     * window is modal.
     *
     * @protected
     */
    _blink() {
        this.el.classList.remove('wy-blink');

        // Restart the animation.
        void this.el.offsetWidth;

        this.el.classList.add('wy-blink');
    }

    /**
     * Handles showing and hiding. Subclasses extend this to attach and detach their element.
     *
     * @protected
     * @param {boolean} visible
     */
    _onVisibleChange(visible) {
        this.el.hidden = !visible;

        this._recalculateVisibility();
        this._recalculateSensitivity();

        if (visible) {
            if (this._activateOnShow) {
                this.active = true;
            }
        } else if (this._active) {
            Application.activeWindow = null;
            Application._activateNextWindow(this);
        }
    }

    _isShown() {
        return this._visible;
    }

    /**
     * Sets the active flag. Called by the application, which ensures a single active window.
     *
     * @protected
     * @param {boolean} active
     */
    _setActive(active) {
        if (active === this._active) {
            return;
        }

        this._active = active;

        this.el.classList.toggle('wy-inactive', !active);
        this.el.classList.toggle('wy-active', active);

        if (active) {
            this._raise();
            this._takeFocus();
        } else if (this.el.contains(document.activeElement)) {
            /** @type {HTMLElement} */ (document.activeElement).blur();
        }

        this._syncFocusStates();

        this.emit('active-change', this);
    }

    /**
     * Moves the keyboard focus into the window: to its focus widget, or else the first widget that
     * can take it, or else the window itself so that it gets key events.
     *
     * @protected
     */
    _takeFocus() {
        if (!this.el.contains(document.activeElement) || document.activeElement === this.el) {
            if (!this._focusWidget || !this._focusWidget.focus()) {
                this.moveFocus(FocusDirection.START);
            }
        }

        if (!this.el.contains(document.activeElement)) {
            this.el.tabIndex = -1;
            this.el.focus({ preventScroll: true });
        }
    }

    /**
     * Brings the window to the front. Overridden by floating windows.
     *
     * @protected
     */
    _raise() {}

    /**
     * Activates the window because the keyboard focus moved into it.
     *
     * @protected
     */
    _activateFromFocus() {
        if (!this._active) {
            Application.activeWindow = this;
        }
    }

    /**
     * Sets the focus widget of the window without moving the DOM focus.
     *
     * @protected
     * @param {Widget | null} widget
     */
    _setFocusWidget(widget) {
        if (widget === this._focusWidget) {
            this._syncFocusStates();

            return;
        }

        const old = this._focusWidget;
        this._focusWidget = widget;

        old?._setFocusState(false, false);

        // Update the focus child chain from the widget up to the window.
        if (widget) {
            let child = widget;
            let parent = widget.parent;
            while (parent) {
                parent._setFocusChild(child);

                child = parent;
                parent = parent.parent;
            }
        } else {
            this._clearFocusChain();
        }

        this._syncFocusStates();

        this.emit('focus-widget-change', this);
    }

    _syncFocusStates() {
        const widget = this._focusWidget;
        if (!widget) {
            if (this._active) {
                Application._setFocusWidget(null);
            }

            return;
        }

        // While a popup (a menu or popover) of the window has the DOM focus, the focus widget keeps
        // the focus.
        const activeElement = document.activeElement;
        const inPopup = Boolean(
            activeElement?.closest?.('[data-wy-popup], .wy-screen > .wy-popover')
        );
        const hasFocus = this._active && (widget.focusElement.contains(activeElement) || inPopup);
        widget._setFocusState(true, hasFocus);

        if (this._active) {
            Application._setFocusWidget(hasFocus ? widget : null);
        }
    }

    /**
     * Moves the focus away from a widget that is being hidden, made insensitive, unparented or
     * destroyed.
     *
     * @protected
     * @param {Widget} widget
     */
    _onFocusWidgetGone(widget) {
        const focusWidget = this._focusWidget;
        if (!focusWidget || !widget.isAncestorOf(focusWidget)) {
            return;
        }

        const hadFocus = focusWidget.hasFocus;

        focusWidget._setFocusState(false, false);
        this._focusWidget = null;

        if (hadFocus) {
            // Try the next widget; if there is none, keep the focus on the window.
            const chain = this._getFocusChain().filter((x) => !widget.isAncestorOf(x));
            if (!chain.some((x) => x.focus())) {
                this.el.tabIndex = -1;
                this.el.focus({ preventScroll: true });
            }
        }

        if (this._focusWidget === null) {
            this._clearFocusChain();
            this.emit('focus-widget-change', this);
        }
    }

    _onFocusIn(event) {
        this._activateFromFocus();

        // A modal window above keeps the keyboard focus.
        const activeWindow = Application.activeWindow;
        if (!this._active && activeWindow && activeWindow !== this) {
            activeWindow._takeFocus();

            return;
        }

        // Find the widget whose focus element got the focus.
        let widget = Widget.fromElement(event.target);
        while (widget && widget !== this && !widget.focusElement.contains(event.target)) {
            widget = widget.parent;
        }

        while (widget && widget !== this && !widget.canFocus) {
            widget = widget.parent;
        }

        if (widget && widget !== this && widget.window === this) {
            this._setFocusWidget(widget);
        } else {
            this._syncFocusStates();
        }
    }

    _onFocusOut(_event) {
        // The new focus is not known yet; check once it moved.
        queueMicrotask(() => {
            if (!this.destroyed) {
                this._syncFocusStates();
            }
        });
    }

    _onWindowKeyDown(event) {
        if (
            event.defaultPrevented ||
            event.key !== Key.TAB ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        // Only handle Tab for our own widgets, not for nested windows.
        if (Widget.fromElement(event.target)?.window !== this && event.target !== this.el) {
            return;
        }

        if (this.moveFocus(event.shiftKey ? FocusDirection.BACKWARD : FocusDirection.FORWARD)) {
            event.preventDefault();
        } else if (this._getFocusChain().length) {
            // The only focusable widget already has the focus; keep it inside the window.
            event.preventDefault();
        }
    }
}

defineProperties(AbstractWindow, {
    isTopLevel: { value: true, readOnly: true },

    isWindow: { value: true, readOnly: true },

    visible: {
        value: false,
        changed(visible) {
            this._onVisibleChange(visible);
        },
    },

    /**
     * The title of the window.
     */
    title: { value: '' },

    /**
     * Whether the window is active: it has the keyboard focus. Only one window is active at a
     * time.
     */
    active: {
        value: false,
        signal: false,
        set(active) {
            if (active) {
                if (!this._visible) {
                    return false;
                }

                Application.activeWindow = this;
            } else if (Application.activeWindow === this) {
                Application.activeWindow = null;
            }

            return false;
        },
    },

    /**
     * Whether the window becomes active when shown.
     */
    activateOnShow: { value: true },

    /**
     * Whether the window blocks interaction with the windows below it while shown.
     */
    modal: { value: false },

    /**
     * The widget with the focus within this window, or `null`. Setting it focuses the widget.
     */
    focusWidget: {
        value: null,
        signal: false,
        set(widget) {
            if (widget) {
                if (widget.window !== this) {
                    throw new Error('The widget is not in this window.');
                }

                widget.focus();
            } else {
                this._focusWidget?.blur();
            }

            return false;
        },
    },
});
