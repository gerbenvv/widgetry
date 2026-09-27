/**
 * @module widgets/menu-manager
 */
import { Instance } from '../core/instance.js';
/**
 * The attribute that marks popup elements in the screen layer (menus, tooltips). The keyboard
 * focus moving into them does not deactivate the window they belong to.
 *
 * @type {string}
 */
export declare const POPUP_ATTRIBUTE: string;
export type MenuShell = {
    el: HTMLElement;
    /**
     * Closes the shell (hides a menu, deselects a menu bar).
     */
    _deactivateShell: () => void;
    /**
     * Whether a press on the target belongs to
     * the shell (so it must not close the menus).
     */
    _containsTarget: (target: Node) => boolean;
    _onKeyDown?: (event: KeyboardEvent) => void;
};
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
export declare class MenuManager extends Instance {
    /** @type {MenuShell[]} */
    _shells: MenuShell[];
    /** @type {HTMLElement | null} */
    _previousFocus: HTMLElement | null;
    _pointer: {
        x: number;
        y: number;
    } | {
        x: any;
        y: any;
    };
    _listening: any;
    _disconnectScreen: () => void;
    _initialize(): void;
    /**
     * Whether any menu is open.
     *
     * @type {boolean}
     */
    get isOpen(): boolean;
    /**
     * The open menu shells, outermost first.
     *
     * @type {MenuShell[]}
     */
    get openShells(): MenuShell[];
    /**
     * The last known pointer position, in viewport coordinates.
     *
     * @type {{x: number, y: number}}
     */
    get pointer(): {
        x: number;
        y: number;
    };
    /**
     * Closes all open menus, innermost first. This is what activating a menu item does.
     */
    hideAllOpenMenus(): void;
    /**
     * Registers an opened shell. Called by menus and menu bars.
     *
     * @protected
     * @param {MenuShell} shell
     */
    protected _addShell(shell: MenuShell): void;
    /**
     * Unregisters a closed shell. Called by menus and menu bars. When the last one closes, the
     * focus goes back to where it was.
     *
     * @protected
     * @param {MenuShell} shell
     */
    protected _removeShell(shell: MenuShell): void;
    _restoreFocus(): void;
    _listen(listen: any): void;
    _containsTarget(target: any): boolean;
    _onPointerDown(event: any): void;
    _onWheel(event: any): void;
    _onKeyDown(event: any): void;
    _onBlur(): void;
    _onScreenSizeChange(): void;
}
/**
 * Returns the menu manager singleton.
 *
 * @type {() => MenuManager}
 */
export declare const getMenuManager: () => MenuManager;
