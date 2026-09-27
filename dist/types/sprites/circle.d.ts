/**
 * @module sprites/circle
 */
import { Sprite } from './sprite.js';
/**
 * A circle. The position is its center.
 *
 * @example
 * new CircleSprite({ position: { x: 50, y: 50 }, radius: 10, fill: '#5699d8' });
 */
export declare class CircleSprite extends Sprite {
    _render(): SVGGraphicsElement;
    _applyShape(): void;
    _applyPosition(): void;
}

/** The declared properties of {@link CircleSprite}. */
export interface CircleSprite {
    /**
     * The radius.
     */
    radius: number;
}
