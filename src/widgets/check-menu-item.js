/**
 * @module widgets/check-menu-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { MenuItem } from './menu-item.js';

/**
 * A menu item with a check mark, which activating toggles.
 *
 * Signals: `activate` (when activated, after toggling) and `toggle` (whenever `active` changes).
 */
export class CheckMenuItem extends MenuItem {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-check-menu-item');

        this._updateCheckState();
    }

    _getRole() {
        return 'menuitemcheckbox';
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
        this.inconsistent = false;
        this.active = !this._active;
    }

    _updateCheckState() {
        this.el.classList.toggle('wy-active', this._active);
        this.el.classList.toggle('wy-inconsistent', this._inconsistent);
        this.el.classList.toggle('wy-draw-as-radio', this._drawAsRadio);
        this.el.setAttribute(
            'aria-checked',
            this._inconsistent ? 'mixed' : String(Boolean(this._active))
        );
    }
}

defineProperties(CheckMenuItem, {
    /**
     * Whether the item is checked.
     */
    active: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateCheckState();
            this.emit('toggle', this);
        },
    },

    /**
     * Whether the check shows an "in between" state (a dash), e.g. for a setting that applies to
     * some of the selected objects only. Activating the item clears it.
     */
    inconsistent: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateCheckState();
        },
    },

    /**
     * Whether the check is drawn as a radio dot.
     */
    drawAsRadio: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateCheckState();
        },
    },
});

registerType('check-menu-item', CheckMenuItem);
