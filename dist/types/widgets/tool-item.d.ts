/**
 * @module widgets/tool-item
 */
import { AbstractToolItem } from './abstract-tool-item.js';
import { MenuItem } from './menu-item.js';
/**
 * A tool bar button with an icon and a label, of which the tool bar's `style` decides what is
 * shown. It is flat, shows a raised border when hovered and looks pressed while pressed.
 *
 * With a `submenu`, an arrow next to the button opens the menu (as does Alt+Down, or Down in a
 * horizontal tool bar), while the button itself still activates.
 *
 * Signals: `activate`.
 */
export declare class ToolItem extends AbstractToolItem {
    _ownImage: any;
    _submenuDisconnects: any[];
    _behavior: import("./button-behavior.js").ButtonBehavior;
    _iconEl: Element;
    _labelEl: Element;
    _arrowEl: Element;
    _image: any;
    _submenu: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Activates the item: emits `activate`. Does nothing if it is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate(): boolean;
    /**
     * Opens the submenu, if any.
     *
     * @param {boolean} [keyboard] Whether to select the first item, as when using the keyboard.
     */
    popupSubmenu(keyboard?: boolean): void;
    /**
     * Destroys the item and its submenu.
     */
    destroy(): void;
    /**
     * The ARIA role of the item.
     *
     * @protected
     * @returns {string}
     */
    protected _getRole(): string;
    /**
     * Activates the item as the user did it (by pressing it, or with Enter or Space).
     *
     * @protected
     */
    protected _onUserActivate(): void;
    /**
     * The text for the item in menus: the label, or else the tooltip.
     *
     * @protected
     * @returns {string}
     */
    protected _getMenuLabel(): string;
    _createMenuProxy(): MenuItem;
    _onToolBarChange(): void;
    _attachChildElement(widget: any): void;
    _setImage(image: any, own: any): boolean;
    _setSubmenu(submenu: any, destroyOld?: boolean): boolean;
    _onArrowPointerDown(event: any): void;
    _onKeyDown(event: any): void;
    _updateLabel(): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _onIsVisibleChange(isVisible: any): void;
}

/** The declared properties of {@link ToolItem}. */
export interface ToolItem {
    canFocus: any;
    /**
     * The label. With `useUnderline`, an underscore marks a mnemonic (used in the overflow menu).
     */
    label: string;
    /**
     * Whether underscores in the label mark a mnemonic.
     */
    useUnderline: boolean;
    /**
     * The name of the icon, e.g. `'document-save'`, or `''` for none. The icon is shown by an
     * `Image` (see `image`), sized by the tool bar's `iconSize`.
     */
    icon: string;
    /**
     * The `Image` shown as the icon, or `null`. Set it for a custom image; `icon` sets it too.
     */
    image: any;
    /**
     * Whether the item is important: in the `BOTH_HORIZONTAL` tool bar style only important
     * items show their label next to the icon.
     */
    isImportant: boolean;
    /**
     * The submenu opened by the item's arrow, a `Menu`, or `null`. The item owns it: replacing
     * the submenu or destroying the item destroys it.
     */
    submenu: any;
}
