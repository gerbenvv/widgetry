/**
 * @module widgets/separator
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Widget } from './widget.js';

/**
 * A horizontal or vertical line that separates widgets, drawn etched into the background: a
 * dark line with a light line below it (or to its right).
 *
 * A horizontal separator is as wide as its space and `thickness` plus 2 pixels high; a vertical
 * one the other way around.
 */
export class Separator extends Widget {
    _initialize() {
        super._initialize();

        // Apply the defaults.
        this._applyOrientation();
        this._applyThickness();
    }

    _render() {
        return createElement('<div class="wy-separator" role="separator"></div>');
    }

    _applyOrientation() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);
        this.el.setAttribute('aria-orientation', this._orientation);
    }

    _applyThickness() {
        const thickness = this._thickness;

        // The dark half gets the odd pixel, so a 1 pixel separator is a plain dark line.
        this.el.style.setProperty('--wy-separator-thickness', `${thickness}px`);
        this.el.style.setProperty('--wy-separator-dark-size', `${Math.ceil(thickness / 2)}px`);
    }
}

defineProperties(Separator, {
    /**
     * The direction of the line: one of `Orientation`.
     */
    orientation: {
        value: Orientation.HORIZONTAL,
        coerce(orientation) {
            if (!Object.values(Orientation).includes(orientation)) {
                throw new Error(`Invalid orientation '${orientation}'.`);
            }

            return orientation;
        },
        changed() {
            this._applyOrientation();
        },
    },

    /**
     * The thickness of the line in pixels (at least 1). The default of 2 draws a dark and a light
     * line.
     */
    thickness: {
        value: 2,
        coerce(thickness) {
            if (!Number.isInteger(thickness) || thickness < 1) {
                throw new Error(`Invalid separator thickness ${thickness}.`);
            }

            return thickness;
        },
        changed() {
            this._applyThickness();
        },
    },
});

registerType('separator', Separator);
