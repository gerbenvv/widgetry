/**
 * @module widgets/box
 */

import { Align, Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Container } from './container.js';
import { marginToCss, SELF_ALIGNMENT } from './widget.js';

/**
 * Lays out its children in a single row or column.
 *
 * Children get their natural size; extra space is shared equally by the children that expand
 * in the box's direction. With `homogeneous`, all children get the same size.
 */
export class Box extends Container {
    _initialize() {
        super._initialize();

        // Apply the initial orientation classes.
        this._queueLayout();
    }

    _render() {
        return createElement('<div class="wy-box"></div>');
    }

    _updateLayout() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;
        const style = this.bodyElement.style;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);
        this.el.classList.toggle('wy-homogeneous', this._homogeneous);

        style.gap = `${this._spacing}px`;

        for (const child of this._children) {
            this._layoutChild(child, horizontal);
        }
    }

    _layoutChild(child, horizontal) {
        const expands = horizontal ? child.isHExpand : child.isVExpand;
        const align = horizontal ? child.hAlign : child.vAlign;
        const margin = child.margin;

        if (this._homogeneous) {
            // The grid places children in equal cells, where both alignments apply.
            child._setLayoutStyle('flex', '');
            child._setLayoutStyle('alignSelf', crossAlignment(child.vAlign));
            child._setLayoutStyle('margin', hasMargin(margin) ? marginToCss(margin) : '');

            return;
        }

        // In a flex row the cross axis is vertical, in a flex column it is horizontal.
        child._setLayoutStyle(
            'alignSelf',
            crossAlignment(horizontal ? child.vAlign : child.hAlign)
        );

        // An expanding child that does not fill is aligned within the extra space by auto
        // margins; it keeps its natural size.
        if (expands && align !== Align.FILL) {
            child._setLayoutStyle('flex', '0 0 auto');
        } else {
            child._setLayoutStyle('flex', expands ? '1 1 auto' : '0 1 auto');
        }

        const sides = [margin.top, margin.right, margin.bottom, margin.left].map((x) => `${x}px`);
        const start = horizontal ? 3 : 0;
        const end = horizontal ? 1 : 2;

        if (expands && (align === Align.CENTER || align === Align.END)) {
            sides[start] = 'auto';
        }

        if (expands && (align === Align.CENTER || align === Align.START)) {
            sides[end] = 'auto';
        }

        const value = sides.join(' ');
        child._setLayoutStyle('margin', value === '0px 0px 0px 0px' ? '' : value);
    }
}

/**
 * Whether a margin has a nonzero side.
 *
 * @param {{top: number, right: number, bottom: number, left: number}} margin
 * @returns {boolean}
 */
function hasMargin(margin) {
    return Boolean(margin.top || margin.right || margin.bottom || margin.left);
}

/**
 * Returns the CSS cross-axis alignment of an `Align` value, or `''` for the default (stretch).
 *
 * @param {string} align
 * @returns {string}
 */
function crossAlignment(align) {
    return align === Align.FILL ? '' : SELF_ALIGNMENT[align];
}

defineProperties(Box, {
    /**
     * The direction children are laid out in: one of `Orientation`.
     */
    orientation: {
        value: Orientation.HORIZONTAL,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * Whether all children get the same size.
     */
    homogeneous: {
        value: false,
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The space between children, in pixels.
     */
    spacing: {
        value: 0,
        changed() {
            this._queueLayout();
        },
    },
});

registerType('box', Box);
