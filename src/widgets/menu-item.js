/**
 * @module widgets/menu-item
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { AbstractMenuItem } from './abstract-menu-item.js';
import {
    formatAccelerator,
    matchesAccelerator,
    parseAccelerator,
    renderMnemonicLabel,
    toAriaKeyShortcuts,
} from './accelerators.js';
import { Image } from './image.js';
import { getMenuManager } from './menu-manager.js';

/**
 * How long in milliseconds a menu bar item flashes when one of its items is activated by an
 * accelerator.
 *
 * @type {number}
 */
const ACCELERATOR_FLASH_DURATION = 150;

/**
 * A menu item with a label, an optional icon, an accelerator and a submenu.
 *
 * The label may contain a mnemonic: `'_File'` shows "File" with the "F" underlined, and pressing F
 * in the menu (or Alt+F for a menu bar item) activates the item. The accelerator (such as
 * `'Ctrl+S'`) is shown right-aligned and activates the item anywhere in the window of the menu
 * bar (or of the widget the menu is attached to), while no menu is open.
 *
 * Activating an item by the pointer or the keyboard closes all menus and then emits `activate`.
 * An item with a submenu opens it instead. Insensitive items cannot be activated.
 *
 * Signals: `activate`.
 */
export class MenuItem extends AbstractMenuItem {
    _initialize() {
        super._initialize();

        this._mnemonic = '';
        this._acceleratorValue = null;
        this._ownImage = false;
        this._submenuDisconnects = [];
        this._flashTimer = 0;

        this.el.setAttribute('role', this._getRole());
    }

    _render() {
        const element = createElement(`
            <div class="wy-menu-item">
                <span class="wy-menu-item-toggle" aria-hidden="true"></span>
                <span class="wy-menu-item-icon" aria-hidden="true"></span>
                <span class="wy-menu-item-label"></span>
                <span class="wy-menu-item-accelerator" aria-hidden="true"></span>
                <span class="wy-menu-item-arrow" aria-hidden="true"></span>
            </div>
        `);

        this._iconEl = element.querySelector('.wy-menu-item-icon');
        this._labelEl = element.querySelector('.wy-menu-item-label');
        this._acceleratorEl = element.querySelector('.wy-menu-item-accelerator');

        return element;
    }

    /**
     * The ARIA role of the item.
     *
     * @protected
     * @returns {string}
     */
    _getRole() {
        return 'menuitem';
    }

    /**
     * Activates the item: emits `activate`. Unlike activating it in a menu, this does not close
     * menus. Does nothing if the item is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate() {
        if (!this.isSensitive) {
            return false;
        }

        this.emit('activate', this);

        return true;
    }

    /**
     * Destroys the item and its submenu.
     */
    destroy() {
        this._setSubmenu(null);
        clearTimeout(this._flashTimer);

        super.destroy();
    }

    /**
     * Activates the item as the user did it in a menu: closes all menus first (so the focus is
     * back where it was, before a handler may move it), then activates it.
     *
     * @protected
     */
    _onUserActivate() {
        if (!this.isSensitive) {
            return;
        }

        getMenuManager().hideAllOpenMenus();

        this.activate();
    }

    /**
     * Activates the item because its accelerator was pressed.
     *
     * @protected
     * @returns {boolean} Whether it was activated.
     */
    _activateByAccelerator() {
        if (!this._isChainActivatable()) {
            return false;
        }

        this._flashTopLevelItem();

        return this.activate();
    }

    _findAccelerator(event) {
        if (this._acceleratorValue && matchesAccelerator(this._acceleratorValue, event)) {
            return this;
        }

        return this._submenu ? this._submenu._findAccelerator(event) : null;
    }

    _flashTopLevelItem() {
        // Find the item in the menu bar this item's menu hangs from.
        let item = this;
        while (item?.parent?.isMenu) {
            item = item.parent.attachWidget;
        }

        if (item instanceof MenuItem && item !== this && item.parent?.isMenuBar) {
            item.el.classList.add('wy-accelerator-flash');

            clearTimeout(item._flashTimer);
            item._flashTimer = setTimeout(() => {
                item.el.classList.remove('wy-accelerator-flash');
            }, ACCELERATOR_FLASH_DURATION);
        }
    }

    _attachChildElement(widget) {
        // The only child is the image, which goes in the icon column.
        this._iconEl.append(widget.el);
    }

    _setImage(image, own) {
        const old = this._image;
        if (old === image) {
            return false;
        }

        if (image && !(image instanceof Image)) {
            throw new TypeError('The image of a menu item must be an Image.');
        }

        this._image = image;
        this._ownImage = own;

        if (old && !old.destroyed && this._children.includes(old)) {
            this.removeChild(old);
        }

        if (image) {
            this.addChild(image);
        }

        this.el.classList.toggle('wy-has-icon', Boolean(image));

        return true;
    }

    _setSubmenu(submenu, destroyOld = true) {
        if (submenu && !submenu.isMenu) {
            throw new TypeError('A submenu must be a Menu.');
        }

        const old = this._submenu;
        if (old === submenu) {
            return false;
        }

        this._submenuDisconnects.forEach((disconnect) => disconnect());
        this._submenuDisconnects = [];

        this._submenu = submenu;

        if (old && !old.destroyed) {
            old.hide();
            old._setAttachWidget(null);

            if (destroyOld) {
                old.destroy();
            }
        }

        if (submenu) {
            submenu.hide();
            submenu._setAttachWidget(this);

            this._submenuDisconnects.push(
                submenu.connect('visible-change', () => this._onSubmenuVisibleChange()),
                submenu.connect('destroy', () => {
                    if (this._submenu === submenu) {
                        this._setSubmenu(null, false);
                        this.emit('submenu-change', this);
                    }
                })
            );
        }

        const hasSubmenu = Boolean(submenu);
        this.el.classList.toggle('wy-has-submenu', hasSubmenu);

        if (hasSubmenu) {
            this.el.setAttribute('aria-haspopup', 'menu');
            this.el.setAttribute('aria-controls', submenu.el.id);
        } else {
            this.el.removeAttribute('aria-haspopup');
            this.el.removeAttribute('aria-controls');
        }

        this._onSubmenuVisibleChange();

        return true;
    }

    _onSubmenuVisibleChange() {
        const open = Boolean(this._submenu?.visible);

        this.el.classList.toggle('wy-submenu-open', open);

        if (this._submenu) {
            this.el.setAttribute('aria-expanded', String(open));
        } else {
            this.el.removeAttribute('aria-expanded');
        }
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        if (!isVisible) {
            this._submenu?.hide();
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (!isSensitive) {
            this._submenu?.hide();
        }
    }
}

defineProperties(MenuItem, {
    /**
     * The label. With `useUnderline`, an underscore marks the mnemonic, as in `'_File'`.
     */
    label: {
        value: '',
        changed(label) {
            this._mnemonic = renderMnemonicLabel(this._labelEl, label, this._useUnderline).mnemonic;
        },
    },

    /**
     * Whether underscores in the label mark the mnemonic.
     */
    useUnderline: {
        value: true,
        changed(useUnderline) {
            this._mnemonic = renderMnemonicLabel(this._labelEl, this._label, useUnderline).mnemonic;
        },
    },

    /**
     * The mnemonic character (lowercase), or `''` for none.
     */
    mnemonic: {
        readOnly: true,
        get() {
            return this._mnemonic;
        },
    },

    /**
     * The name of the icon shown before the label, e.g. `'document-save'`, or `''` for none. The
     * icon is shown by an `Image` (see `image`).
     */
    icon: {
        value: '',
        changed(icon) {
            if (icon) {
                if (this._image && this._ownImage) {
                    this._image.icon = icon;
                } else {
                    this._setImage(new Image({ icon }), true);
                }
            } else if (this._ownImage) {
                const image = this._image;
                this._setImage(null, false);
                image?.destroy();
            }
        },
    },

    /**
     * The `Image` shown before the label, or `null`. Set it for a custom image; `icon` sets it
     * too.
     */
    image: {
        value: null,
        set(image) {
            const old = this._ownImage ? this._image : null;
            if (!this._setImage(image, false)) {
                return false;
            }

            old?.destroy();

            if (this._icon) {
                this._icon = '';
                this.emit('icon-change', this);
            }
        },
    },

    /**
     * The accelerator, e.g. `'Ctrl+S'`, `'Ctrl+Shift+Z'` or `'F5'`, or `''` for none. It is shown
     * right-aligned (with the platform's notation) and activates the item in the window.
     */
    accelerator: {
        value: '',
        coerce(accelerator) {
            const text = accelerator || '';

            // Validate the accelerator right away, so errors show where it is set.
            if (text) {
                parseAccelerator(text);
            }

            return text;
        },
        changed(accelerator) {
            this._acceleratorValue = accelerator ? parseAccelerator(accelerator) : null;
            this._acceleratorEl.textContent = accelerator
                ? formatAccelerator(this._acceleratorValue)
                : '';

            if (accelerator) {
                this.el.setAttribute(
                    'aria-keyshortcuts',
                    toAriaKeyShortcuts(this._acceleratorValue)
                );
            } else {
                this.el.removeAttribute('aria-keyshortcuts');
            }

            this.el.classList.toggle('wy-has-accelerator', Boolean(accelerator));
        },
    },

    /**
     * The submenu, a `Menu`, or `null`. The item owns it: replacing the submenu or destroying the
     * item destroys it. An item with a submenu shows an arrow and opens the submenu instead of
     * activating.
     */
    submenu: {
        value: null,
        set(submenu) {
            return this._setSubmenu(submenu || null);
        },
    },

    /**
     * Whether the item is placed at the far end of a menu bar, like a Help menu.
     */
    rightJustified: {
        value: false,
        changed(rightJustified) {
            this.el.classList.toggle('wy-right-justified', rightJustified);
        },
    },
});

registerType('menu-item', MenuItem);
