/**
 * @module widgets/tool-item
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { parseMnemonic, renderMnemonicLabel } from './accelerators.js';
import { AbstractToolItem } from './abstract-tool-item.js';
import { attachButtonBehavior } from './button-behavior.js';
import { Image } from './image.js';
import { MenuItem } from './menu-item.js';

/**
 * A tool bar button with an icon and a label, of which the tool bar's `style` decides what is
 * shown. It is flat, shows a raised border when hovered and looks pressed while pressed.
 *
 * With a `submenu`, an arrow next to the button opens the menu (as does Alt+Down, or Down in a
 * horizontal tool bar), while the button itself still activates.
 *
 * Signals: `activate`.
 */
export class ToolItem extends AbstractToolItem {
    _initialize() {
        super._initialize();

        this._ownImage = false;
        this._submenuDisconnects = [];

        this.el.setAttribute('role', this._getRole());

        this._behavior = attachButtonBehavior(this, {
            focusOnPress: false,
            onActivate: () => this._onUserActivate(),
        });

        this._arrowEl.addEventListener('pointerdown', (event) => this._onArrowPointerDown(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
    }

    _render() {
        const element = createElement(`
            <div class="wy-tool-item">
                <span class="wy-tool-item-button">
                    <span class="wy-tool-item-icon" aria-hidden="true"></span>
                    <span class="wy-tool-item-label" aria-hidden="true"></span>
                </span>
                <span class="wy-tool-item-arrow" aria-hidden="true" hidden></span>
            </div>
        `);

        this._iconEl = element.querySelector('.wy-tool-item-icon');
        this._labelEl = element.querySelector('.wy-tool-item-label');
        this._arrowEl = element.querySelector('.wy-tool-item-arrow');

        return element;
    }

    /**
     * Activates the item: emits `activate`. Does nothing if it is insensitive.
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
     * Opens the submenu, if any.
     *
     * @param {boolean} [keyboard] Whether to select the first item, as when using the keyboard.
     */
    popupSubmenu(keyboard = false) {
        const submenu = this._submenu;
        if (!submenu || !this.isSensitive || !this.isVisible) {
            return;
        }

        const vertical = this.toolBar?.orientation === Orientation.VERTICAL;

        submenu.popup(this, {
            side: vertical ? 'right' : 'bottom',
            align: 'start',
            owner: this._arrowEl,
            selectFirst: keyboard,
        });
    }

    /**
     * Destroys the item and its submenu.
     */
    destroy() {
        this._setSubmenu(null);
        this._behavior.destroy();

        super.destroy();
    }

    /**
     * The ARIA role of the item.
     *
     * @protected
     * @returns {string}
     */
    _getRole() {
        return 'button';
    }

    /**
     * Activates the item as the user did it (by pressing it, or with Enter or Space).
     *
     * @protected
     */
    _onUserActivate() {
        this.activate();
    }

    /**
     * The text for the item in menus: the label, or else the tooltip.
     *
     * @protected
     * @returns {string}
     */
    _getMenuLabel() {
        if (this._label) {
            return this._label;
        }

        const tooltip = this.tooltipLabel || '';

        return this._useUnderline ? tooltip.replace(/_/g, '__') : tooltip;
    }

    _createMenuProxy() {
        const proxy = new MenuItem({
            label: this._getMenuLabel(),
            useUnderline: this._useUnderline,
            icon: this._icon,
            sensitive: this.sensitive,
        });

        proxy.connect('activate', () => this._onUserActivate());

        return proxy;
    }

    _onToolBarChange() {
        const toolBar = this.toolBar;
        if (this._ownImage && this._image && toolBar) {
            this._image.pixelSize = toolBar.iconSize;
        }
    }

    _attachChildElement(widget) {
        // The only child is the image, which goes in the icon slot.
        this._iconEl.append(widget.el);
    }

    _setImage(image, own) {
        const old = this._image;
        if (old === image) {
            return false;
        }

        if (image && !(image instanceof Image)) {
            throw new TypeError('The image of a tool item must be an Image.');
        }

        this._image = image;
        this._ownImage = own;

        if (old && !old.destroyed && this._children.includes(old)) {
            this.removeChild(old);
        }

        if (image) {
            this.addChild(image);
            this._onToolBarChange();
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
                submenu.connect('visible-change', () => {
                    this.el.classList.toggle('wy-submenu-open', submenu.visible);
                    this.el.setAttribute('aria-expanded', String(submenu.visible));
                }),
                submenu.connect('destroy', () => {
                    if (this._submenu === submenu) {
                        this._setSubmenu(null, false);
                        this.emit('submenu-change', this);
                    }
                })
            );
        }

        const hasSubmenu = Boolean(submenu);
        this._arrowEl.hidden = !hasSubmenu;
        this.el.classList.toggle('wy-has-submenu', hasSubmenu);
        this.el.classList.remove('wy-submenu-open');

        if (hasSubmenu) {
            this.el.setAttribute('aria-haspopup', 'menu');
            this.el.setAttribute('aria-expanded', 'false');
            this.el.setAttribute('aria-keyshortcuts', 'Alt+ArrowDown');
        } else {
            this.el.removeAttribute('aria-haspopup');
            this.el.removeAttribute('aria-expanded');
            this.el.removeAttribute('aria-keyshortcuts');
        }

        return true;
    }

    _onArrowPointerDown(event) {
        // The arrow opens the menu instead of pressing the button.
        event.stopPropagation();

        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        this._tooltip?.disappear();

        if (this._submenu?.visible) {
            this._submenu.hide();
        } else {
            this.popupSubmenu();
        }
    }

    _onKeyDown(event) {
        if (!this._submenu || event.defaultPrevented || event.target !== this.el) {
            return;
        }

        const horizontal = this.toolBar?.orientation !== Orientation.VERTICAL;
        const opens =
            (event.key === Key.DOWN && (event.altKey || horizontal)) ||
            (event.key === Key.RIGHT && event.altKey);

        if (opens) {
            event.preventDefault();
            event.stopPropagation();

            this.popupSubmenu(true);
        }
    }

    _updateLabel() {
        renderMnemonicLabel(this._labelEl, this._label, this._useUnderline);

        const text = parseMnemonic(this._label, this._useUnderline).text;
        this.el.classList.toggle('wy-has-label', Boolean(text));

        if (text) {
            this.el.setAttribute('aria-label', text);
        } else {
            this.el.removeAttribute('aria-label');
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        if (!isSensitive) {
            this._submenu?.hide();
        }
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        if (!isVisible) {
            this._submenu?.hide();
        }
    }
}

defineProperties(ToolItem, {
    canFocus: { value: true },

    /**
     * The label. With `useUnderline`, an underscore marks a mnemonic (used in the overflow menu).
     */
    label: {
        value: '',
        changed() {
            this._updateLabel();
        },
    },

    /**
     * Whether underscores in the label mark a mnemonic.
     */
    useUnderline: {
        value: false,
        changed() {
            this._updateLabel();
        },
    },

    /**
     * The name of the icon, e.g. `'document-save'`, or `''` for none. The icon is shown by an
     * `Image` (see `image`), sized by the tool bar's `iconSize`.
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
     * The `Image` shown as the icon, or `null`. Set it for a custom image; `icon` sets it too.
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
     * Whether the item is important: in the `BOTH_HORIZONTAL` tool bar style only important
     * items show their label next to the icon.
     */
    isImportant: {
        value: false,
        changed(isImportant) {
            this.el.classList.toggle('wy-important', isImportant);
        },
    },

    /**
     * The submenu opened by the item's arrow, a `Menu`, or `null`. The item owns it: replacing
     * the submenu or destroying the item destroys it.
     */
    submenu: {
        value: null,
        set(submenu) {
            return this._setSubmenu(submenu || null);
        },
    },
});

registerType('tool-item', ToolItem);
