/**
 * @module widgets/separator-menu-item
 */
import { AbstractMenuItem } from './abstract-menu-item.js';
/**
 * A line between groups of items in a menu (or menu bar). It cannot be selected.
 */
export declare class SeparatorMenuItem extends AbstractMenuItem {
    _render(): HTMLElement;
    _isSelectable(): boolean;
}
