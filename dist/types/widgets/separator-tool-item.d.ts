/**
 * @module widgets/separator-tool-item
 */
import { AbstractToolItem } from './abstract-tool-item.js';
import { SeparatorMenuItem } from './separator-menu-item.js';
/**
 * A line between groups of tool items, or with `expand` a flexible space that pushes the
 * following items to the end of the tool bar (usually with `draw` off).
 */
export declare class SeparatorToolItem extends AbstractToolItem {
    _render(): HTMLElement;
    _computeExpand(direction: any): boolean;
    _onToolBarChange(): void;
    _createMenuProxy(): SeparatorMenuItem;
}

/** The declared properties of {@link SeparatorToolItem}. */
export interface SeparatorToolItem {
    /**
     * Whether the line is drawn; without it the separator is just space.
     */
    draw: boolean;
    /**
     * Whether the separator takes all extra space, pushing the items after it to the end.
     */
    expand: boolean;
}
