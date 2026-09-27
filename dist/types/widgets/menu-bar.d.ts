/**
 * @module widgets/menu-bar
 */
import { AbstractMenuItem } from './abstract-menu-item.js';
import { Box } from './box.js';
import { Widget } from './widget.js';
/**
 * A horizontal bar of menu items, usually at the top of a window, whose submenus drop down.
 *
 * Pressing an item opens its menu; while a menu is open, moving the pointer to another item opens
 * that item's menu instead, and pressing the open item again closes it. F10 opens the first menu
 * and Alt with a mnemonic (Alt+F for `'_File'`) opens the matching one, with the keyboard; Left
 * and Right then move between the menus. The accelerators of all items work anywhere in the
 * bar's window.
 *
 * Signals: `selected-change`.
 */
export declare class MenuBar extends Box {
    _pressedItem: Widget;
    _submenuDisconnect: any;
    _stopAccelerators: () => void;
    _selected: any;
    _initialize(): void;
    _render(): HTMLElement;
    insertChild(widget: any, index: any): Widget;
    removeChild(widget: any): number;
    destroy(): void;
    _getSelectableItems(): Widget[];
    _itemFromTarget(target: any): Widget;
    /**
     * Selects an item, opening its menu, or deselects (with `null`), closing it.
     *
     * @protected
     * @param {AbstractMenuItem | null} item
     * @param {boolean} [keyboard] Whether the keyboard opened it, which selects the menu's first
     *     item.
     */
    protected _select(item: AbstractMenuItem | null, keyboard?: boolean): void;
    _popupSubmenu(item: any, keyboard: any): void;
    /**
     * Moves the selection to the next (1) or previous (-1) item, wrapping around, and opens its
     * menu.
     *
     * @protected
     * @param {number} delta
     * @param {boolean} [keyboard]
     */
    protected _moveSelectionBy(delta: number, keyboard?: boolean): void;
    _deactivateShell(): void;
    _containsTarget(target: any): boolean;
    _onItemGone(item: any): void;
    _findAccelerator(event: any): any;
    /**
     * Handles the menu bar keys of the window: F10 opens the first menu and Alt with a mnemonic
     * opens the matching menu.
     *
     * @protected
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    protected _handleWindowKey(event: KeyboardEvent): boolean;
    _onPointerDown(event: any): void;
    _onPointerMove(event: any): void;
    _onPointerUp(event: any): void;
    _onKeyDown(event: any): void;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
}

/** The declared properties of {@link MenuBar}. */
export interface MenuBar {
    /**
     * Whether this is a menu shell (a container of menu items).
     */
    readonly isMenuShell: boolean;
    /**
     * Whether this is a menu bar.
     */
    readonly isMenuBar: boolean;
    /**
     * The selected item, whose menu is open, or `null`. Setting it opens that item's menu.
     */
    selected: any;
}
