/**
 * @module widgets/separator-tool-item
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { AbstractToolItem } from './abstract-tool-item.js';
import { SeparatorMenuItem } from './separator-menu-item.js';

/**
 * A line between groups of tool items, or with `expand` a flexible space that pushes the
 * following items to the end of the tool bar (usually with `draw` off).
 */
export class SeparatorToolItem extends AbstractToolItem {
    _render() {
        return createElement(`
            <div class="wy-separator-tool-item" role="separator">
                <div class="wy-separator-tool-item-line"></div>
            </div>
        `);
    }

    _computeExpand(direction) {
        const horizontal = this.toolBar?.orientation !== Orientation.VERTICAL;

        return this._expand && (direction === 'h') === horizontal;
    }

    _onToolBarChange() {
        const horizontal = this.toolBar?.orientation !== Orientation.VERTICAL;

        this.el.setAttribute('aria-orientation', horizontal ? 'vertical' : 'horizontal');
        this._refreshExpand();
    }

    _createMenuProxy() {
        return this._draw ? new SeparatorMenuItem() : null;
    }
}

defineProperties(SeparatorToolItem, {
    /**
     * Whether the line is drawn; without it the separator is just space.
     */
    draw: {
        value: true,
        changed(draw) {
            this.el.classList.toggle('wy-invisible', !draw);
        },
    },

    /**
     * Whether the separator takes all extra space, pushing the items after it to the end.
     */
    expand: {
        value: false,
        changed(expand) {
            this.el.classList.toggle('wy-expand', expand);
            this._refreshExpand();
        },
    },
});

registerType('separator-tool-item', SeparatorToolItem);
