/**
 * @module widgets/abstract-tool-item
 */
import { Container } from './container.js';
/**
 * The base class of the items of tool bars. A tool item can only be added to a tool bar, which
 * tells it about its style, icon size and orientation, and which shows the items that do not fit
 * in its overflow menu, through their menu proxies.
 */
export declare class AbstractToolItem extends Container {
    /**
     * The tool bar the item is in, or `null`.
     *
     * @type {import('./tool-bar.js').ToolBar | null}
     */
    get toolBar(): import('./tool-bar.js').ToolBar | null;
    /**
     * Creates the menu item that stands in for this item in the tool bar's overflow menu, or
     * returns `null` for none.
     *
     * @protected
     * @returns {import('./abstract-menu-item.js').AbstractMenuItem | null}
     */
    protected _createMenuProxy(): import('./abstract-menu-item.js').AbstractMenuItem | null;
    /**
     * Called when the tool bar's style, icon size or orientation changed, and when the item was
     * added to a tool bar.
     *
     * @protected
     */
    protected _onToolBarChange(): void;
    _setParent(parent: any): void;
}
