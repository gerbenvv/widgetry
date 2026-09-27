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
 *
 * Signals: `activate` (`button`) when the user activates the button or `activate()` is called,
 * also when it already was active; `toggle` (`button`) and `active-change` on every change of
 * `active`, also from code (so both for the button that became active and for the one that became
 * inactive); and `clicked` (`button`) after a click.
 */
export class RadioButton extends CheckBox {
    _initialize() {
        super._initialize();

        this._disconnectGroup = null;
        this._mnemonicStop = false;

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this.el.addEventListener('focusout', () => this._setMnemonicStop(false));
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

    _setAccessibleState(_state) {
        // A radio button has no mixed state for assistive technology.
        this.el.setAttribute('aria-checked', String(this._active));
    }

    /**
     * Activates the button, as if the user clicked it: clears `inconsistent`, makes the button
     * active (a radio button never deactivates itself) and emits `activate`.
     */
    activate() {
        this.inconsistent = false;
        this.active = true;

        this.emit('activate', this);
    }

    _onClicked() {
        this.activate();

        if (!this.destroyed) {
            this.focus();
        }
    }

    /**
     * Activates the button for its mnemonic. When other widgets share the mnemonic, the button
     * only takes the focus, also when it is not the group's stop in the focus chain; it stays a
     * stop until the focus leaves it.
     *
     * @protected
     * @param {boolean} groupCycling
     */
    _mnemonicActivate(groupCycling) {
        if (groupCycling && !this._isFocusStop()) {
            this._setMnemonicStop(true);
        }

        super._mnemonicActivate(groupCycling);

        if (!this.isFocus) {
            this._setMnemonicStop(false);
        }
    }

    _setMnemonicStop(stop) {
        if (stop !== this._mnemonicStop) {
            this._mnemonicStop = stop;
            this._updateTabIndex();
        }
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

        if (!active || active === this || this._mnemonicStop) {
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

        // Moving to a button clicks it, as in GTK.
        next._click();
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
