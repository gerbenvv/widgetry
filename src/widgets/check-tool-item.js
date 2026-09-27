/**
 * @module widgets/check-tool-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { CheckMenuItem } from './check-menu-item.js';
import { RadioMenuItem } from './radio-menu-item.js';
import { ToolItem } from './tool-item.js';

/**
 * A tool item that toggles between active (drawn pressed) and inactive when activated.
 *
 * Signals: `activate` (`item`) when the user activates the item (a click, Space or Enter, or its
 * proxy in the overflow menu of the tool bar) or `activate()` is called, after it toggled;
 * `toggle` (`item`) and `active-change` on every change of `active`, also from code.
 */
export class CheckToolItem extends ToolItem {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-check-tool-item');

        this._updateActiveState();
    }

    /**
     * Activates the item, as the user does: toggles `active` and emits `activate`. Does nothing if
     * it is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate() {
        if (!this.isSensitive) {
            return false;
        }

        this._toggleOnActivate();

        this.emit('activate', this);

        return true;
    }

    /**
     * Changes `active` for an activation. Radio items override this.
     *
     * @protected
     */
    _toggleOnActivate() {
        this.active = !this._active;
    }

    _createMenuProxy() {
        const ProxyClass = this._getRole() === 'radio' ? RadioMenuItem : CheckMenuItem;
        const proxy = new ProxyClass({
            label: this._getMenuLabel(),
            useUnderline: this._useUnderline,
            active: this._active,
            sensitive: this.sensitive,
        });

        proxy.connect('activate', () => this._onUserActivate());

        return proxy;
    }

    _updateActiveState() {
        this.el.classList.toggle('wy-active', this._active);

        if (this._getRole() === 'radio') {
            this.el.setAttribute('aria-checked', String(this._active));
        } else {
            this.el.setAttribute('aria-pressed', String(this._active));
        }
    }
}

defineProperties(CheckToolItem, {
    /**
     * Whether the item is active (checked), which draws it pressed.
     */
    active: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateActiveState();
            this.emit('toggle', this);
        },
    },
});

registerType('check-tool-item', CheckToolItem);
