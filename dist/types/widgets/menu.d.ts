/**
 * @module widgets/menu
 */
import { Box } from './box.js';
import { Widget } from './widget.js';
export type PopupOptions = {
    /**
     * Where to place the menu relative to the
     * anchor. Defaults to `'right'` for submenus and `'bottom'` otherwise.
     */
    side?: 'bottom' | 'top' | 'right' | 'left';
    /**
     * The alignment along that side.
     */
    align?: 'start' | 'end' | 'center';
    /**
     * The distance from the anchor in pixels.
     */
    offset?: number;
    /**
     * An element whose presses do not close the menu, because
     * its widget toggles the menu itself (like a menu button). Defaults to the anchor element.
     */
    owner?: HTMLElement | null;
    /**
     * Whether the menu takes the keyboard focus. Defaults to true.
     */
    focus?: boolean;
    /**
     * Whether to select the first item, as when opened with the
     * keyboard.
     */
    selectFirst?: boolean;
};
/**
 * @typedef {object} PopupOptions
 * @property {'bottom' | 'top' | 'right' | 'left'} [side] Where to place the menu relative to the
 *     anchor. Defaults to `'right'` for submenus and `'bottom'` otherwise.
 * @property {'start' | 'end' | 'center'} [align] The alignment along that side.
 * @property {number} [offset] The distance from the anchor in pixels.
 * @property {HTMLElement | null} [owner] An element whose presses do not close the menu, because
 *     its widget toggles the menu itself (like a menu button). Defaults to the anchor element.
 * @property {boolean} [focus] Whether the menu takes the keyboard focus. Defaults to true.
 * @property {boolean} [selectFirst] Whether to select the first item, as when opened with the
 *     keyboard.
 */
/**
 * A menu: a popup with a column of menu items, floating in the screen layer.
 *
 * Show it with `popup()`: below a menu bar item or a button, to the right of the item it is a
 * submenu of, or at a point (`popupAtPointer()` for context menus). While it is open it has the
 * keyboard focus (the window it belongs to stays active) and it closes when the user presses
 * outside it, scrolls outside it, activates an item or presses Escape (which closes one level).
 * The widget that had the focus gets it back.
 *
 * Keyboard: Up and Down move the selection (wrapping around, skipping separators and insensitive
 * items), Home and End go to the first and last item, Right opens a submenu, Left closes it (or
 * moves to the neighboring menu of a menu bar), Enter and Space activate, and a letter activates
 * the item with that mnemonic (or selects the next item starting with it). Hovering an item with
 * a submenu opens the submenu after `settings.submenuDelay`; moving the pointer diagonally
 * towards an open submenu keeps it open. A menu taller than the screen gets scroll arrows.
 *
 * Signals: `popup`, `selected-change`, and `visible-change` when shown or hidden.
 */
export declare class Menu extends Box {
    /** @type {Widget | null} */
    _attachWidget: Widget | null;
    /** @type {HTMLElement | null} */
    _ownerElement: HTMLElement | null;
    _placement: {
        anchor: Element | {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        side: "bottom" | "left" | "right" | "top";
        align: "center" | "end" | "start";
        offset: number;
        alignFirstItem: boolean;
    };
    _submenuTimer: number;
    _deferTimer: number;
    _deferredItem: any;
    _pressedItem: Widget;
    _popupPointer: {
        x: number;
        y: number;
    };
    _pointerMoved: boolean;
    _lastPointer: {
        x: any;
        y: any;
    };
    _scrollFrame: number;
    _stopAccelerators: () => void;
    _disconnectAttachDestroy: () => void;
    _bodyEl: Element;
    _scrollUpEl: Element;
    _scrollDownEl: Element;
    _selected: any;
    _scrollable: any;
    _scrollDirection: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Shows the menu next to an anchor: a widget, an element, a rectangle or a point (all in
     * viewport coordinates), or at the pointer when `null`. The menu is flipped and shifted to
     * stay on screen.
     *
     * @param {Widget | Element | {x: number, y: number, width?: number, height?: number} | null}
     *     [anchor]
     * @param {PopupOptions} [options]
     * @returns {this}
     */
    popup(anchor?: Widget | Element | {
        x: number;
        y: number;
        width?: number;
        height?: number;
    } | null, options?: PopupOptions): this;
    /**
     * Shows the menu at the pointer, as a context menu. Pass the event that asked for the menu
     * (a DOM or toolkit event); without one, the last known pointer position is used.
     *
     * @param {Event | {nativeEvent?: Event | null} | null} [event]
     * @param {PopupOptions} [options]
     * @returns {this}
     */
    popupAtPointer(event?: Event | {
        nativeEvent?: Event | null;
    } | null, options?: PopupOptions): this;
    /**
     * Shows the menu below a widget, or to its right. The original toolkit's name for `popup()`.
     *
     * @param {Widget} widget
     * @param {boolean} [showOnSide] Whether to show the menu to the right of the widget.
     * @returns {this}
     */
    appearAtWidget(widget: Widget, showOnSide?: boolean): this;
    /**
     * Shows the menu at a position in viewport coordinates.
     *
     * @param {{x: number, y: number}} position
     * @returns {this}
     */
    appearAtPosition(position: {
        x: number;
        y: number;
    }): this;
    /**
     * Hides the menu. The same as `hide()`.
     */
    disappear(): void;
    /**
     * Attaches the menu to a widget: the menu belongs to the widget's window (the accelerators of
     * its items work there) and is destroyed with the widget.
     *
     * @param {Widget} widget
     */
    attachToWidget(widget: Widget): void;
    /**
     * Detaches the menu from the widget it is attached to.
     */
    detach(): void;
    /**
     * Selects the first selectable item.
     */
    selectFirst(): void;
    /**
     * Selects the last selectable item.
     */
    selectLast(): void;
    insertChild(widget: any, index: any): Widget;
    removeChild(widget: any): number;
    destroy(): void;
    /**
     * Sets the widget the menu is attached to (for a submenu, its menu item). Menus attached to
     * other widgets than menu items make their accelerators work in that widget's window.
     *
     * @protected
     * @param {Widget | null} widget
     */
    protected _setAttachWidget(widget: Widget | null): void;
    _findAccelerator(event: any): any;
    _deactivateShell(): void;
    _containsTarget(target: any): boolean;
    _onVisibleChange(visible: any): void;
    _place(): void;
    _getFirstItemOffset(): number;
    _getSelectableItems(): Widget[];
    _itemFromTarget(target: any): Widget;
    _selectItem(item: any, keyboard?: boolean): void;
    _onItemGone(item: any): void;
    _openSubmenu(item: any, keyboard?: boolean): void;
    _moveSelection(delta: any): void;
    _activateSelected(): void;
    /**
     * Closes this menu level, as Escape does: a submenu returns the focus to its parent menu,
     * and a top-level menu closes all menus.
     *
     * @protected
     */
    protected _closeLevel(): void;
    _getRootMenu(): this;
    _getMenuBar(): any;
    _onKeyDown(event: any): void;
    _onCharacterKey(event: any): boolean;
    _onPointerMove(event: any): void;
    _hoverItem(item: any): void;
    _isMovingTowardsSubmenu(previous: any, point: any): boolean;
    _deferSelection(item: any): void;
    _cancelDeferredSelection(): void;
    _cancelTimers(): void;
    _onPointerLeave(): void;
    _onPointerDown(event: any): void;
    _onPointerUp(event: any): void;
    _updateScrollArrows(): void;
    _startScrolling(direction: any): void;
    _stopScrolling(): void;
}
/**
 * Gives a widget a context menu, which pops up at the pointer on a right click, and below the
 * focused element with the Menu key or Shift+F10 (with its first item selected).
 *
 * Pass a menu, which is attached to the widget (and destroyed with it), or a factory
 * `(widget, event) => Menu | null` that creates a menu each time (return `null` for no menu);
 * such menus are destroyed after closing.
 *
 * @param {Widget} widget
 * @param {Menu | ((widget: Widget, event: Event) => Menu | null)} menuOrFactory
 * @returns {() => void} A function that removes the context menu again.
 */
export declare function attachContextMenu(widget: Widget, menuOrFactory: Menu | ((widget: Widget, event: Event) => Menu | null)): () => void;

/** The declared properties of {@link Menu}. */
export interface Menu {
    visible: boolean;
    /**
     * Whether this is a menu shell (a container of menu items).
     */
    readonly isMenuShell: boolean;
    /**
     * Whether this is a menu.
     */
    readonly isMenu: boolean;
    /**
     * The selected (highlighted) item, or `null`.
     */
    selected: any;
    /**
     * The widget the menu is attached to (for a submenu, its menu item), or `null`.
     */
    readonly attachWidget: any;
    /**
     * The menu this menu is a submenu of, or `null`.
     */
    readonly parentMenu: any;
    /**
     * The position of the menu's top-left corner in viewport coordinates, as `{x, y}`. Setting it
     * moves the menu there, keeping it on screen.
     */
    position: any;
    /**
     * The x position of the menu. Does not signal.
     */
    x: any;
    /**
     * The y position of the menu. Does not signal.
     */
    y: any;
}
