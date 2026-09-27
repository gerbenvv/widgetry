/**
 * @module widgets/button-box
 */

import { Align, ButtonBoxStyle, Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Box } from './box.js';
import { SELF_ALIGNMENT } from './widget.js';

/**
 * The layout styles, for validating `layoutStyle`.
 *
 * @type {ReadonlySet<string>}
 */
const LAYOUT_STYLES = new Set(Object.values(ButtonBoxStyle));

/**
 * The CSS `justify-content` of each layout style.
 *
 * @type {Readonly<Record<string, string>>}
 */
const JUSTIFY_CONTENT = Object.freeze({
    [ButtonBoxStyle.SPREAD]: 'space-evenly',
    [ButtonBoxStyle.EDGE]: 'space-between',
    [ButtonBoxStyle.START]: 'flex-start',
    [ButtonBoxStyle.END]: 'flex-end',
    [ButtonBoxStyle.CENTER]: 'center',
});

/**
 * A box for a row (or column) of buttons, such as the action area of a dialog, like GTK's button
 * box.
 *
 * The buttons get the same size (the largest natural size, but at least `minChildWidth` by
 * `minChildHeight`) unless `homogeneous` is turned off, and are arranged by `layoutStyle`.
 * Secondary children (see `setChildSecondary()`) are placed apart at the other end, such as a
 * Help button at the left of OK and Cancel. With the `spread` style the spacing is also added
 * before the first and after the last button.
 */
export class ButtonBox extends Box {
    _initialize() {
        super._initialize();

        /** @type {Set<import('./widget.js').Widget>} */
        this._secondary = new Set();

        this._childObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            this._childObserver = new ResizeObserver(() => {
                if (!this.destroyed && !this._measuring) {
                    this._queueLayout();
                }
            });
        }

        this._measuring = false;
    }

    _render() {
        return createElement('<div class="wy-box wy-button-box"></div>');
    }

    /**
     * Sets whether a child is secondary: placed apart from the other children, at the start for
     * the `end`, `edge`, `spread` and `center` styles, and at the end for the `start` style.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} secondary
     * @throws {Error} If the widget is not a child.
     */
    setChildSecondary(widget, secondary) {
        if (!this._children.includes(widget)) {
            throw new Error('The widget is not a child of this button box.');
        }

        if (secondary) {
            this._secondary.add(widget);
        } else {
            this._secondary.delete(widget);
        }

        this._queueLayout();
    }

    /**
     * Returns whether a child is secondary.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {boolean}
     */
    getChildSecondary(widget) {
        return this._secondary.has(widget);
    }

    insertChild(widget, index) {
        const result = super.insertChild(widget, index);

        this._childObserver?.observe(widget.el);

        return result;
    }

    removeChild(widget) {
        const index = super.removeChild(widget);

        this._secondary.delete(widget);
        this._childObserver?.unobserve(widget.el);

        for (const name of [
            'flex',
            'order',
            'minWidth',
            'minHeight',
            'marginLeft',
            'marginRight',
            'marginTop',
            'marginBottom',
            'margin',
            'alignSelf',
        ]) {
            widget._setLayoutStyle(name, '');
        }

        widget._applyLayoutStyle();

        return index;
    }

    destroy() {
        this._childObserver?.disconnect();

        super.destroy();
    }

    _updateLayout() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;
        const style = this.bodyElement.style;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);

        const layoutStyle = this._layoutStyle;
        const spacing = `${this._spacing}px`;

        style.gap = spacing;
        style.justifyContent = JUSTIFY_CONTENT[layoutStyle];

        // The spread style also has the spacing before the first and after the last child, so
        // its natural size includes it.
        const padding = layoutStyle === ButtonBoxStyle.SPREAD ? spacing : '';
        style.paddingLeft = style.paddingRight = horizontal ? padding : '';
        style.paddingTop = style.paddingBottom = horizontal ? '' : padding;

        const visible = this._children.filter((x) => x.visible);
        const size = this._homogeneous ? this._measureLargestChild(visible, horizontal) : 0;

        const secondaryAtEnd = layoutStyle === ButtonBoxStyle.START;
        const secondary = visible.filter((x) => this._secondary.has(x));
        const primary = visible.filter((x) => !this._secondary.has(x));

        for (const child of this._children) {
            this._layoutButton(child, horizontal, size);
        }

        // Separate the secondary children from the primary ones with an auto margin.
        const separated = secondary.length && primary.length;
        const edge = layoutStyle === ButtonBoxStyle.EDGE || layoutStyle === ButtonBoxStyle.SPREAD;

        if (separated && !edge) {
            const [start, end] = horizontal ? ['Left', 'Right'] : ['Top', 'Bottom'];

            if (secondaryAtEnd) {
                secondary[0]._setLayoutStyle(`margin${start}`, 'auto');
            } else {
                secondary[secondary.length - 1]._setLayoutStyle(`margin${end}`, 'auto');

                if (layoutStyle === ButtonBoxStyle.CENTER) {
                    primary[primary.length - 1]._setLayoutStyle(`margin${end}`, 'auto');
                }
            }
        }
    }

    _layoutButton(child, horizontal, size) {
        const secondary = this._secondary.has(child);
        const secondaryAtEnd = this._layoutStyle === ButtonBoxStyle.START;

        child._setLayoutStyle('flex', '0 0 auto');
        child._setLayoutStyle('order', secondary ? (secondaryAtEnd ? '1' : '-1') : '');

        // The cross axis follows the child's alignment; buttons fill it by default.
        const align = horizontal ? child.vAlign : child.hAlign;
        child._setLayoutStyle('alignSelf', align === Align.FILL ? '' : SELF_ALIGNMENT[align]);

        // Reset the margins, which may have had an auto margin before.
        for (const name of ['marginLeft', 'marginRight', 'marginTop', 'marginBottom', 'margin']) {
            child._setLayoutStyle(name, '');
        }

        const margin = child.margin;
        if (margin.top || margin.right || margin.bottom || margin.left) {
            child._setLayoutStyle(
                'margin',
                `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`
            );
        }

        const minimum = this._getMinimumChildSize(child, horizontal);
        const main = Math.max(minimum, size);
        const cross = horizontal ? this._minChildHeight : this._minChildWidth;

        child._setLayoutStyle(horizontal ? 'minWidth' : 'minHeight', main > 0 ? `${main}px` : '');
        child._setLayoutStyle(horizontal ? 'minHeight' : 'minWidth', cross > 0 ? `${cross}px` : '');
    }

    _getMinimumChildSize(child, horizontal) {
        const request = horizontal ? child.width : child.height;
        const minimum = horizontal ? this._minChildWidth : this._minChildHeight;

        return Math.max(request, minimum, 0);
    }

    /**
     * Measures the largest natural size of the children along the box, without the sizes this
     * box imposes on them.
     *
     * @param {import('./widget.js').Widget[]} children
     * @param {boolean} horizontal
     * @returns {number}
     */
    _measureLargestChild(children, horizontal) {
        if (!this.el.isConnected || !children.length) {
            return 0;
        }

        const property = horizontal ? 'minWidth' : 'minHeight';

        this._measuring = true;
        try {
            const saved = children.map((x) => x.el.style[property]);
            children.forEach((x) => (x.el.style[property] = ''));

            let largest = 0;
            for (const child of children) {
                const rect = child.el.getBoundingClientRect();
                largest = Math.max(largest, Math.ceil(horizontal ? rect.width : rect.height));
            }

            children.forEach((x, i) => (x.el.style[property] = saved[i]));

            return largest;
        } finally {
            this._measuring = false;
        }
    }
}

defineProperties(ButtonBox, {
    /**
     * How the children are arranged: one of `ButtonBoxStyle`. `edge` (the default, as in the
     * original toolkit) puts the first and last child at the ends with equal space between the
     * children, `spread` also puts space before the first and after the last, and `start`, `end`
     * and `center` pack the children together.
     */
    layoutStyle: {
        value: ButtonBoxStyle.EDGE,
        coerce(layoutStyle) {
            if (!LAYOUT_STYLES.has(layoutStyle)) {
                throw new TypeError(`Invalid button box style: ${layoutStyle}.`);
            }

            return layoutStyle;
        },
        changed() {
            this._queueLayout();
        },
    },

    /**
     * Whether all children get the same size along the box, as in GTK.
     */
    homogeneous: { value: true },

    /**
     * The space between the children, in pixels.
     */
    spacing: { value: 5 },

    /**
     * The minimum width of the children in pixels, as in GTK.
     */
    minChildWidth: {
        value: 85,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The minimum height of the children in pixels.
     */
    minChildHeight: {
        value: 0,
        changed() {
            this._queueLayout();
        },
    },
});

registerType('button-box', ButtonBox);
