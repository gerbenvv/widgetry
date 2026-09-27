/**
 * @module widgets/menu-bar
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { AbstractMenuItem } from './abstract-menu-item.js';
import { trackAccelerators } from './accelerators.js';
import { Box } from './box.js';
import { getMenuManager } from './menu-manager.js';
import { Widget } from './widget.js';

/**
 * A horizontal bar of menu items, usually at the top of a window, whose submenus drop down.
 *
 * Pressing an item opens its menu; while a menu is open, moving the pointer to another item opens
 * that item's menu instead, and pressing the open item again closes it. F10 opens the first menu
 * and Alt with a mnemonic (Alt+F for `'_File'`) opens the matching one, with the keyboard; Left
 * and Right then move between the menus. The accelerators of all items work anywhere in the
 * bar's window.
 *
 * Signals: `selected-change`.
 */
export class MenuBar extends Box {
    _initialize() {
        super._initialize();

        this._pressedItem = null;
        this._submenuDisconnect = null;

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this.el.addEventListener('pointerup', (event) => this._onPointerUp(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._stopAccelerators = trackAccelerators(this, this);
    }

    _render() {
        return createElement(
            '<div class="wy-menu-bar" role="menubar" tabindex="-1" aria-orientation="horizontal"></div>'
        );
    }

    insertChild(widget, index) {
        if (!(widget instanceof AbstractMenuItem)) {
            throw new TypeError('Only menu items can be added to a menu bar.');
        }

        return super.insertChild(widget, index);
    }

    removeChild(widget) {
        if (widget === this._selected) {
            this._select(null);
        }

        return super.removeChild(widget);
    }

    destroy() {
        this._select(null);
        this._stopAccelerators();

        super.destroy();
    }

    _getSelectableItems() {
        return this._children.filter((x) => x._isSelectable());
    }

    _itemFromTarget(target) {
        let widget = Widget.fromElement(target);
        while (widget && widget.parent !== this) {
            widget = widget.parent;
        }

        return widget && widget !== this && widget._isSelectable() ? widget : null;
    }

    /**
     * Selects an item, opening its menu, or deselects (with `null`), closing it.
     *
     * @protected
     * @param {AbstractMenuItem | null} item
     * @param {boolean} [keyboard] Whether the keyboard opened it, which selects the menu's first
     *     item.
     */
    _select(item, keyboard = false) {
        const old = this._selected;
        if (old === item) {
            if (item?.submenu && !item.submenu.visible) {
                this._popupSubmenu(item, keyboard);
            }

            return;
        }

        this._selected = item;

        if (old && !old.destroyed) {
            old._setSelected(false);

            this._submenuDisconnect?.();
            this._submenuDisconnect = null;
            old.submenu?.hide();
        }

        const manager = getMenuManager();
        if (item) {
            // Join the open menus first, so the focus to restore is remembered.
            manager._addShell(this);

            item._setSelected(true);

            if (item.submenu) {
                this._popupSubmenu(item, keyboard);
            } else {
                // Without a menu, the bar itself takes the keys.
                this.el.focus({ preventScroll: true });
            }
        } else {
            manager._removeShell(this);
        }

        this.emit('selected-change', this);
    }

    _popupSubmenu(item, keyboard) {
        const submenu = item.submenu;

        this._submenuDisconnect?.();
        this._submenuDisconnect = submenu.connect('visible-change', () => {
            if (!submenu.visible && this._selected === item) {
                this._select(null);
            }
        });

        submenu.popup(item, {
            side: 'bottom',
            align: 'start',
            owner: this.el,
            selectFirst: keyboard,
        });
    }

    /**
     * Moves the selection to the next (1) or previous (-1) item, wrapping around, and opens its
     * menu.
     *
     * @protected
     * @param {number} delta
     * @param {boolean} [keyboard]
     */
    _moveSelectionBy(delta, keyboard = false) {
        const items = this._getSelectableItems();
        if (!items.length) {
            return;
        }

        const index = items.indexOf(this._selected);
        const next = index < 0 ? 0 : (index + delta + items.length) % items.length;

        this._select(items[next], keyboard);
    }

    _deactivateShell() {
        this._select(null);
    }

    _containsTarget(target) {
        return this.el.contains(target);
    }

    _onItemGone(item) {
        if (item === this._selected) {
            this._select(null);
        }
    }

    _findAccelerator(event) {
        for (const child of this._children) {
            const item = child._findAccelerator(event);
            if (item) {
                return item;
            }
        }

        return null;
    }

    /**
     * Handles the menu bar keys of the window: F10 opens the first menu and Alt with a mnemonic
     * opens the matching menu.
     *
     * @protected
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    _handleWindowKey(event) {
        if (!this.isVisible || !this.isSensitive) {
            return false;
        }

        const items = this._getSelectableItems();

        if (
            event.key === Key.F10 &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
        ) {
            if (!items.length) {
                return false;
            }

            this._select(items[0], true);

            return true;
        }

        if (!event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }

        // Use the physical key, since Alt (Option on macOS) may change the character.
        const character = /^Key[A-Z]$/.test(event.code || '')
            ? event.code.slice(3).toLowerCase()
            : /^Digit\d$/.test(event.code || '')
              ? event.code.slice(5)
              : event.key.toLowerCase();

        const item = items.find((x) => x.mnemonic && x.mnemonic === character);
        if (!item) {
            return false;
        }

        if (item.submenu) {
            this._select(item, true);
        } else {
            item._onUserActivate?.();
        }

        return true;
    }

    _onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }

        const item = this._itemFromTarget(event.target);
        if (!item) {
            if (this._selected) {
                getMenuManager().hideAllOpenMenus();
            }

            return;
        }

        // Pressing the open item again closes its menu.
        if (item === this._selected) {
            this._pressedItem = null;
            getMenuManager().hideAllOpenMenus();

            return;
        }

        this._pressedItem = item;
        this._select(item);
    }

    _onPointerMove(event) {
        if (!this._selected) {
            return;
        }

        const item = this._itemFromTarget(event.target);
        if (item && item !== this._selected) {
            this._select(item);
        }
    }

    _onPointerUp(event) {
        const pressed = this._pressedItem;
        this._pressedItem = null;

        const item = this._itemFromTarget(event.target);
        if (item && item === pressed && !item.submenu) {
            item._onUserActivate?.();
        }
    }

    _onKeyDown(event) {
        // Only while an item without a menu is selected; otherwise the open menu has the keys.
        if (!this._selected || event.defaultPrevented) {
            return;
        }

        let handled = true;
        switch (event.key) {
            case Key.LEFT:
                this._moveSelectionBy(-1, true);
                break;

            case Key.RIGHT:
                this._moveSelectionBy(1, true);
                break;

            case Key.ENTER:
            case Key.SPACE:
            case Key.DOWN:
                if (this._selected.submenu) {
                    this._popupSubmenu(this._selected, true);
                } else if (event.key !== Key.DOWN) {
                    this._selected._onUserActivate?.();
                }
                break;

            case Key.ESCAPE:
            case Key.F10:
            case Key.TAB:
                getMenuManager().hideAllOpenMenus();
                handled = event.key !== Key.TAB;
                break;

            default: {
                const character = event.key.length === 1 ? event.key.toLowerCase() : '';
                const item = this._getSelectableItems().find(
                    (x) => character && x.mnemonic === character
                );

                if (item) {
                    if (item.submenu) {
                        this._select(item, true);
                    } else {
                        item._onUserActivate?.();
                    }
                } else {
                    handled = false;
                }
            }
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        if (!isVisible) {
            this._select(null);
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (!isSensitive) {
            this._select(null);
        }
    }
}

defineProperties(MenuBar, {
    orientation: { value: Orientation.HORIZONTAL },

    vExpand: { value: false },

    /**
     * Whether this is a menu shell (a container of menu items).
     */
    isMenuShell: { value: true, readOnly: true },

    /**
     * Whether this is a menu bar.
     */
    isMenuBar: { value: true, readOnly: true },

    /**
     * The selected item, whose menu is open, or `null`. Setting it opens that item's menu.
     */
    selected: {
        value: null,
        set(item) {
            if (item && (item.parent !== this || !item._isSelectable())) {
                throw new Error('Only a selectable item of the menu bar can be selected.');
            }

            this._select(item || null);

            return false;
        },
    },
});

registerType('menu-bar', MenuBar);
