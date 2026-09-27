/**
 * @module sprites/rectangle
 */
import { Sprite } from './sprite.js';
/**
 * A rectangle, optionally with rounded corners. The position is its top left corner.
 *
 * @example
 * new RectangleSprite({
 *     position: { x: 10, y: 10 },
 *     size: { width: 40, height: 20 },
 *     fill: '#5699d8',
 * });
 */
export declare class RectangleSprite extends Sprite {
    _render(): SVGGraphicsElement;
    _applyShape(): void;
}

/** The declared properties of {@link RectangleSprite}. */
export interface RectangleSprite {
    /**
     * The size, as `{width, height}`.
     */
    size: any;
    /**
     * The width.
     */
    width: any;
    /**
     * The height.
     */
    height: any;
    /**
     * The radius of the corners.
     */
    cornerRadius: number;
}
