/**
 * @module widgets/abstract-tool-item
 */

import { Container } from './container.js';

/**
 * The base class of the items of tool bars. A tool item can only be added to a tool bar, which
 * tells it about its style, icon size and orientation, and which shows the items that do not fit
 * in its overflow menu, through their menu proxies.
 */
export class AbstractToolItem extends Container {
    /**
     * The tool bar the item is in, or `null`.
     *
     * @type {import('./tool-bar.js').ToolBar | null}
     */
    get toolBar() {
        return this._parent?.isToolBar ? this._parent : null;
    }

    /**
     * Creates the menu item that stands in for this item in the tool bar's overflow menu, or
     * returns `null` for none.
     *
     * @protected
     * @returns {import('./abstract-menu-item.js').AbstractMenuItem | null}
     */
    _createMenuProxy() {
        return null;
    }

    /**
     * Called before a menu proxy of this item is destroyed, to take back what it lent to it.
     *
     * @protected
     * @param {import('./abstract-menu-item.js').AbstractMenuItem} _proxy
     */
    _releaseMenuProxy(_proxy) {}

    /**
     * Called when the tool bar's style, icon size or orientation changed, and when the item was
     * added to a tool bar.
     *
     * @protected
     */
    _onToolBarChange() {}

    _setParent(parent) {
        if (parent && !parent.isToolBar) {
            throw new Error('A tool item can only be added to a tool bar.');
        }

        super._setParent(parent);

        if (parent) {
            this._onToolBarChange();
        }
    }
}
