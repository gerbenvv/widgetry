/**
 * @module widgets/menu-button
 */
import { Bin } from './bin.js';
/**
 * A button that pops up a menu, with an arrow showing where the menu goes.
 *
 * Pressing the button opens the menu (and pressing it again closes it); dragging onto an item
 * and releasing activates that item. Enter and Space open the menu with its first item selected.
 * The button shows its `label` (with a mnemonic underscore) and `icon`, or a custom child.
 *
 * Signals: `toggle` (when `active` changes).
 */
export declare class MenuButton extends Bin {
    _menuDisconnects: any[];
    _keyboardOpen: boolean;
    _behavior: import("./button-behavior.js").ButtonBehavior;
    active: boolean;
    _iconEl: Element;
    _labelEl: Element;
    _bodyEl: Element;
    _menu: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Opens the menu.
     */
    popup(): void;
    /**
     * Closes the menu.
     */
    popdown(): void;
    /**
     * Destroys the button and its menu.
     */
    destroy(): void;
    _onPointerDown(event: any): void;
    _setMenu(menu: any, destroyOld?: boolean): boolean;
    _updateArrow(): void;
    _updateContent(): void;
    _onChildrenChange(): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _onIsVisibleChange(isVisible: any): void;
}

/** The declared properties of {@link MenuButton}. */
export interface MenuButton {
    canFocus: any;
    /**
     * The label. An underscore marks the mnemonic, as in `'_Options'`.
     */
    label: string;
    /**
     * Whether underscores in the label mark the mnemonic.
     */
    useUnderline: boolean;
    /**
     * The name of an icon shown before the label, or `''` for none.
     */
    icon: string;
    /**
     * The menu that the button pops up, or `null`. The button owns it: replacing the menu or
     * destroying the button destroys it.
     */
    menu: any;
    /**
     * The menu, under the original toolkit's name. The same as `menu`.
     */
    submenu: any;
    /**
     * Where the menu pops up: one of `Position` (`'bottom'` by default). `'down'` and `'up'` are
     * accepted too.
     */
    direction: any;
}
