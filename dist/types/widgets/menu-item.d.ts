/**
 * @module widgets/menu-item
 */
import { AbstractMenuItem } from './abstract-menu-item.js';
/**
 * A menu item with a label, an optional icon, an accelerator and a submenu.
 *
 * The label may contain a mnemonic: `'_File'` shows "File" with the "F" underlined, and pressing F
 * in the menu (or Alt+F for a menu bar item) activates the item. The accelerator (such as
 * `'Ctrl+S'`) is shown right-aligned and activates the item anywhere in the window of the menu
 * bar (or of the widget the menu is attached to), while no menu is open.
 *
 * Activating an item by the pointer or the keyboard closes all menus and then emits `activate`.
 * An item with a submenu opens it instead. Insensitive items cannot be activated.
 *
 * Signals: `activate`.
 */
export declare class MenuItem extends AbstractMenuItem {
    _mnemonic: string;
    _acceleratorValue: any;
    _ownImage: any;
    _submenuDisconnects: any[];
    _flashTimer: number;
    _iconEl: Element;
    _labelEl: Element;
    _acceleratorEl: Element;
    _image: any;
    _submenu: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The ARIA role of the item.
     *
     * @protected
     * @returns {string}
     */
    protected _getRole(): string;
    /**
     * Activates the item: emits `activate`. Unlike activating it in a menu, this does not close
     * menus. Does nothing if the item is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate(): boolean;
    /**
     * Destroys the item and its submenu.
     */
    destroy(): void;
    /**
     * Activates the item as the user did it in a menu: closes all menus first (so the focus is
     * back where it was, before a handler may move it), then activates it.
     *
     * @protected
     */
    protected _onUserActivate(): void;
    /**
     * Activates the item because its accelerator was pressed.
     *
     * @protected
     * @returns {boolean} Whether it was activated.
     */
    protected _activateByAccelerator(): boolean;
    _findAccelerator(event: any): any;
    _flashTopLevelItem(): void;
    _attachChildElement(widget: any): void;
    _setImage(image: any, own: any): boolean;
    _setSubmenu(submenu: any, destroyOld?: boolean): boolean;
    _onSubmenuVisibleChange(): void;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
}

/** The declared properties of {@link MenuItem}. */
export interface MenuItem {
    /**
     * The label. With `useUnderline`, an underscore marks the mnemonic, as in `'_File'`.
     */
    label: string;
    /**
     * Whether underscores in the label mark the mnemonic.
     */
    useUnderline: boolean;
    /**
     * The mnemonic character (lowercase), or `''` for none.
     */
    readonly mnemonic: any;
    /**
     * The name of the icon shown before the label, e.g. `'document-save'`, or `''` for none. The
     * icon is shown by an `Image` (see `image`).
     */
    icon: string;
    /**
     * The `Image` shown before the label, or `null`. Set it for a custom image; `icon` sets it
     * too.
     */
    image: any;
    /**
     * The accelerator, e.g. `'Ctrl+S'`, `'Ctrl+Shift+Z'` or `'F5'`, or `''` for none. It is shown
     * right-aligned (with the platform's notation) and activates the item in the window.
     */
    accelerator: string;
    /**
     * The submenu, a `Menu`, or `null`. The item owns it: replacing the submenu or destroying the
     * item destroys it. An item with a submenu shows an arrow and opens the submenu instead of
     * activating.
     */
    submenu: any;
    /**
     * Whether the item is placed at the far end of a menu bar, like a Help menu.
     */
    rightJustified: boolean;
}
