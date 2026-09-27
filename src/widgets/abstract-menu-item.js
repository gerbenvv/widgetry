/**
 * @module widgets/abstract-menu-item
 */

import { defineProperties } from '../core/instance.js';
import { uniqueId } from '../core/util.js';
import { Container } from './container.js';

/**
 * The base class of the items of menus and menu bars (menu shells). An item can only be added to a
 * menu shell. The shell selects (highlights) at most one of its items, following the pointer and
 * the keyboard.
 *
 * Signals: `selected-change`.
 */
export class AbstractMenuItem extends Container {
    _initialize() {
        super._initialize();

        this.el.id = uniqueId('wy-menu-item');
    }

    /**
     * Whether the item can be selected (highlighted) by its shell. Separators cannot.
     *
     * @protected
     * @returns {boolean}
     */
    _isSelectable() {
        return this.isVisible && this.isSensitive;
    }

    /**
     * Whether the item and the items its menu hangs from are all visible and sensitive, so that
     * it can be activated, e.g. by its accelerator, like in GTK.
     *
     * @protected
     * @returns {boolean}
     */
    _isChainActivatable() {
        let item = this;
        while (item) {
            if (!item.visible || !item.isSensitive) {
                return false;
            }

            const shell = item.parent;
            if (shell?.isMenu) {
                if (!shell.sensitive) {
                    return false;
                }

                const attached = shell.attachWidget;
                item = attached instanceof AbstractMenuItem ? attached : null;

                if (attached && !(attached instanceof AbstractMenuItem) && !attached.isSensitive) {
                    return false;
                }
            } else {
                item = null;
            }
        }

        return true;
    }

    /**
     * Returns this item if its accelerator matches a key event, or an item of its submenu that
     * matches. Overridden by menu items.
     *
     * @protected
     * @param {KeyboardEvent} _event
     * @returns {AbstractMenuItem | null}
     */
    _findAccelerator(_event) {
        return null;
    }

    /**
     * Sets whether the item is selected. Called by the menu shell.
     *
     * @protected
     * @param {boolean} selected
     */
    _setSelected(selected) {
        if (selected === this._selected) {
            return;
        }

        this._selected = selected;
        this.el.classList.toggle('wy-selected', selected);

        this.emit('selected-change', this);
    }

    _setParent(parent) {
        if (parent && !parent.isMenuShell) {
            throw new Error('A menu item can only be added to a menu or a menu bar.');
        }

        super._setParent(parent);
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        if (!isVisible && this._selected) {
            this.parent?._onItemGone?.(this);
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (!isSensitive && this._selected) {
            this.parent?._onItemGone?.(this);
        }
    }
}

defineProperties(AbstractMenuItem, {
    /**
     * Whether the item is currently selected (highlighted) in its menu or menu bar.
     */
    selected: { value: false, readOnly: true },
});
