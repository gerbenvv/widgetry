/**
 * @module widgets/radio-menu-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { ButtonGroup } from './button-group.js';
import { CheckMenuItem } from './check-menu-item.js';

/**
 * A menu item that is one of a group of choices, of which one is active. Put items in a group
 * by setting their `group` to the same `ButtonGroup`, or with `join()`. Activating an item makes it
 * the active one; activating the active item does not deactivate it.
 *
 * Signals: `activate`, `toggle`.
 */
export class RadioMenuItem extends CheckMenuItem {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-radio-menu-item');
    }

    _getRole() {
        return 'menuitemradio';
    }

    /**
     * Joins another item to this item's group. The group is created on first use.
     *
     * @param {RadioMenuItem | import('./widget.js').Widget} button
     */
    join(button) {
        if (!this._group) {
            this.group = new ButtonGroup();
        }

        this._group.addButton(button);
    }

    _toggleOnActivate() {
        this.inconsistent = false;
        this.active = true;
    }

    destroy() {
        this.group = null;

        super.destroy();
    }
}

defineProperties(RadioMenuItem, {
    drawAsRadio: { value: true },

    /**
     * The `ButtonGroup` of the item, or `null`. Items of the same group exclude each other.
     */
    group: {
        value: null,
        set(group) {
            const old = this._group;
            this._group = group;

            if (old && old.buttons.includes(this)) {
                old.removeButton(this);
            }

            if (group && !group.buttons.includes(this)) {
                group.addButton(this);
            }
        },
    },
});

registerType('radio-menu-item', RadioMenuItem);
