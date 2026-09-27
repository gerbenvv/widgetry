/**
 * @module widgets/color-chooser
 */

import {
    formatHex,
    getLuminance,
    hsvToRgb,
    normalizeColor,
    parseColor,
    rgbToHsv,
} from '../core/color.js';
import { Align, Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { bindToolkitText, toolkitText } from '../i18n/toolkit-text.js';
import { Box } from './box.js';
import { attachDoublePress } from './double-press.js';
import { LineEdit } from './line-edit.js';
import { Slider } from './slider.js';
import { Widget } from './widget.js';

/**
 * @typedef {object} PaletteColor
 * @property {string} color A hex color.
 * @property {string} name A name for assistive technology and tooltips.
 */

/**
 * The shades of the Tango palette, as in GTK's color chooser: a light, a medium and a dark shade
 * of each hue, and of the two sets of aluminium grays. The names are toolkit texts, translated
 * when shown.
 *
 * @type {ReadonlyArray<[string, string[]]>}
 */
const TANGO_HUES = Object.freeze([
    ['Scarlet Red', ['#ef2929', '#cc0000', '#a40000']],
    ['Orange', ['#fcaf3e', '#f57900', '#ce5c00']],
    ['Butter', ['#fce94f', '#edd400', '#c4a000']],
    ['Chameleon', ['#8ae234', '#73d216', '#4e9a06']],
    ['Sky Blue', ['#729fcf', '#3465a4', '#204a87']],
    ['Plum', ['#ad7fa8', '#75507b', '#5c3566']],
    ['Chocolate', ['#e9b96e', '#c17d11', '#8f5902']],
    ['Aluminium 2', ['#888a85', '#555753', '#2e3436']],
    ['Aluminium 1', ['#eeeeec', '#d3d7cf', '#babdb6']],
]);

/**
 * The row of grays below the hues, from black to white.
 *
 * @type {ReadonlyArray<[string, string]>}
 */
const TANGO_GRAYS = Object.freeze([
    ['Black', '#000000'],
    ['Very Dark Gray', '#2e3436'],
    ['Darker Gray', '#555753'],
    ['Medium Dark Gray', '#888a85'],
    ['Medium Gray', '#babdb6'],
    ['Light Gray', '#d3d7cf'],
    ['Lighter Gray', '#eeeeec'],
    ['Very Light Gray', '#f3f3f3'],
    ['White', '#ffffff'],
]);

/**
 * The default palette of the color chooser, row by row: the light, medium and dark shades of the
 * Tango hues, and a row of grays. It has 9 columns. The English names are translated like the
 * other toolkit texts (see `toolkitText`).
 *
 * @type {ReadonlyArray<Readonly<PaletteColor>>}
 */
export const DEFAULT_PALETTE = Object.freeze(
    [
        ...[0, 1, 2].flatMap((shade) =>
            TANGO_HUES.map(([name, colors]) => ({
                color: colors[shade],
                name: ['Light ', '', 'Dark '][shade] + name,
            }))
        ),
        ...TANGO_GRAYS.map(([name, color]) => ({ color, name })),
    ].map((x) => Object.freeze(x))
);

/**
 * The fraction the arrow keys change the saturation or value of the color plane by; with Control
 * it is ten times as much.
 *
 * @type {number}
 */
const PLANE_STEP = 0.01;

/**
 * Converts a palette entry (a CSS color, or an object with `color` and optionally `name`) to a
 * palette color.
 *
 * @param {string | {color: string, name?: string}} entry
 * @returns {PaletteColor}
 */
function toPaletteColor(entry) {
    const text = typeof entry === 'string' ? entry : entry?.color;
    const color = normalizeColor(text);
    if (!color) {
        throw new TypeError(`Invalid palette color '${String(text)}'.`);
    }

    const name = typeof entry === 'object' && entry.name ? String(entry.name) : color;

    return { color, name };
}

/**
 * Checks and normalizes a color value.
 *
 * @param {unknown} color
 * @returns {string}
 */
function checkColor(color) {
    const normalized = typeof color === 'string' ? normalizeColor(color) : null;
    if (!normalized) {
        throw new TypeError(`Invalid color '${String(color)}'.`);
    }

    return normalized;
}

/**
 * A small rectangle showing a color. A translucent color is shown over a checkerboard, next to
 * its opaque version, like GTK's color swatches.
 */
export class ColorSwatch extends Widget {
    _initialize() {
        super._initialize();

        this._syncColor();
    }

    _render() {
        return createElement(`
            <div class="wy-color-swatch" role="img">
                <span class="wy-color-swatch-color"></span>
            </div>
        `);
    }

    _syncColor() {
        const color = parseColor(this._color) || { r: 0, g: 0, b: 0, a: 1 };

        this.el.style.setProperty('--wy-swatch-color', formatHex(color));
        this.el.style.setProperty('--wy-swatch-opaque', formatHex(color, false));
        this.el.classList.toggle('wy-translucent', color.a < 1);

        // The accessible name, if any, is followed by the color.
        const hex = formatHex(color);
        this.el.setAttribute(
            'aria-label',
            this._accessibleName ? `${this._accessibleName}: ${hex}` : hex
        );
    }

    _syncAccessibleName() {
        this._syncColor();
    }
}

defineProperties(ColorSwatch, {
    hAlign: { value: Align.START },
    vAlign: { value: Align.CENTER },

    /**
     * The color shown, as a CSS color. It is normalized to a hex color.
     */
    color: {
        value: '#000000',
        coerce: checkColor,
        changed() {
            this._syncColor();
        },
    },
});

/**
 * The grid of swatches of a color chooser. It takes the focus as a whole; the arrow keys, Home
 * and End move the cursor through the swatches and select them.
 *
 * Signals: `select` (`palette, color`) when the user selected a swatch, `activate` (`palette,
 * color`) when a swatch was double clicked or Enter or Space was pressed.
 */
export class ColorPalette extends Widget {
    _initialize() {
        super._initialize();

        this._cursor = -1;
        this._listId = uniqueId('wy-color-palette');
        this.el.id = this._listId;

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        // A double press activates a swatch; the toolkit counts presses itself, which works the
        // same in all browsers.
        attachDoublePress(this.el, (event) => this._onDoublePress(event), {
            key: (event) => this._getSwatchIndex(event.target),
        });

        this._renderSwatches();

        // The names of the colors are translated like the toolkit's own texts.
        bindToolkitText(this, () => this._translateSwatches());
    }

    _render() {
        return createElement(
            '<div class="wy-color-palette" role="listbox" data-wy-label="Palette"></div>'
        );
    }

    /**
     * Selects the swatch at an index as if the user chose it.
     *
     * @protected
     * @param {number} index
     */
    _choose(index) {
        const entry = this._colors[index];
        if (!entry) {
            return;
        }

        this._cursor = index;
        this._selected = entry.color;
        this._syncSwatches();

        this.emit('selected-change', this);
        this.emit('select', this, entry.color);
    }

    _renderSwatches() {
        this.el.textContent = '';
        this.el.style.setProperty('--wy-palette-columns', String(this._columns));

        this._colors.forEach((entry, index) => {
            const swatch = document.createElement('div');
            const color = parseColor(entry.color);

            swatch.className = 'wy-color-palette-swatch';
            swatch.id = `${this._listId}-${index}`;
            swatch.dataset.index = String(index);
            swatch.setAttribute('role', 'option');
            swatch.style.setProperty('--wy-swatch-color', entry.color);
            swatch.classList.toggle('wy-light', getLuminance(color) > 0.45);

            this.el.append(swatch);
        });

        this._cursor = Math.min(this._cursor, this._colors.length - 1);
        this._translateSwatches();
        this._syncSwatches();
    }

    _translateSwatches() {
        for (const swatch of this.el.children) {
            const name = toolkitText(this._colors[Number(swatch.dataset.index)].name);

            swatch.setAttribute('aria-label', name);
            swatch.title = name;
        }
    }

    _syncSwatches() {
        const selected = this._selected;
        const selectedIndex = this._colors.findIndex((x) => x.color === selected);

        // The cursor follows the selection, unless the keyboard moved it elsewhere.
        if (selectedIndex >= 0 && this._colors[this._cursor]?.color !== selected) {
            this._cursor = selectedIndex;
        }

        for (const swatch of this.el.children) {
            const index = Number(swatch.dataset.index);
            const isSelected = this._colors[index].color === selected;

            swatch.classList.toggle('wy-selected', isSelected);
            swatch.classList.toggle('wy-cursor', index === this._cursor);
            swatch.setAttribute('aria-selected', String(isSelected));
        }

        if (this._cursor >= 0) {
            this.el.setAttribute('aria-activedescendant', `${this._listId}-${this._cursor}`);
        } else {
            this.el.removeAttribute('aria-activedescendant');
        }
    }

    _getSwatchIndex(target) {
        const swatch =
            target instanceof Element ? target.closest('.wy-color-palette-swatch') : null;

        return swatch && swatch.parentElement === this.el ? Number(swatch.dataset.index) : -1;
    }

    _onPointerDown(event) {
        const index = this._getSwatchIndex(event.target);
        if (event.button !== 0 || index < 0 || !this.isSensitive) {
            return;
        }

        this._choose(index);
    }

    _onDoublePress(event) {
        const index = this._getSwatchIndex(event.target);
        if (index >= 0 && this.isSensitive) {
            this.emit('activate', this, this._colors[index].color);
        }
    }

    _onKeyDown(event) {
        if (!this.isSensitive || event.altKey || event.metaKey || event.defaultPrevented) {
            return;
        }

        const count = this._colors.length;
        const columns = this._columns;
        const cursor = this._cursor;

        let index;
        switch (event.key) {
            case Key.LEFT:
                index = cursor - 1;
                break;

            case Key.RIGHT:
                index = cursor + 1;
                break;

            case Key.UP:
                index = cursor < 0 ? 0 : cursor - columns;
                break;

            case Key.DOWN:
                index = cursor < 0 ? 0 : cursor + columns;
                break;

            case Key.HOME:
                index = 0;
                break;

            case Key.END:
                index = count - 1;
                break;

            case Key.ENTER:
            case Key.SPACE:
                if (cursor >= 0) {
                    event.preventDefault();

                    this._choose(cursor);
                    this.emit('activate', this, this._colors[cursor].color);
                }

                return;

            default:
                return;
        }

        event.preventDefault();

        if (index >= 0 && index < count && index !== cursor) {
            this._choose(index);
            this.el.children[index]?.scrollIntoView?.({ block: 'nearest' });
        }
    }
}

defineProperties(ColorPalette, {
    canFocus: { value: true },

    /**
     * The colors, as palette colors with `color` and `name`.
     */
    colors: {
        value: DEFAULT_PALETTE,
        coerce(colors) {
            if (!Array.isArray(colors)) {
                throw new TypeError('The palette colors must be an array.');
            }

            return Object.freeze(colors.map(toPaletteColor));
        },
        changed() {
            this._renderSwatches();
        },
    },

    /**
     * The number of swatches per row.
     */
    columns: {
        value: 9,
        coerce(columns) {
            const value = Math.floor(Number(columns));
            if (!(value >= 1)) {
                throw new RangeError(`Invalid number of palette columns ${columns}.`);
            }

            return value;
        },
        changed() {
            this._renderSwatches();
        },
    },

    /**
     * The selected hex color, or `null`. A color that is not in the palette selects no swatch.
     */
    selected: {
        value: null,
        changed() {
            this._syncSwatches();
        },
    },
});

/**
 * The saturation and value square of the color editor: the saturation grows from left to right,
 * and the value from the bottom to the top, for the current hue. Dragging or pressing moves the
 * marker; the arrow keys move it by 1% (with Control by 10%).
 *
 * Signals: `change` (`plane`) when the user moved the marker.
 */
export class ColorPlane extends Widget {
    _initialize() {
        super._initialize();

        this._pointerId = null;

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this.el.addEventListener('pointerup', (event) => this._onPointerUp(event));
        this.el.addEventListener('pointercancel', (event) => this._onPointerUp(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        // The value text is translated, also when the language changes.
        bindToolkitText(this, () => this._sync());
    }

    _render() {
        return createElement(`
            <div class="wy-color-plane" role="slider" data-wy-label="Saturation and value" aria-valuemin="0" aria-valuemax="100">
                <span class="wy-color-plane-marker" aria-hidden="true"></span>
            </div>
        `);
    }

    /**
     * Sets the saturation and value because the user moved the marker, and emits `change`.
     *
     * @protected
     * @param {number} saturation
     * @param {number} value
     */
    _setFromUser(saturation, value) {
        saturation = clamp(saturation, 0, 1);
        value = clamp(value, 0, 1);

        if (saturation === this._saturation && value === this._value) {
            return;
        }

        this.set({ saturation, value });

        this.emit('change', this);
    }

    _sync() {
        const hue = hsvToRgb(this._hue, 1, 1);
        const saturation = Math.round(this._saturation * 100);
        const value = Math.round(this._value * 100);

        this.el.style.setProperty('--wy-plane-hue', formatHex({ ...hue, a: 1 }));
        this.el.style.setProperty('--wy-plane-x', String(this._saturation));
        this.el.style.setProperty('--wy-plane-y', String(1 - this._value));
        this.el.setAttribute('aria-valuenow', String(value));
        this.el.setAttribute(
            'aria-valuetext',
            toolkitText('Saturation %d%%, value %d%%', saturation, value)
        );
    }

    _setFromPointer(event) {
        const rect = this.el.getBoundingClientRect();
        const x = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
        const y = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;

        this._setFromUser(x, 1 - y);
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive || this._pointerId !== null) {
            return;
        }

        event.preventDefault();

        this._pointerId = event.pointerId;
        this.el.classList.add('wy-dragging');

        try {
            this.el.setPointerCapture(event.pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        this._setFromPointer(event);
    }

    _onPointerMove(event) {
        if (event.pointerId === this._pointerId) {
            this._setFromPointer(event);
        }
    }

    _onPointerUp(event) {
        if (event.pointerId === this._pointerId) {
            this._pointerId = null;
            this.el.classList.remove('wy-dragging');
        }
    }

    _onKeyDown(event) {
        if (!this.isSensitive || event.altKey || event.metaKey || event.defaultPrevented) {
            return;
        }

        const step = event.ctrlKey ? PLANE_STEP * 10 : PLANE_STEP;
        const saturation = this._saturation;
        const value = this._value;

        switch (event.key) {
            case Key.LEFT:
                this._setFromUser(saturation - step, value);
                break;

            case Key.RIGHT:
                this._setFromUser(saturation + step, value);
                break;

            case Key.UP:
                this._setFromUser(saturation, value + step);
                break;

            case Key.DOWN:
                this._setFromUser(saturation, value - step);
                break;

            case Key.PAGE_UP:
                this._setFromUser(saturation, value + PLANE_STEP * 10);
                break;

            case Key.PAGE_DOWN:
                this._setFromUser(saturation, value - PLANE_STEP * 10);
                break;

            case Key.HOME:
                this._setFromUser(0, value);
                break;

            case Key.END:
                this._setFromUser(1, value);
                break;

            default:
                return;
        }

        event.preventDefault();
    }
}

defineProperties(ColorPlane, {
    canFocus: { value: true },

    /**
     * The hue in degrees, which colors the plane.
     */
    hue: {
        value: 0,
        coerce: Number,
        changed() {
            this._sync();
        },
    },

    /**
     * The saturation, from 0 at the left to 1 at the right.
     */
    saturation: {
        value: 0,
        coerce: (x) => clamp(Number(x), 0, 1),
        changed() {
            this._sync();
        },
    },

    /**
     * The value, from 0 at the bottom to 1 at the top.
     */
    value: {
        value: 1,
        coerce: (x) => clamp(Number(x), 0, 1),
        changed() {
            this._sync();
        },
    },
});

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
export class ColorChooser extends Box {
    _initialize() {
        this._hsv = { h: 0, s: 0, v: 0 };
        this._alpha = 1;
        this._syncing = false;
        this._editingEntry = false;

        super._initialize();

        this.el.classList.add('wy-color-chooser');

        this._palette = new ColorPalette();
        this._palette.connect('select', (_palette, color) => this._setFromUser(color));
        this._palette.connect('activate', (_palette, color) => this._activateColor(color));

        this._plane = new ColorPlane({ hExpand: true, vExpand: true });
        this._plane.connect('change', () => this._onPlaneChange());

        this._hueSlider = new Slider({
            orientation: Orientation.VERTICAL,
            lower: 0,
            upper: 360,
            stepIncrement: 1,
            pageIncrement: 15,
            digits: 0,
            drawValue: false,
            hasOrigin: false,
        });
        this._hueSlider.addStyleClass('wy-color-chooser-hue');
        bindToolkitText(
            this._hueSlider,
            () => (this._hueSlider.accessibleName = toolkitText('Hue'))
        );
        this._hueSlider.connect('value-change', () => this._onHueChange());

        this._alphaSlider = new Slider({
            lower: 0,
            upper: 100,
            stepIncrement: 1,
            pageIncrement: 10,
            digits: 0,
            drawValue: false,
            hasOrigin: false,
            visible: false,
        });
        this._alphaSlider.addStyleClass('wy-color-chooser-alpha');
        bindToolkitText(
            this._alphaSlider,
            () => (this._alphaSlider.accessibleName = toolkitText('Alpha'))
        );
        this._alphaSlider.connect('value-change', () => this._onAlphaChange());

        this._preview = new ColorSwatch();
        this._preview.addStyleClass('wy-color-chooser-preview');

        this._entry = new LineEdit({
            hExpand: true,
            widthChars: 12,
            validator: (text) => parseColor(text) !== null,
        });
        bindToolkitText(
            this._entry,
            () => (this._entry.accessibleName = toolkitText('Color name'))
        );
        this._entry.addStyleClass('wy-color-chooser-entry');
        this._entry.connect('change', () => this._onEntryChange());
        this._entry.connect('activate', () => this._onEntryActivate());
        this._entry.focusElement.addEventListener('blur', () => this._syncEntry());

        const plane = new Box({ spacing: 6, vExpand: true });
        plane.addChild(this._plane);
        plane.addChild(this._hueSlider);

        const entryRow = new Box({ spacing: 6 });
        entryRow.addChild(this._preview);
        entryRow.addChild(this._entry);

        this._editor = new Box({ orientation: Orientation.VERTICAL, spacing: 6, vExpand: true });
        this._editor.addStyleClass('wy-color-chooser-editor');
        this._editor.addChild(plane);
        this._editor.addChild(this._alphaSlider);
        this._editor.addChild(entryRow);

        this.addChild(this._palette);
        this.addChild(this._editor);

        // Pressing a part focuses it, also where widgets cannot take the focus themselves (in a
        // popover, which is not a window).
        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event), true);
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._setHsv(rgbToHsv(0, 0, 0), 1);
        this._syncAll();
    }

    /**
     * The palette of swatches.
     *
     * @type {ColorPalette}
     */
    get palette() {
        return this._palette;
    }

    /**
     * The entry for typing a color.
     *
     * @type {LineEdit}
     */
    get entry() {
        return this._entry;
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
     * Gives the keyboard focus to the chooser: to the selected swatch of the palette, or to the
     * square of the editor when the color is not in the palette.
     *
     * @returns {boolean} Whether a part got the focus.
     */
    focusChooser() {
        const inPalette = this._palette.colors.some((x) => x.color === this.color);
        const target = inPalette || !this._showEditor ? this._palette : this._plane;

        return this._focusPart(target);
    }

    /**
     * Focuses a part of the chooser. Outside a window (in a popover) the widget cannot take the
     * focus itself, so its element is focused directly.
     *
     * @protected
     * @param {Widget} widget
     * @returns {boolean}
     */
    _focusPart(widget) {
        if (!widget.isVisible || !widget.isSensitive) {
            return false;
        }

        if (widget.window) {
            return widget.focus();
        }

        widget.focusElement.focus({ preventScroll: true });

        return document.activeElement === widget.focusElement;
    }

    _computeExpand(_direction) {
        // The chooser keeps its natural size, like GTK's; set `hExpand` or `vExpand` to stretch it.
        return false;
    }

    /**
     * Sets the color because the user changed it.
     *
     * @protected
     * @param {string} color
     */
    _setFromUser(color) {
        this.color = color;
    }

    /**
     * Activates a color: makes it the color and emits `color-activate`.
     *
     * @protected
     * @param {string} color
     */
    _activateColor(color) {
        this.color = color;

        this.emit('color-activate', this, this.color);
    }

    /**
     * Stores the editor state and the color it gives.
     *
     * @protected
     * @param {{h: number, s: number, v: number}} hsv
     * @param {number} alpha
     */
    _setHsv(hsv, alpha) {
        this._hsv = { ...hsv };
        this._alpha = this._useAlpha ? clamp(alpha, 0, 1) : 1;
    }

    /**
     * Returns the color of the editor state.
     *
     * @protected
     * @returns {string}
     */
    _getHsvColor() {
        const { h, s, v } = this._hsv;

        return formatHex({ ...hsvToRgb(h, s, v), a: this._alpha });
    }

    /**
     * Applies a change of the editor state: updates the color and the other parts.
     *
     * @protected
     */
    _applyEditor() {
        const color = this._getHsvColor();
        if (color === this._color) {
            this._syncAll();

            return;
        }

        this._color = color;
        this._syncAll();

        this.emit('color-change', this);
    }

    _syncAll() {
        const { h, s, v } = this._hsv;
        const opaque = formatHex({ ...hsvToRgb(h, s, v), a: 1 });

        this._syncing = true;
        try {
            this._plane.set({ hue: h, saturation: s, value: v });
            this._hueSlider.value = h;
            this._alphaSlider.value = Math.round(this._alpha * 100);
        } finally {
            this._syncing = false;
        }

        this.el.style.setProperty('--wy-chooser-opaque', opaque);
        this._preview.color = this._color;
        this._palette.selected = this._color;

        if (!this._editingEntry) {
            this._syncEntry();
        }
    }

    _syncEntry() {
        this._editingEntry = false;

        if (this._entry.text !== this._color) {
            this._syncing = true;
            try {
                this._entry.text = this._color;
            } finally {
                this._syncing = false;
            }
        }
    }

    _onPlaneChange() {
        if (this._syncing) {
            return;
        }

        this._setHsv(
            { ...this._hsv, s: this._plane.saturation, v: this._plane.value },
            this._alpha
        );
        this._applyEditor();
    }

    _onHueChange() {
        if (this._syncing) {
            return;
        }

        // A hue of 360 degrees is the same color as 0, but keeps the thumb at the end.
        this._setHsv({ ...this._hsv, h: this._hueSlider.value }, this._alpha);
        this._applyEditor();
    }

    _onAlphaChange() {
        if (this._syncing) {
            return;
        }

        this._setHsv(this._hsv, this._alphaSlider.value / 100);
        this._applyEditor();
    }

    _onEntryChange() {
        if (this._syncing) {
            return;
        }

        // Typed colors apply right away, while the text stays as typed.
        const color = parseColor(this._entry.text);
        if (color) {
            this._editingEntry = true;
            this.color = formatHex(color);
        }
    }

    _onEntryActivate() {
        const color = parseColor(this._entry.text);
        this._editingEntry = false;

        if (color) {
            this._activateColor(formatHex(color));
        }

        // Show the color as a hex color again, also when the text was not a valid color.
        this._syncEntry();
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        for (const part of [this._palette, this._plane, this._hueSlider, this._alphaSlider]) {
            if (part.el.contains(event.target)) {
                this._focusPart(part);

                return;
            }
        }
    }

    _onKeyDown(event) {
        if (
            event.key !== Key.TAB ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            this.window
        ) {
            return;
        }

        // Outside a window, Tab cycles through the parts of the chooser.
        const chain = this._getFocusChain();
        if (!chain.length) {
            return;
        }

        event.preventDefault();

        const current = chain.findIndex((x) => x.focusElement.contains(document.activeElement));
        const step = event.shiftKey ? -1 : 1;

        let index = current >= 0 ? current : step > 0 ? -1 : 0;
        for (let count = 0; count < chain.length; ++count) {
            index = (index + step + chain.length) % chain.length;

            if (this._focusPart(chain[index])) {
                return;
            }
        }
    }
}

defineProperties(ColorChooser, {
    orientation: { value: Orientation.VERTICAL },

    spacing: { value: 8 },

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
        set(color) {
            const parsed = parseColor(color);
            const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);

            // Keep the hue (and the saturation) of grays, so the editor does not jump.
            if (hsv.s === 0 || hsv.v === 0) {
                hsv.h = this._hsv.h;
            }

            if (hsv.v === 0) {
                hsv.s = this._hsv.s;
            }

            this._color = color;
            this._setHsv(hsv, parsed.a);
            this._syncAll();
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
                throw new TypeError('The rgba of a color chooser must be an object.');
            }

            this.color = formatHex({ r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a ?? 1 });

            return false;
        },
    },

    /**
     * Whether the color can be translucent: shows the alpha slider and keeps the alpha of colors.
     */
    useAlpha: {
        value: false,
        coerce: Boolean,
        changed(useAlpha) {
            this._alphaSlider.visible = useAlpha;
            this.el.classList.toggle('wy-use-alpha', useAlpha);

            if (!useAlpha && this._alpha < 1) {
                this._setHsv(this._hsv, 1);
                this._applyEditor();
            }
        },
    },

    /**
     * Whether the editor (the square, the sliders and the entry) is shown below the palette.
     */
    showEditor: {
        value: true,
        coerce: Boolean,
        changed(showEditor) {
            this._editor.visible = showEditor;
        },
    },

    /**
     * The colors of the palette: CSS colors, or objects with `color` and `name`. Reading gives
     * objects with a hex `color` and a `name`. Defaults to `DEFAULT_PALETTE`.
     */
    paletteColors: {
        get() {
            return this._palette.colors;
        },
        set(colors) {
            this._palette.colors = colors ?? DEFAULT_PALETTE;
            this._palette.selected = this._color;
        },
    },

    /**
     * The number of swatches per row of the palette.
     */
    paletteColumns: {
        get() {
            return this._palette.columns;
        },
        set(columns) {
            this._palette.columns = columns;
        },
    },
});

registerType('color-chooser', ColorChooser);
registerType('color-swatch', ColorSwatch);
