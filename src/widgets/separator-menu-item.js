/**
 * @module widgets/separator-menu-item
 */

import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { AbstractMenuItem } from './abstract-menu-item.js';

/**
 * A line between groups of items in a menu (or menu bar). It cannot be selected.
 */
export class SeparatorMenuItem extends AbstractMenuItem {
    _render() {
        return createElement(`
            <div class="wy-separator-menu-item" role="separator">
                <div class="wy-separator-menu-item-line"></div>
            </div>
        `);
    }

    _isSelectable() {
        return false;
    }
}

registerType('separator-menu-item', SeparatorMenuItem);
