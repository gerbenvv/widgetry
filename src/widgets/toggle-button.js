/**
 * @module widgets/toggle-button
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Button } from './button.js';
import { ButtonGroup } from './button-group.js';

/**
 * A button that stays pressed when clicked (`active`), and is released by clicking again.
 *
 * Toggle buttons can be put in a `ButtonGroup`, of which at most one is active at a time. The
 * group is created lazily: a toggle button has none until `group` is set or `join()` is called.
 *
 * `inconsistent` shows a third, "mixed" state, e.g. for a setting that applies to only some of
 * the selected items. Clicking the button clears it.
 *
 * Signals: `activate` (`button`) when the user activates the button (a click, Space or Enter, or its
 * mnemonic) or `activate()` is called, after it toggled; `toggle` (`button`) and `active-change`
 * on every change of `active`, also from code; and `clicked` (`button`) after a click.
 */
export class ToggleButton extends Button {
    _initialize() {
        super._initialize();

        // Apply the defaults.
        this._updateState();
    }

    _render() {
        return createElement('<div class="wy-button wy-toggle-button" role="button"></div>');
    }

    /**
     * Activates the button, as if the user clicked it: clears `inconsistent`, toggles `active` and
     * emits `activate`.
     */
    activate() {
        this.inconsistent = false;
        this.toggle();

        this.emit('activate', this);
    }

    /**
     * Toggles `active`, without emitting `activate`.
     */
    toggle() {
        this.active = !this._active;
    }

    /**
     * Adds another button to the group of this button, creating the group if needed. The same as
     * `other.group = button.group` once the button has a group.
     *
     * @param {ToggleButton} button Any button with `active` and `group`, such as a radio menu
     *     item.
     */
    join(button) {
        if (!button || !('group' in button) || !('active' in button)) {
            throw new TypeError('Only toggling widgets with a group can be joined.');
        }

        if (!this._group) {
            this.group = new ButtonGroup();
        }

        this._group.addButton(button);
    }

    /**
     * Updates the state classes and the accessible state.
     *
     * @protected
     */
    _updateState() {
        this.el.classList.toggle('wy-active', this._active);
        this.el.classList.toggle('wy-inconsistent', this._inconsistent);

        const state = this._inconsistent ? 'mixed' : String(this._active);
        this._setAccessibleState(state);
    }

    /**
     * Sets the accessible toggle state.
     *
     * @protected
     * @param {'true' | 'false' | 'mixed'} state
     */
    _setAccessibleState(state) {
        this.el.setAttribute('aria-pressed', state);
    }

    /**
     * Called after `group` changed.
     *
     * @protected
     * @param {ButtonGroup | null} _old
     * @param {ButtonGroup | null} _group
     */
    _onGroupChange(_old, _group) {}
}

defineProperties(ToggleButton, {
    /**
     * Whether the button is pressed in (checked, for check boxes and radio buttons).
     */
    active: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateState();

            this.emit('toggle', this);
        },
    },

    /**
     * Whether the button shows the "mixed" state, between active and inactive. Clicking the
     * button clears it.
     */
    inconsistent: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateState();
        },
    },

    /**
     * The `ButtonGroup` the button is in, or `null`. At most one button of a group is active.
     */
    group: {
        value: null,
        set(group) {
            if (group !== null && !(group instanceof ButtonGroup)) {
                throw new TypeError('The group must be a ButtonGroup or null.');
            }

            const old = this._group;
            this._group = group;

            if (old && old.buttons.includes(this)) {
                old.removeButton(this);
            }

            if (group && !group.buttons.includes(this)) {
                group.addButton(this);
            }

            this._onGroupChange(old, group);
        },
    },
});

registerType('toggle-button', ToggleButton);
