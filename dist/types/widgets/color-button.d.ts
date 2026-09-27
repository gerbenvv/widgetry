/**
 * @module widgets/color-button
 */
import { Button } from './button.js';
import { ColorChooser, ColorSwatch } from './color-chooser.js';
import { Dialog } from './dialog.js';
import { Popover } from './popover.js';
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
 * Signals: `color-set` (`button`) when the user chose a color, and `color-change` whenever the
 * color changed.
 *
 * @example
 * const button = new ColorButton({ color: '#4e9a06', title: 'Accent Color' });
 * button.connect('color-set', () => (Application.accentColor = button.color));
 */
export declare class ColorButton extends Button {
    _popover: Popover;
    _popoverChooser: ColorChooser;
    _dialog: Dialog;
    _dialogChooser: ColorChooser;
    _originalColor: any;
    _swatch: ColorSwatch;
    color: any;
    hasFocus: boolean;
    _initialize(): void;
    /**
     * The chooser of the open popover or dialog, or of the popover when nothing is open. It is
     * created on first use.
     *
     * @type {ColorChooser}
     */
    get chooser(): ColorChooser;
    /**
     * The popover of the chooser, or `null` before it was first opened.
     *
     * @type {Popover | null}
     */
    get popover(): Popover | null;
    /**
     * Sets several properties, applying `useAlpha` before the color so that the alpha of the color
     * is kept.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Opens the chooser: in a popover, or in a modal dialog with `modal`.
     */
    openChooser(): void;
    /**
     * Closes the chooser, keeping the chosen color.
     */
    closeChooser(): void;
    destroy(): void;
    _onClicked(): void;
    _getPopoverChooser(): ColorChooser;
    _createChooser(): ColorChooser;
    _openPopover(): void;
    _onPopoverClose(reason: any): void;
    _openDialog(): void;
    _setExpanded(expanded: any): void;
    _syncColor(): void;
}

/** The declared properties of {@link ColorButton}. */
export interface ColorButton {
    hAlign: any;
    vAlign: any;
    /**
     * The color as channels: an object with `r`, `g` and `b` in [0, 255] and `a` in [0, 1].
     * Setting it sets `color`.
     */
    rgba: any;
    /**
     * Whether the color can be translucent. Turning it off makes the color opaque.
     */
    useAlpha: boolean;
    /**
     * The title of the dialog (with `modal`), also used as the accessible name of the button.
     */
    title: string;
    /**
     * Whether the chooser opens in a modal dialog instead of a popover.
     */
    modal: any;
    /**
     * Whether the chooser shows its editor below the palette.
     */
    showEditor: any;
    /**
     * Whether the chooser is open.
     */
    readonly isChooserOpen: any;
}
