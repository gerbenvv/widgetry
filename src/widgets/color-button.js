/**
 * @module widgets/color-button
 */

import { formatHex, parseColor } from '../core/color.js';
import { Align, Response } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { bindToolkitText, toolkitText } from '../i18n/toolkit-text.js';
import { Button } from './button.js';
import { ColorChooser, ColorSwatch } from './color-chooser.js';
import { Dialog } from './dialog.js';
import { Popover, PopoverCloseReason } from './popover.js';
import { flushLayout } from './widget.js';

/**
 * A button that shows a color and lets the user choose another one with a `ColorChooser`, like
 * GTK's color button.
 *
 * Clicking the button opens the chooser in a popover below it. While the popover is open, the
 * button follows the chosen color; activating a color (a double click on a swatch, Enter), or
 * closing the popover by clicking elsewhere, keeps it, and Escape goes back to the color the button
 * had. With `modal`, the chooser opens in a modal dialog with Cancel and Select buttons instead.
 *
 * `color` is a CSS color, read back as a hex color (see `ColorChooser`); with `useAlpha` it can
 * be translucent.
 *
 * Signals: `color-set` (`button`) when the user chose a color, `color-change` whenever the
 * color changed, and `popup-open-change` when the chooser opened or closed.
 *
 * @example
 * const button = new ColorButton({ color: '#4e9a06', title: 'Accent Color' });
 * button.connect('color-set', () => (Application.accentColor = button.color));
 */
export class ColorButton extends Button {
    _initialize() {
        super._initialize();

        this._popover = null;
        this._popoverChooser = null;
        this._dialog = null;
        this._dialogChooser = null;
        this._originalColor = null;

        this.el.classList.add('wy-color-button');
        this.el.setAttribute('aria-haspopup', 'dialog');
        this.el.setAttribute('aria-expanded', 'false');

        this._swatch = new ColorSwatch({ hAlign: Align.CENTER });
        this._swatch.addStyleClass('wy-color-button-swatch');
        this.addChild(this._swatch);

        // The accessible name has the translated title.
        bindToolkitText(this, () => this._syncColor());
    }

    /**
     * The chooser of the open popover or dialog, or of the popover when nothing is open. It is
     * created on first use.
     *
     * @type {ColorChooser}
     */
    get chooser() {
        return this._dialogChooser || this._getPopoverChooser();
    }

    /**
     * The popover of the chooser, or `null` before it was first opened.
     *
     * @type {Popover | null}
     */
    get popover() {
        return this._popover;
    }

    /**
     * Sets several properties, applying `useAlpha` before the color so that the alpha of the color
     * is kept.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        const { useAlpha, ...rest } = properties;
        const alpha = useAlpha ?? properties['use-alpha'];
        delete rest['use-alpha'];

        let changed = alpha !== undefined && this.setProperty('useAlpha', alpha);
        if (super.set(rest)) {
            changed = true;
        }

        return changed;
    }

    /**
     * Opens the chooser: in a popover, or in a modal dialog with `modal`.
     */
    popup() {
        this.popupOpen = true;
    }

    /**
     * Closes the chooser, keeping the chosen color.
     */
    popdown() {
        this.popupOpen = false;
    }

    destroy() {
        this._dialog?.destroy();
        this._popover?.destroy();

        super.destroy();
    }

    _onClicked() {
        // A click while the popover is open closes it again.
        if (this._popover?.isOpen) {
            this._popover.popdown();
        } else {
            this.popup();
        }

        this.activate();
    }

    _getPopoverChooser() {
        if (!this._popoverChooser) {
            const chooser = this._createChooser();

            chooser.connect('color-change', () => {
                if (this._popover?.isOpen) {
                    this.color = chooser.color;
                }
            });
            chooser.connect('color-activate', () => this._popover?.popdown());

            this._popover = new Popover({ owner: this, align: 'start' });
            this._popover.addStyleClass('wy-color-button-popover');
            this._popover.child = chooser;
            this._popover.connect('close', (_popover, reason) => this._onPopoverClose(reason));

            this._popoverChooser = chooser;
        }

        return this._popoverChooser;
    }

    _createChooser() {
        return new ColorChooser({
            useAlpha: this._useAlpha,
            color: this._color,
            showEditor: this._showEditor,
            margin: 8,
        });
    }

    _openPopover() {
        const chooser = this._getPopoverChooser();

        chooser.set({ useAlpha: this._useAlpha, showEditor: this._showEditor });
        chooser.color = this._color;

        this._originalColor = this._color;

        // Lay out the chooser first, so the popover is placed with its real size.
        flushLayout();
        this._popover.popup(this.el);
        this._setExpanded(true);

        chooser.focusChooser();
    }

    _onPopoverClose(reason) {
        const original = this._originalColor;
        this._originalColor = null;
        this._setExpanded(false);

        if (reason === PopoverCloseReason.ESCAPE && original !== null) {
            this.color = original;
        } else if (original !== null && original !== this._color) {
            this.emit('color-set', this);
        }

        if (!this.destroyed && reason !== PopoverCloseReason.OWNER) {
            this.focus();
        }
    }

    _openDialog() {
        const chooser = this._createChooser();
        const dialog = new Dialog({ title: toolkitText(this._title), modal: true });

        dialog.addStyleClass('wy-color-button-dialog');
        dialog.addChild(chooser);
        dialog.addButton(Response.CANCEL);
        dialog.addButton(Response.OK, toolkitText('_Select'));
        dialog.defaultResponse = Response.OK;

        chooser.connect('color-activate', () => dialog.response(Response.OK));
        dialog.connect('response', (_dialog, response) => {
            this._dialog = null;
            this._dialogChooser = null;
            this._setExpanded(false);

            if (response === Response.OK && chooser.color !== this._color) {
                this.color = chooser.color;
                this.emit('color-set', this);
            }

            if (!dialog.destroyed) {
                dialog.close();
            }

            // Give the focus back, activating the window of the button again.
            if (!this.destroyed && this.isVisible && this.isSensitive) {
                this.hasFocus = true;
            }
        });

        this._dialog = dialog;
        this._dialogChooser = chooser;
        this._setExpanded(true);

        // Lay out the chooser first, so the dialog is centered with its real size.
        flushLayout();
        dialog.present();
        chooser.focusChooser();
    }

    _setExpanded(expanded) {
        this.el.setAttribute('aria-expanded', String(expanded));
        this.el.classList.toggle('wy-active', expanded);

        this.emit('popup-open-change', this);
    }

    _syncColor() {
        this._swatch.color = this._color;

        // The accessible name, or else the title, is followed by the color.
        const name = this._accessibleName || toolkitText(this._title);
        this.el.setAttribute('aria-label', `${name}: ${this._color}`);
    }

    _syncAccessibleName() {
        this._syncColor();
    }
}

defineProperties(ColorButton, {
    hAlign: { value: Align.START },
    vAlign: { value: Align.CENTER },

    /**
     * The color, as a CSS color. Reading it gives a hex color: `#rrggbb`, or `#rrggbbaa` when it
     * is translucent (only with `useAlpha`).
     */
    color: {
        value: '#000000',
        coerce(color) {
            const parsed = typeof color === 'string' ? parseColor(color) : null;
            if (!parsed) {
                throw new TypeError(`Invalid color '${String(color)}'.`);
            }

            return formatHex({ ...parsed, a: this._useAlpha ? parsed.a : 1 });
        },
        changed() {
            this._syncColor();
        },
    },

    /**
     * The color as channels: an object with `r`, `g` and `b` in [0, 255] and `a` in [0, 1].
     * Setting it sets `color`.
     */
    rgba: {
        signal: false,
        get() {
            return parseColor(this._color);
        },
        set(rgba) {
            if (!rgba || typeof rgba !== 'object') {
                throw new TypeError('The rgba of a color button must be an object.');
            }

            this.color = formatHex({ r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a ?? 1 });

            return false;
        },
    },

    /**
     * Whether the color can be translucent. Turning it off makes the color opaque.
     */
    useAlpha: {
        value: false,
        coerce: Boolean,
        changed(useAlpha) {
            if (!useAlpha) {
                this.color = this._color;
            }
        },
    },

    /**
     * The title of the dialog (with `modal`), also used as the accessible name of the button.
     */
    title: {
        value: 'Pick a Color',
        coerce(title) {
            return title === null || title === undefined ? '' : String(title);
        },
        changed() {
            this._syncColor();
        },
    },

    /**
     * Whether the chooser opens in a modal dialog instead of a popover.
     */
    modal: { value: false, coerce: Boolean },

    /**
     * Whether the chooser shows its editor below the palette.
     */
    showEditor: { value: true, coerce: Boolean },

    /**
     * Whether the chooser is open, in its popover or dialog. Setting it opens or closes the
     * chooser; closing it keeps the chosen color.
     */
    popupOpen: {
        signal: false,
        get() {
            return Boolean(this._dialog || this._popover?.isOpen);
        },
        set(open) {
            if (open && !this.popupOpen && this.isSensitive) {
                if (this._modal) {
                    this._openDialog();
                } else {
                    this._openPopover();
                }
            } else if (!open) {
                this._popover?.popdown();
                this._dialog?.response(Response.OK);
            }

            return false;
        },
    },
});

registerType('color-button', ColorButton);
