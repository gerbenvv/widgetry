/**
 * @module widgets/abstract-menu-item
 */
import { Container } from './container.js';
/**
 * The base class of the items of menus and menu bars (menu shells). An item can only be added to a
 * menu shell. The shell selects (highlights) at most one of its items, following the pointer and
 * the keyboard.
 *
 * Signals: `selected-change`.
 */
export declare class AbstractMenuItem extends Container {
    _selected: any;
    _initialize(): void;
    /**
     * Whether the item can be selected (highlighted) by its shell. Separators cannot.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isSelectable(): boolean;
    /**
     * Whether the item and the items its menu hangs from are all sensitive, so that it can be
     * activated, e.g. by its accelerator.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isChainSensitive(): boolean;
    /**
     * Returns this item if its accelerator matches a key event, or an item of its submenu that
     * matches. Overridden by menu items.
     *
     * @protected
     * @param {KeyboardEvent} _event
     * @returns {AbstractMenuItem | null}
     */
    protected _findAccelerator(_event: KeyboardEvent): AbstractMenuItem | null;
    /**
     * Sets whether the item is selected. Called by the menu shell.
     *
     * @protected
     * @param {boolean} selected
     */
    protected _setSelected(selected: boolean): void;
    _setParent(parent: any): void;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
}

/** The declared properties of {@link AbstractMenuItem}. */
export interface AbstractMenuItem {
    /**
     * Whether the item is currently selected (highlighted) in its menu or menu bar.
     */
    readonly selected: any;
}
