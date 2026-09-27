/**
 * @module widgets/tool-bar
 */
import { AbstractToolItem } from './abstract-tool-item.js';
import { Box } from './box.js';
import { Menu } from './menu.js';
/**
 * A bar of tool items (and other widgets, such as a search entry).
 *
 * The `style` sets what the items show: icons, text, both (the icon above the text) or both
 * horizontally (the text next to the icon, only for important items). Items that do not fit are
 * hidden, and shown in a menu behind a » button at the end (`showArrow`). A horizontal tool bar
 * then only needs room for that button and takes the width its container gives it, so let it fill
 * or expand. A vertical one overflows when its container limits its height. The tool bar is one
 * stop for Tab; the arrow keys (and Home and End) move between its items.
 */
export declare class ToolBar extends Box {
    /** @type {import('./widget.js').Widget[]} */
    _overflowItems: import('./widget.js').Widget[];
    /** @type {Menu | null} */
    _overflowMenu: Menu | null;
    /** @type {AbstractToolItem | null} */
    _focusItem: AbstractToolItem | null;
    _resizeObserver: ResizeObserver;
    _bodyEl: Element;
    _overflowEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The items that did not fit and are in the overflow menu.
     *
     * @type {import('./widget.js').Widget[]}
     */
    get overflowItems(): import('./widget.js').Widget[];
    destroy(): void;
    _updateLayout(): void;
    _layoutChild(child: any, horizontal: any): void;
    _applyStyle(): void;
    /**
     * Hides the items that do not fit and shows the overflow button for them.
     *
     * @protected
     */
    protected _updateOverflow(): void;
    _setOverflowVisible(visible: any): void;
    _toggleOverflowMenu(keyboard: any): void;
    /**
     * The focusable tool items that are shown, and the overflow button when shown, in order.
     *
     * @returns {HTMLElement[]}
     */
    _getNavigationElements(): HTMLElement[];
    _onKeyDown(event: any): void;
    _onFocusIn(event: any): void;
    _getFocusChain(): any[];
}

/** The declared properties of {@link ToolBar}. */
export interface ToolBar {
    vExpand: any;
    orientation: any;
    /**
     * Whether this is a tool bar.
     */
    readonly isToolBar: any;
    /**
     * What the items show: one of `ToolBarStyle`.
     */
    style: any;
    /**
     * The size of the items' icons in pixels.
     */
    iconSize: number;
    /**
     * Whether items that do not fit go to an overflow menu behind a » button. Without it they
     * are cut off.
     */
    showArrow: boolean;
}
