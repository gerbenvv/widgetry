/**
 * @module widgets/color-chooser
 */
import { Box } from './box.js';
import { LineEdit } from './line-edit.js';
import { Slider } from './slider.js';
import { Widget } from './widget.js';
export type PaletteColor = {
    /**
     * A hex color.
     */
    color: string;
    /**
     * A name for assistive technology and tooltips.
     */
    name: string;
};
/**
 * The default palette of the color chooser, row by row: the light, medium and dark shades of the
 * Tango hues, and a row of grays. It has 9 columns.
 *
 * @type {ReadonlyArray<Readonly<PaletteColor>>}
 */
export declare const DEFAULT_PALETTE: ReadonlyArray<Readonly<PaletteColor>>;
/**
 * A small rectangle showing a color. A translucent color is shown over a checkerboard, next to
 * its opaque version, like GTK's color swatches.
 */
export declare class ColorSwatch extends Widget {
    _initialize(): void;
    _render(): HTMLElement;
    _syncColor(): void;
}
/**
 * The grid of swatches of a color chooser. It takes the focus as a whole; the arrow keys, Home
 * and End move the cursor through the swatches and select them.
 *
 * Signals: `select` (`palette, color`) when the user selected a swatch, `activate` (`palette,
 * color`) when a swatch was double clicked or Enter or Space was pressed.
 */
export declare class ColorPalette extends Widget {
    _cursor: any;
    _listId: string;
    _selected: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Selects the swatch at an index as if the user chose it.
     *
     * @protected
     * @param {number} index
     */
    protected _choose(index: number): void;
    _renderSwatches(): void;
    _syncSwatches(): void;
    _getSwatchIndex(target: any): number;
    _onPointerDown(event: any): void;
    _onDoublePress(event: any): void;
    _onKeyDown(event: any): void;
}
/**
 * The saturation and value square of the color editor: the saturation grows from left to right,
 * and the value from the bottom to the top, for the current hue. Dragging or pressing moves the
 * marker; the arrow keys move it by 1% (with Control by 10%).
 *
 * Signals: `change` (`plane`) when the user moved the marker.
 */
export declare class ColorPlane extends Widget {
    _pointerId: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Sets the saturation and value because the user moved the marker, and emits `change`.
     *
     * @protected
     * @param {number} saturation
     * @param {number} value
     */
    protected _setFromUser(saturation: number, value: number): void;
    _sync(): void;
    _setFromPointer(event: any): void;
    _onPointerDown(event: any): void;
    _onPointerMove(event: any): void;
    _onPointerUp(event: any): void;
    _onKeyDown(event: any): void;
}
/**
 * Lets the user choose a color, like GTK's color chooser: from a palette of swatches (the Tango
 * colors by default), or with an editor that has a saturation and value square, a hue slider, an
 * alpha slider (with `useAlpha`) and an entry for any CSS color (a hex color, `rgb()`, `hsl()`,
 * a named color and so on).
 *
 * `color` is a CSS color; setting it accepts any CSS color, and reading it returns a normalized
 * hex color: `#rrggbb`, or `#rrggbbaa` when it is translucent. `rgba` gives the channels.
 * Without `useAlpha`, colors are opaque.
 *
 * Keyboard: the palette, the square, the sliders and the entry take the focus in turn (with Tab,
 * also when the chooser is in a popover). The arrow keys move through the palette and the square;
 * Enter or Space on a swatch, a double click, and Enter in the entry activate the color.
 *
 * Signals: `color-change` (the color changed, by the user or from code) and `color-activate`
 * (`chooser, color`) when the user activated a color.
 *
 * @example
 * const chooser = new ColorChooser({ color: '#3465a4', useAlpha: true });
 * chooser.connect('color-activate', (_chooser, color) => apply(color));
 */
export declare class ColorChooser extends Box {
    _hsv: {
        h: number;
        s: number;
        v: number;
    } | {
        h: number;
        s: number;
        v: number;
    };
    _alpha: number;
    _syncing: boolean;
    _editingEntry: boolean;
    _palette: ColorPalette;
    _plane: ColorPlane;
    _hueSlider: Slider;
    _alphaSlider: Slider;
    _preview: ColorSwatch;
    _entry: LineEdit;
    _editor: Box;
    color: string;
    _color: any;
    _initialize(): void;
    /**
     * The palette of swatches.
     *
     * @type {ColorPalette}
     */
    get palette(): ColorPalette;
    /**
     * The entry for typing a color.
     *
     * @type {LineEdit}
     */
    get entry(): LineEdit;
    /**
     * Sets several properties, applying `useAlpha` before the color so that the alpha of the color
     * is kept.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Gives the keyboard focus to the chooser: to the selected swatch of the palette, or to the
     * square of the editor when the color is not in the palette.
     *
     * @returns {boolean} Whether a part got the focus.
     */
    focusChooser(): boolean;
    /**
     * Focuses a part of the chooser. Outside a window (in a popover) the widget cannot take the
     * focus itself, so its element is focused directly.
     *
     * @protected
     * @param {Widget} widget
     * @returns {boolean}
     */
    protected _focusPart(widget: Widget): boolean;
    _computeExpand(_direction: any): boolean;
    /**
     * Sets the color because the user changed it.
     *
     * @protected
     * @param {string} color
     */
    protected _setFromUser(color: string): void;
    /**
     * Activates a color: makes it the color and emits `color-activate`.
     *
     * @protected
     * @param {string} color
     */
    protected _activateColor(color: string): void;
    /**
     * Stores the editor state and the color it gives.
     *
     * @protected
     * @param {{h: number, s: number, v: number}} hsv
     * @param {number} alpha
     */
    protected _setHsv(hsv: {
        h: number;
        s: number;
        v: number;
    }, alpha: number): void;
    /**
     * Returns the color of the editor state.
     *
     * @protected
     * @returns {string}
     */
    protected _getHsvColor(): string;
    /**
     * Applies a change of the editor state: updates the color and the other parts.
     *
     * @protected
     */
    protected _applyEditor(): void;
    _syncAll(): void;
    _syncEntry(): void;
    _onPlaneChange(): void;
    _onHueChange(): void;
    _onAlphaChange(): void;
    _onEntryChange(): void;
    _onEntryActivate(): void;
    _onPointerDown(event: any): void;
    _onKeyDown(event: any): void;
}

/** The declared properties of {@link ColorSwatch}. */
export interface ColorSwatch {
    hAlign: any;
    vAlign: any;
    /**
     * The color shown, as a CSS color. It is normalized to a hex color.
     */
    color: string;
}

/** The declared properties of {@link ColorPalette}. */
export interface ColorPalette {
    canFocus: any;
    /**
     * The colors, as palette colors with `color` and `name`.
     */
    colors: any;
    /**
     * The number of swatches per row.
     */
    columns: number;
    /**
     * The selected hex color, or `null`. A color that is not in the palette selects no swatch.
     */
    selected: any;
}

/** The declared properties of {@link ColorPlane}. */
export interface ColorPlane {
    canFocus: any;
    /**
     * The hue in degrees, which colors the plane.
     */
    hue: number;
    /**
     * The saturation, from 0 at the left to 1 at the right.
     */
    saturation: number;
    /**
     * The value, from 0 at the bottom to 1 at the top.
     */
    value: number;
}

/** The declared properties of {@link ColorChooser}. */
export interface ColorChooser {
    orientation: any;
    spacing: any;
    /**
     * The color as channels: an object with `r`, `g` and `b` in [0, 255] and `a` in [0, 1].
     * Setting it sets `color`.
     */
    rgba: any;
    /**
     * Whether the color can be translucent: shows the alpha slider and keeps the alpha of colors.
     */
    useAlpha: boolean;
    /**
     * Whether the editor (the square, the sliders and the entry) is shown below the palette.
     */
    showEditor: boolean;
    /**
     * The colors of the palette: CSS colors, or objects with `color` and `name`. Reading gives
     * objects with a hex `color` and a `name`. Defaults to `DEFAULT_PALETTE`.
     */
    paletteColors: any;
    /**
     * The number of swatches per row of the palette.
     */
    paletteColumns: any;
}
