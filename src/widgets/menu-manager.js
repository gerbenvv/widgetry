/**
 * @module widgets/menu-manager
 */

import { Instance, lazySingleton } from '../core/instance.js';
import { getScreen } from '../core/screen.js';
import { Key } from '../events/constants.js';

/**
 * The attribute that marks popup elements in the screen layer (menus, tooltips). The keyboard
 * focus moving into them does not deactivate the window they belong to.
 *
 * @type {string}
 */
export const POPUP_ATTRIBUTE = 'data-wy-popup';

/**
 * @typedef {object} MenuShell
 * @property {HTMLElement} el
 * @property {() => void} _deactivateShell Closes the shell (hides a menu, deselects a menu bar).
 * @property {(target: Node) => boolean} _containsTarget Whether a press on the target belongs to
 *     the shell (so it must not close the menus).
 * @property {(event: KeyboardEvent) => void} [_onKeyDown]
 */

/**
 * Tracks the open menu shells: the active menu bar or menu button menu, its open menu and that
 * menu's open submenus, outermost first.
 *
 * While menus are open, a press or a scroll outside them, the page losing the focus or the screen
 * changing size closes all of them. The keyboard is grabbed: keys that do not reach a menu (for
 * example after the focus got lost) go to the innermost one. When the last menu closes, the
 * widget that had the focus before the first one opened gets it back.
 *
 * Get the singleton with {@link getMenuManager}.
 *
 * Signals: `open-change` (when the first shell opens or the last one closes).
 */
export class MenuManager extends Instance {
    _initialize() {
        super._initialize();

        /** @type {MenuShell[]} */
        this._shells = [];

        /** @type {HTMLElement | null} */
        this._previousFocus = null;

        this._pointer = { x: 0, y: 0 };
        this._listening = false;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onBlur = this._onBlur.bind(this);
        this._onScreenSizeChange = this._onScreenSizeChange.bind(this);

        if (typeof window === 'undefined') {
            return;
        }

        // Keep the focus moving into a popup from reaching the application, which would
        // otherwise deactivate the window: popups are not windows. Listening on the window in
        // the capture phase runs before the application's document listener.
        window.addEventListener(
            'focusin',
            (event) => {
                if (
                    event.target instanceof Element &&
                    event.target.closest(`[${POPUP_ATTRIBUTE}]`)
                ) {
                    event.stopPropagation();
                }
            },
            true
        );

        // Remember where the pointer is, for menus that pop up at the pointer and for knowing
        // whether it moved since a menu popped up.
        const track = (event) => {
            this._pointer = { x: event.clientX, y: event.clientY };
        };

        document.addEventListener('pointermove', track, { capture: true, passive: true });
        document.addEventListener('pointerdown', track, { capture: true, passive: true });
    }

    /**
     * Whether any menu is open.
     *
     * @type {boolean}
     */
    get isOpen() {
        return this._shells.length > 0;
    }

    /**
     * The open menu shells, outermost first.
     *
     * @type {MenuShell[]}
     */
    get openShells() {
        return [...this._shells];
    }

    /**
     * The last known pointer position, in viewport coordinates.
     *
     * @type {{x: number, y: number}}
     */
    get pointer() {
        return { ...this._pointer };
    }

    /**
     * Closes all open menus, innermost first. This is what activating a menu item does.
     */
    hideAllOpenMenus() {
        for (const shell of [...this._shells].reverse()) {
            if (this._shells.includes(shell)) {
                shell._deactivateShell();
            }
        }
    }

    /**
     * Registers an opened shell. Called by menus and menu bars.
     *
     * @protected
     * @param {MenuShell} shell
     */
    _addShell(shell) {
        if (this._shells.includes(shell)) {
            return;
        }

        const first = !this._shells.length;
        if (first) {
            const active = document.activeElement;
            this._previousFocus =
                active && active !== document.body && !active.closest(`[${POPUP_ATTRIBUTE}]`)
                    ? /** @type {HTMLElement} */ (active)
                    : null;

            this._listen(true);
        }

        this._shells.push(shell);

        if (first) {
            this.emit('open-change', this);
        }
    }

    /**
     * Unregisters a closed shell. Called by menus and menu bars. When the last one closes, the
     * focus goes back to where it was.
     *
     * @protected
     * @param {MenuShell} shell
     */
    _removeShell(shell) {
        const index = this._shells.indexOf(shell);
        if (index < 0) {
            return;
        }

        this._shells.splice(index, 1);

        if (!this._shells.length) {
            this._listen(false);
            this._restoreFocus();

            this.emit('open-change', this);
        }
    }

    _restoreFocus() {
        const element = this._previousFocus;
        this._previousFocus = null;

        // Only give the focus back if it is still in a menu or got lost; something else (like a
        // dialog opened by a menu item) may have taken it on purpose.
        const active = document.activeElement;
        const lost =
            !active ||
            active === document.body ||
            !active.isConnected ||
            Boolean(active.closest(`[${POPUP_ATTRIBUTE}]`));

        if (lost && element?.isConnected) {
            element.focus({ preventScroll: true });
        }
    }

    _listen(listen) {
        if (listen === this._listening) {
            return;
        }

        this._listening = listen;

        const method = listen ? 'addEventListener' : 'removeEventListener';
        document[method]('pointerdown', this._onPointerDown, true);
        document[method]('wheel', this._onWheel, { capture: true, passive: true });
        document[method]('keydown', this._onKeyDown, true);
        window[method]('blur', this._onBlur);

        if (listen) {
            this._disconnectScreen = getScreen().connect('size-change', this._onScreenSizeChange);
        } else {
            this._disconnectScreen?.();
            this._disconnectScreen = null;
        }
    }

    _containsTarget(target) {
        return this._shells.some((shell) => shell._containsTarget(target));
    }

    _onPointerDown(event) {
        if (!this._containsTarget(event.target)) {
            this.hideAllOpenMenus();
        }
    }

    _onWheel(event) {
        if (!this._containsTarget(event.target)) {
            this.hideAllOpenMenus();
        }
    }

    _onKeyDown(event) {
        // The keyboard grab: keys that are not already going to a menu go to the innermost one.
        const target = /** @type {Element} */ (event.target);
        if (target instanceof Element && target.closest(`[${POPUP_ATTRIBUTE}]`)) {
            return;
        }

        const innermost = this._shells[this._shells.length - 1];
        if (innermost?._onKeyDown && !innermost.el.contains(target)) {
            innermost._onKeyDown(event);
        } else if (!innermost?._onKeyDown && event.key === Key.ESCAPE) {
            this.hideAllOpenMenus();
            event.preventDefault();
        }
    }

    _onBlur() {
        this.hideAllOpenMenus();
    }

    _onScreenSizeChange() {
        this.hideAllOpenMenus();
    }
}

/**
 * Returns the menu manager singleton.
 *
 * @type {() => MenuManager}
 */
export const getMenuManager = lazySingleton(() => new MenuManager());
