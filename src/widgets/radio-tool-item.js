/**
 * @module widgets/radio-tool-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { ButtonGroup } from './button-group.js';
import { CheckToolItem } from './check-tool-item.js';

/**
 * A tool item that is one of a group of choices, of which one is active (drawn pressed), like the
 * pages of a view. Put items in a group by setting their `group` to the same `ButtonGroup`, or
 * with `join()`. Activating the active item does not deactivate it.
 *
 * Signals: `activate` (`item`) when the user activates the item or `activate()` is called, also
 * when it already was active; `toggle` (`item`) and `active-change` on every change of `active`,
 * also from code.
 */
export class RadioToolItem extends CheckToolItem {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-radio-tool-item');
    }

    /**
     * Joins another item to this item's group. The group is created on first use.
     *
     * @param {RadioToolItem | import('./widget.js').Widget} button
     */
    join(button) {
        if (!this._group) {
            this.group = new ButtonGroup();
        }

        this._group.addButton(button);
    }

    destroy() {
        this.group = null;

        super.destroy();
    }

    _getRole() {
        return 'radio';
    }

    _toggleOnActivate() {
        this.active = true;
    }
}

defineProperties(RadioToolItem, {
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

registerType('radio-tool-item', RadioToolItem);
