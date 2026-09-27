/**
 * @module sprites/label
 */
import { Sprite } from './sprite.js';
/**
 * Where a label is anchored horizontally, relative to its position. The values are those of the
 * SVG `text-anchor` attribute.
 *
 * @enum {string}
 */
export declare const LabelAnchor: Readonly<{
    START: "start";
    MIDDLE: "middle";
    END: "end";
}>;
/**
 * A text label. The position is the anchor point on the baseline. Labels are filled with the
 * text color of the theme and have no stroke by default; the font comes from the canvas styles
 * unless `font` is set.
 *
 * @example
 * new LabelSprite({ text: '55', position: { x: 4, y: 20 }, anchor: LabelAnchor.START });
 */
export declare class LabelSprite extends Sprite {
    _render(): SVGGraphicsElement;
    _applyShape(): void;
}

/** The declared properties of {@link LabelSprite}. */
export interface LabelSprite {
    /**
     * The text.
     */
    text: string;
    /**
     * The horizontal anchor: one of {@link LabelAnchor}.
     */
    anchor: string;
    /**
     * The vertical alignment on the position: an SVG `dominant-baseline` value such as
     * `'auto'` (the alphabetic baseline), `'middle'` or `'hanging'`.
     */
    baseline: string;
    /**
     * A CSS font, e.g. `'bold 12px sans-serif'`, or `''` for the canvas font.
     */
    font: string;
}
