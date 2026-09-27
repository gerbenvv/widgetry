/**
 * @module widgets/check-tool-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { CheckMenuItem } from './check-menu-item.js';
import { ToolItem } from './tool-item.js';

/**
 * A tool item that toggles between active (drawn pressed) and inactive when activated.
 *
 * Signals: `activate` (when activated, after toggling) and `toggle` (whenever `active` changes).
 */
export class CheckToolItem extends ToolItem {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-check-tool-item');

        this._updateActiveState();
    }

    /**
     * Activates the item: toggles it and emits `activate`. Does nothing if it is insensitive.
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
        const proxy = new CheckMenuItem({
            label: this._getMenuLabel(),
            useUnderline: this._useUnderline,
            active: this._active,
            drawAsRadio: this._getRole() === 'radio',
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
