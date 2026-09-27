/**
 * @module widgets/button-group
 */

import { defineProperties, Instance } from '../core/instance.js';
import { registerType } from '../core/registry.js';

/**
 * A group of toggling widgets (radio buttons, toggle buttons, radio menu items, radio tool items)
 * of which at most one is active at a time.
 *
 * A member must have an `active` property and a `group` property, and emit `active-change`. Adding
 * a widget to a group is the same as setting its `group`.
 *
 * Signals: `add` and `remove` (`group, button`), `active-change`.
 */
export class ButtonGroup extends Instance {
    _initialize() {
        super._initialize();

        this._buttons = [];
    }

    /**
     * Adds a button. If it is active, it becomes the active button of the group.
     *
     * @param {import('./widget.js').Widget & {active: boolean, group: ButtonGroup | null}} button
     */
    addButton(button) {
        if (this._buttons.includes(button)) {
            return;
        }

        if (button.group && button.group !== this) {
            button.group.removeButton(button);
        }

        this._buttons.push(button);
        button.connect('active-change', this._onButtonActiveChange, this);
        button.connect('destroy', this._onButtonDestroy, this);

        if (button.group !== this) {
            button.group = this;
        }

        if (button.active) {
            this.active = button;
        }

        this.emit('add', this, button);
    }

    /**
     * Removes a button.
     *
     * @param {import('./widget.js').Widget} button
     * @throws {Error} If the button is not in the group.
     */
    removeButton(button) {
        const index = this._buttons.indexOf(button);
        if (index < 0) {
            throw new Error('The button is not in this group.');
        }

        this._buttons.splice(index, 1);
        button.disconnect('active-change', this._onButtonActiveChange, this);
        button.disconnect('destroy', this._onButtonDestroy, this);

        if (button.group === this) {
            button.group = null;
        }

        if (this._active === button) {
            this._active = null;
            this.emit('active-change', this);
        }

        this.emit('remove', this, button);
    }

    destroy() {
        for (const button of [...this._buttons]) {
            this.removeButton(button);
        }

        super.destroy();
    }

    _onButtonActiveChange(button) {
        if (button.active) {
            this.active = button;
        } else if (this._active === button) {
            this._active = null;
            this.emit('active-change', this);
        }
    }

    _onButtonDestroy(button) {
        if (this._buttons.includes(button)) {
            this.removeButton(button);
        }
    }
}

defineProperties(ButtonGroup, {
    /**
     * The active button, or `null`. Setting it activates that button and deactivates the others.
     */
    active: {
        value: null,
        set(button) {
            if (button && !this._buttons.includes(button)) {
                throw new Error('The button is not in this group.');
            }

            if (button === this._active) {
                return false;
            }

            const old = this._active;
            this._active = button;

            if (old && old.active) {
                old.active = false;
            }

            if (button && !button.active) {
                button.active = true;
            }
        },
    },

    /**
     * The buttons in the group. Do not modify the array.
     */
    buttons: {
        readOnly: true,
        get() {
            return this._buttons;
        },
    },

    /**
     * The number of buttons.
     */
    buttonsCount: {
        readOnly: true,
        get() {
            return this._buttons.length;
        },
    },
});

ButtonGroup.builderProperties = {
    buttons(builder, group, buttons) {
        if (!Array.isArray(buttons)) {
            throw new Error('Button group buttons must be an array.');
        }

        for (const button of builder.build(buttons)) {
            group.addButton(button);
        }
    },
};

registerType('button-group', ButtonGroup);
