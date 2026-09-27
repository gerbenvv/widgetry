/**
 * @module widgets/menu-button
 */

import { Position } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { getIcon } from '../icons/icons.js';
import { renderMnemonicLabel } from './accelerators.js';
import { Bin } from './bin.js';
import { attachButtonBehavior } from './button-behavior.js';

/**
 * Other names accepted for `direction`, as in GTK's arrow types.
 *
 * @type {Readonly<Record<string, string>>}
 */
const DIRECTION_ALIASES = Object.freeze({
    down: Position.BOTTOM,
    up: Position.TOP,
});

/**
 * A button that pops up a menu, with an arrow showing where the menu goes.
 *
 * Pressing the button opens the menu (and pressing it again closes it); dragging onto an item
 * and releasing activates that item. Enter and Space open the menu with its first item selected.
 * The button shows its `label` (with a mnemonic underscore) and `icon`, or a custom child.
 *
 * Signals: `toggle` (when `active` changes).
 */
export class MenuButton extends Bin {
    _initialize() {
        super._initialize();

        this._menuDisconnects = [];
        this._keyboardOpen = false;

        // Open on press, like the desktop. This runs before the button behavior, which then
        // only handles the keyboard.
        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));

        this._behavior = attachButtonBehavior(this, {
            onActivate: () => {
                this._keyboardOpen = true;
                this.active = !this._active;
                this._keyboardOpen = false;
            },
        });

        this._updateArrow();
    }

    _render() {
        const element = createElement(`
            <div class="wy-button wy-menu-button" role="button" aria-haspopup="menu" aria-expanded="false">
                <span class="wy-menu-button-content">
                    <span class="wy-menu-button-icon" aria-hidden="true" hidden></span>
                    <span class="wy-menu-button-label" hidden></span>
                    <span class="wy-menu-button-child"></span>
                </span>
                <span class="wy-menu-button-arrow" aria-hidden="true"></span>
            </div>
        `);

        this._iconEl = element.querySelector('.wy-menu-button-icon');
        this._labelEl = element.querySelector('.wy-menu-button-label');
        this._bodyEl = element.querySelector('.wy-menu-button-child');

        return element;
    }

    /**
     * Opens the menu.
     */
    popup() {
        this.active = true;
    }

    /**
     * Closes the menu.
     */
    popdown() {
        this.active = false;
    }

    /**
     * Destroys the button and its menu.
     */
    destroy() {
        this._setMenu(null);
        this._behavior.destroy();

        super.destroy();
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        event.stopImmediatePropagation();
        this._tooltip?.disappear();

        // Take the focus first, so it comes back here when the menu closes.
        this.focus();

        this.active = !this._active;
    }

    _setMenu(menu, destroyOld = true) {
        if (menu && !menu.isMenu) {
            throw new TypeError('The menu of a menu button must be a Menu.');
        }

        const old = this._menu;
        if (old === menu) {
            return false;
        }

        this._menuDisconnects.forEach((disconnect) => disconnect());
        this._menuDisconnects = [];

        this.active = false;
        this._menu = menu;

        if (old && !old.destroyed) {
            old.hide();
            old._setAttachWidget(null);

            if (destroyOld) {
                old.destroy();
            }
        }

        if (menu) {
            menu.hide();
            menu._setAttachWidget(this);

            this.el.setAttribute('aria-controls', menu.el.id);

            this._menuDisconnects.push(
                menu.connect('visible-change', () => {
                    if (!menu.visible) {
                        this.active = false;
                    }
                }),
                menu.connect('destroy', () => {
                    if (this._menu === menu) {
                        this._setMenu(null, false);
                        this.emit('menu-change', this);
                    }
                })
            );
        } else {
            this.el.removeAttribute('aria-controls');
        }

        return true;
    }

    _updateArrow() {
        this.el.dataset.direction = this._direction;
    }

    _updateContent() {
        const hasChild = this._children.length > 0;
        const icon = this._icon ? getIcon(this._icon) : null;

        this._iconEl.innerHTML = icon || '';
        this._iconEl.hidden = !icon || hasChild;
        this._labelEl.hidden = !this._label || hasChild;
    }

    _onChildrenChange() {
        super._onChildrenChange();

        this._updateContent();
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (!isSensitive) {
            this.active = false;
        }
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        if (!isVisible) {
            this.active = false;
        }
    }
}

defineProperties(MenuButton, {
    canFocus: { value: true },

    /**
     * The label. An underscore marks the mnemonic, as in `'_Options'`.
     */
    label: {
        value: '',
        changed(label) {
            renderMnemonicLabel(this._labelEl, label, this._useUnderline);
            this._updateContent();
        },
    },

    /**
     * Whether underscores in the label mark the mnemonic.
     */
    useUnderline: {
        value: true,
        changed(useUnderline) {
            renderMnemonicLabel(this._labelEl, this._label, useUnderline);
        },
    },

    /**
     * The name of an icon shown before the label, or `''` for none.
     */
    icon: {
        value: '',
        changed() {
            this._updateContent();
        },
    },

    /**
     * The menu that the button pops up, or `null`. The button owns it: replacing the menu or
     * destroying the button destroys it.
     */
    menu: {
        value: null,
        set(menu) {
            return this._setMenu(menu || null);
        },
    },

    /**
     * The menu, under the original toolkit's name. The same as `menu`.
     */
    submenu: {
        signal: false,
        get() {
            return this._menu;
        },
        set(menu) {
            this.menu = menu;

            return false;
        },
    },

    /**
     * Where the menu pops up: one of `Position` (`'bottom'` by default). `'down'` and `'up'` are
     * accepted too.
     */
    direction: {
        value: Position.BOTTOM,
        coerce(direction) {
            const value = DIRECTION_ALIASES[direction] || direction;
            if (!Object.values(Position).includes(value)) {
                throw new RangeError(`Invalid menu button direction '${direction}'.`);
            }

            return value;
        },
        changed() {
            this._updateArrow();
        },
    },

    /**
     * Whether the menu is open. Setting it opens or closes the menu.
     */
    active: {
        value: false,
        set(active) {
            active = Boolean(active);
            if (active === this._active) {
                return false;
            }

            if (active && (!this._menu || !this.isSensitive || !this.isVisible)) {
                return false;
            }

            this._active = active;

            this.el.classList.toggle('wy-active', active);
            this.el.setAttribute('aria-expanded', String(active));

            if (active) {
                this._menu.popup(this, {
                    side: this._direction,
                    align: 'start',
                    owner: this.el,
                    selectFirst: this._keyboardOpen,
                });
            } else if (this._menu?.visible) {
                this._menu.hide();
            }

            this.emit('toggle', this);
        },
    },
});

registerType('menu-button', MenuButton);
