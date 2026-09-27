/**
 * @module sprites/label
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Sprite } from './sprite.js';

/**
 * Where a label is anchored horizontally, relative to its position.
 *
 * @enum {number}
 */
export const LabelAnchor = Object.freeze({
    START: 0,
    MIDDLE: 1,
    END: 2,
});

/**
 * The SVG `text-anchor` values of anchors.
 *
 * @type {Readonly<Record<number, string>>}
 */
const TEXT_ANCHORS = Object.freeze({
    [LabelAnchor.START]: 'start',
    [LabelAnchor.MIDDLE]: 'middle',
    [LabelAnchor.END]: 'end',
});

/**
 * The SVG `dominant-baseline` values labels accept for `baseline`.
 *
 * @type {ReadonlyArray<string>}
 */
const BASELINES = Object.freeze([
    'auto',
    'middle',
    'central',
    'hanging',
    'text-top',
    'text-bottom',
]);

/**
 * A text label. The position is the anchor point on the baseline. Labels are filled with the
 * text color of the theme and have no stroke by default; the font comes from the canvas styles
 * unless `font` is set.
 *
 * @example
 * new LabelSprite({ text: '55', position: { x: 4, y: 20 }, anchor: LabelAnchor.START });
 */
export class LabelSprite extends Sprite {
    _render() {
        return this._createShape('text', { class: 'wy-sprite-label' });
    }

    _applyShape() {
        // Keep the title element, which is the first child when set.
        const textNode = [...this.el.childNodes].find((x) => x.nodeType === Node.TEXT_NODE);
        if (textNode) {
            textNode.data = this._text;
        } else {
            this.el.append(this._text);
        }

        this.el.setAttribute('text-anchor', TEXT_ANCHORS[this._anchor]);
        this.el.setAttribute('dominant-baseline', this._baseline);
        this.el.style.font = this._font;
    }
}

defineProperties(LabelSprite, {
    fill: { value: 'currentColor' },

    strokeWidth: { value: 0 },

    /**
     * The text.
     */
    text: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text);
        },
        changed() {
            this._applyShape();
        },
    },

    /**
     * The horizontal anchor: one of {@link LabelAnchor}.
     */
    anchor: {
        value: LabelAnchor.MIDDLE,
        coerce(anchor) {
            if (!(anchor in TEXT_ANCHORS)) {
                throw new RangeError(`Invalid label anchor ${anchor}.`);
            }

            return Number(anchor);
        },
        changed() {
            this._applyShape();
        },
    },

    /**
     * The vertical alignment on the position: an SVG `dominant-baseline` value such as
     * `'auto'` (the alphabetic baseline), `'middle'` or `'hanging'`.
     */
    baseline: {
        value: 'auto',
        coerce(baseline) {
            if (!BASELINES.includes(baseline)) {
                throw new RangeError(`Invalid baseline '${baseline}'.`);
            }

            return baseline;
        },
        changed() {
            this._applyShape();
        },
    },

    /**
     * A CSS font, e.g. `'bold 12px sans-serif'`, or `''` for the canvas font.
     */
    font: {
        value: '',
        changed() {
            this._applyShape();
        },
    },
});

registerType('label-sprite', LabelSprite);
