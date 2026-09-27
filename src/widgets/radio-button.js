/**
 * @module widgets/radio-button
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { CheckBox } from './check-box.js';
import { Widget } from './widget.js';

/**
 * The arrow keys and the direction they move in a group.
 *
 * @type {Readonly<Record<string, number>>}
 */
const ARROW_DIRECTIONS = Object.freeze({
    [Key.UP]: -1,
    [Key.LEFT]: -1,
    [Key.DOWN]: 1,
    [Key.RIGHT]: 1,
});

/**
 * A radio button: one choice of a group of radio buttons (see `group` and `join()`), of which
 * one is active. Clicking a radio button activates it; clicking it again does not deactivate it.
 *
 * Like on the desktop, a group is a single stop in the focus chain: Tab moves the focus to the
 * active radio button (or to every button while none is active), and the arrow keys move the
 * focus to the previous or next button of the group and activate it.
 */
export class RadioButton extends CheckBox {
    _initialize() {
        super._initialize();

        this._disconnectGroup = null;

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
    }

    _render() {
        const element = createElement(`
            <div class="wy-check-box wy-radio-button" role="radio">
                <span class="wy-check-indicator" aria-hidden="true"></span>
                <div class="wy-check-box-body"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-check-box-body');

        return element;
    }

    _onClicked() {
        this.inconsistent = false;

        // A click only turns a radio button on.
        if (!this._active) {
            this.active = true;
        }

        this.focus();
    }

    _onGroupChange(old, group) {
        this._disconnectGroup?.();
        this._disconnectGroup = null;

        if (group) {
            this._disconnectGroup = group.connect('active-change', () =>
                this._updateGroupFocus(group)
            );
            this._updateGroupFocus(group);
        }

        if (old) {
            this._updateGroupFocus(old);
        }

        this._updateTabIndex();
    }

    _updateGroupFocus(group) {
        for (const button of group.buttons) {
            if (button instanceof RadioButton) {
                button._updateTabIndex();
            }
        }
    }

    /**
     * Whether the button is the group's stop in the focus chain.
     *
     * @protected
     * @returns {boolean}
     */
    _isFocusStop() {
        const group = this._group;
        const active = group?.active;

        if (!active || active === this) {
            return true;
        }

        // Without a usable active button, every button of the group is a stop.
        return (
            !(active instanceof Widget) ||
            !active.isVisible ||
            !active.isSensitive ||
            !active._canFocus
        );
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        // Whether the active button is shown decides which buttons are stops.
        if (this._group) {
            this._updateGroupFocus(this._group);
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (this._group) {
            this._updateGroupFocus(this._group);
        }
    }

    _updateTabIndex() {
        this.focusElement.tabIndex = this.canFocus && this._isSensitiveCache ? 0 : -1;
    }

    _onKeyDown(event) {
        const direction = ARROW_DIRECTIONS[event.key];
        if (
            !direction ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.target !== this.focusElement ||
            !this._group
        ) {
            return;
        }

        const buttons = this._group.buttons.filter(
            (x) => x === this || (x instanceof RadioButton && x.isVisible && x.isSensitive)
        );
        if (buttons.length < 2) {
            return;
        }

        event.preventDefault();

        const index = buttons.indexOf(this);
        const next = buttons[(index + direction + buttons.length) % buttons.length];

        next.inconsistent = false;
        next.active = true;
        next.focus();
    }

    destroy() {
        this._disconnectGroup?.();
        this._disconnectGroup = null;

        super.destroy();
    }
}

defineProperties(RadioButton, {
    /**
     * Whether the button can take the focus. Within a group, only the active button can (see
     * the class description).
     */
    canFocus: {
        get() {
            return this._canFocus && this._isFocusStop();
        },
    },
});

registerType('radio-button', RadioButton);
