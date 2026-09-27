/**
 * @module core/application
 */

import { Events } from '../events/constants.js';
import { createToolkitEvent, EVENT_BINDINGS } from '../widgets/widget.js';
import { defineProperties, Instance } from './instance.js';
import { getScreen } from './screen.js';
import { settings } from './settings.js';

/**
 * Elements that take the focus (or a text selection) when pressed. Buttons, selects and links
 * taken out of the focus chain (like the title bar buttons of a window) do not.
 *
 * @type {string}
 */
const FOCUSABLE_SELECTOR = [
    'input',
    'textarea',
    'select:not([tabindex="-1"])',
    'button:not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** @type {ReadonlyArray<string>} */
const THEMES = ['light', 'dark', 'auto'];

/**
 * The application singleton manages the windows, the global focus and toolkit-wide settings.
 * Import it as `Application`.
 *
 * Signals: `load` (once the document is ready), `active-window-change`, `main-window-change`,
 * `focus-widget-change`, and the event signals selected by `events` for events that no widget
 * handled.
 */
export class ApplicationClass extends Instance {
    _initialize() {
        super._initialize();

        /** @type {Set<import('../widgets/abstract-window.js').AbstractWindow>} */
        this._windows = new Set();

        // The windows in the order they were last active, the most recent last.
        /** @type {import('../widgets/abstract-window.js').AbstractWindow[]} */
        this._activationOrder = [];

        this._loaded = false;

        // Attached document listeners for application event signals, by DOM event name.
        this._domListeners = new Map();

        if (typeof document === 'undefined') {
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._onLoad(), { once: true });
        } else {
            queueMicrotask(() => this._onLoad());
        }

        // Track which window the keyboard focus is in, also when it moves outside the toolkit.
        document.addEventListener('focusin', (event) => this._onDocumentFocusIn(event), true);
        document.addEventListener(
            'pointerdown',
            (event) => this._onDocumentPointerDown(event),
            true
        );
        document.addEventListener('mousedown', (event) => this._onDocumentMouseDown(event), true);
    }

    /**
     * Runs a function once the document is ready (immediately if it already is).
     *
     * @param {() => void} method
     */
    ready(method) {
        if (this._loaded) {
            method();
        } else {
            this.connect('load', method);
        }
    }

    /**
     * The screen singleton.
     *
     * @type {import('./screen.js').Screen}
     */
    get screen() {
        return getScreen();
    }

    /**
     * All windows that exist (shown or not).
     *
     * @type {import('../widgets/abstract-window.js').AbstractWindow[]}
     */
    get windows() {
        return [...this._windows];
    }

    /**
     * Enables application event signals.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events) {
        this.events = this._events | events;
    }

    /**
     * Disables application event signals.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events) {
        this.events = this._events & ~events;
    }

    /**
     * Registers a window. Called by windows.
     *
     * @protected
     * @param {import('../widgets/abstract-window.js').AbstractWindow} window
     */
    _addWindow(window) {
        this._windows.add(window);
    }

    /**
     * Unregisters a window. Called by windows.
     *
     * @protected
     * @param {import('../widgets/abstract-window.js').AbstractWindow} window
     */
    _removeWindow(window) {
        this._windows.delete(window);
        this._activationOrder = this._activationOrder.filter((x) => x !== window);

        if (this._activeWindow === window) {
            this.activeWindow = null;
        }

        if (this._mainWindow === window) {
            this._setMainWindow(null);
        }
    }

    /**
     * Activates another window after the active window was hidden or destroyed, like a desktop
     * window manager: the most recently active window that is still shown, or else the topmost
     * one. Does nothing if another window is active already.
     *
     * @protected
     * @param {import('../widgets/abstract-window.js').AbstractWindow} window The window that
     *     is gone.
     */
    _activateNextWindow(window) {
        if (this._activeWindow) {
            return;
        }

        const modal = this.modalWindow;
        const candidates = [...this._windows]
            .filter((x) => x !== window && x.visible && !x.destroyed)
            .filter((x) => !modal || x === modal || x._isAbove(modal));

        const recent = [...this._activationOrder].reverse().find((x) => candidates.includes(x));
        const topmost = candidates.reduce(
            (result, x) => (!result || x._isAbove(result) ? x : result),
            null
        );

        const next = recent || topmost;
        if (next) {
            this.activeWindow = next;
        }
    }

    /**
     * @protected
     * @param {import('../widgets/main-window.js').MainWindow | null} mainWindow
     */
    _setMainWindow(mainWindow) {
        if (this._mainWindow !== mainWindow) {
            this._mainWindow = mainWindow;

            this.emit('main-window-change', this);
        }
    }

    /**
     * Updates the global focus widget. Called by windows.
     *
     * @protected
     * @param {import('../widgets/widget.js').Widget | null} widget
     */
    _setFocusWidget(widget) {
        if (this._focusWidget !== widget) {
            this._focusWidget = widget;

            this.emit('focus-widget-change', this);
        }
    }

    /**
     * The topmost visible modal window, or `null`.
     *
     * @type {import('../widgets/abstract-window.js').AbstractWindow | null}
     */
    get modalWindow() {
        let result = null;

        for (const window of this._windows) {
            if (window.modal && window.visible && (!result || window.zIndex > result.zIndex)) {
                result = window;
            }
        }

        return result;
    }

    _onLoad() {
        if (this._loaded) {
            return;
        }

        this._loaded = true;
        this._applyTheme();

        this.emit('load', this);
    }

    _findWindow(node) {
        for (const window of this._windows) {
            if (window.visible && window.el.contains(node)) {
                return window;
            }
        }

        return null;
    }

    _onDocumentFocusIn(event) {
        const window = this._findWindow(event.target);
        if (window) {
            window._activateFromFocus();
        } else if (this._isInPopup(event.target)) {
            // Popups (menus, popovers) belong to the active window; it stays active.
        } else if (this._activeWindow && !this._activeWindow.el.contains(event.target)) {
            // The focus moved to page content outside the toolkit.
            this.activeWindow = null;
        }
    }

    /**
     * Whether a node is in a popup in the screen layer (a menu, popover or tooltip), rather than
     * in a window.
     *
     * @param {Node} node
     * @returns {boolean}
     */
    _isInPopup(node) {
        const element = node instanceof Element ? node : node?.parentElement;
        const layer = element?.closest('.wy-screen, [data-wy-popup]');

        return Boolean(layer && !this._findWindow(element));
    }

    _onDocumentPointerDown(event) {
        const window = this._findWindow(event.target);
        if (window && !window.active) {
            window.active = true;
        }
    }

    _syncEventListeners() {
        for (const [bubbleMask, captureMask, domName, type] of EVENT_BINDINGS) {
            for (const capture of [false, true]) {
                const mask = capture ? captureMask : bubbleMask;
                const wanted = Boolean(mask && this._events & mask);

                const key = `${domName}:${capture}`;
                const existing = this._domListeners.get(key);

                if (wanted && !existing) {
                    const listener = (nativeEvent) => {
                        const event = createToolkitEvent(nativeEvent, type, this);
                        const prefix = capture ? 'capture-' : '';

                        if (
                            this.emit(`${prefix}${type}-event`, this, event) ||
                            this.emit(`${prefix}event`, this, event)
                        ) {
                            nativeEvent.stopPropagation();
                            nativeEvent.preventDefault();
                        }
                    };

                    // Crossing events do not bubble, so listen for them on the document itself.
                    document.addEventListener(domName, listener, { capture, passive: false });
                    this._domListeners.set(key, listener);
                } else if (!wanted && existing) {
                    document.removeEventListener(domName, existing, { capture });
                    this._domListeners.delete(key);
                }
            }
        }
    }

    _onDocumentMouseDown(event) {
        // Like a desktop toolkit, pressing on a non-focusable part of a window neither moves the
        // keyboard focus nor starts a text selection.
        const target = event.target;
        if (
            !(target instanceof Element) ||
            !(this._findWindow(target) || this._isInPopup(target))
        ) {
            return;
        }

        if (target.closest(FOCUSABLE_SELECTOR) || target.closest('.wy-selectable')) {
            return;
        }

        event.preventDefault();
    }

    _applyTheme() {
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement;
        root.dataset.wyTheme = this._theme;

        if (this._accentColor) {
            root.style.setProperty('--wy-accent', this._accentColor);
        } else {
            root.style.removeProperty('--wy-accent');
        }
    }
}

defineProperties(ApplicationClass, {
    /**
     * The active window, which has the keyboard focus. Set `null` to deactivate it.
     */
    activeWindow: {
        value: null,
        set(window) {
            const old = this._activeWindow;
            if (old === window) {
                return false;
            }

            // A modal window keeps the focus from windows below it.
            const modal = this.modalWindow;
            if (window && modal && modal !== window && !window._isAbove(modal)) {
                modal._blink();

                return false;
            }

            this._activeWindow = window;

            if (window) {
                this._activationOrder = this._activationOrder.filter((x) => x !== window);
                this._activationOrder.push(window);
            }

            old?._setActive(false);
            window?._setActive(true);

            if (!window) {
                this._setFocusWidget(null);
            }
        },
    },

    /**
     * The main window, or `null`.
     */
    mainWindow: { value: null, readOnly: true },

    /**
     * The widget with the keyboard focus, or `null`. Setting it focuses the widget and activates
     * its window.
     */
    focusWidget: {
        value: null,
        set(widget) {
            if (widget) {
                widget.hasFocus = true;
            } else {
                this._focusWidget?.blur();
            }

            return false;
        },
    },

    /**
     * The mask of `Events` whose signals the application emits for events on the page.
     */
    events: {
        value: Events.NONE,
        changed() {
            this._syncEventListeners();
        },
    },

    /**
     * The color theme: `'light'` (the classic look), `'dark'` or `'auto'` (follows the system).
     */
    theme: {
        value: 'light',
        coerce(theme) {
            if (!THEMES.includes(theme)) {
                throw new RangeError(`Unknown theme '${theme}'; use one of ${THEMES.join(', ')}.`);
            }

            return theme;
        },
        changed() {
            this._applyTheme();
        },
    },

    /**
     * The accent (selection and highlight) color as a CSS color, or `null` for the theme's blue.
     */
    accentColor: {
        value: null,
        changed() {
            this._applyTheme();
        },
    },

    /**
     * Delay in milliseconds before a tooltip appears.
     */
    tooltipAppearDelay: {
        get() {
            return settings.tooltipAppearDelay;
        },
        set(delay) {
            settings.tooltipAppearDelay = delay;
        },
    },

    /**
     * Maximum time in milliseconds between presses of a double (or triple) press.
     */
    multiplePressInterval: {
        get() {
            return settings.multiplePressInterval;
        },
        set(interval) {
            settings.multiplePressInterval = interval;
        },
    },

    /**
     * Delay in milliseconds before a submenu opens on hover.
     */
    submenuDelay: {
        get() {
            return settings.submenuDelay;
        },
        set(delay) {
            settings.submenuDelay = delay;
        },
    },

    /**
     * Distance in pixels the pointer must move before a drag starts.
     */
    dragThreshold: {
        get() {
            return settings.dragThreshold;
        },
        set(distance) {
            settings.dragThreshold = distance;
        },
    },
});

/**
 * The application singleton.
 *
 * @type {ApplicationClass}
 */
export const Application = new ApplicationClass();
