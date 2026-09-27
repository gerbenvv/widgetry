/**
 * @module sprites/circle
 */
import { Sprite } from './sprite.js';
/**
 * A circle. The position is its center.
 *
 * @example
 * new Circle({ position: { x: 50, y: 50 }, radius: 10, fill: '#5699d8' });
 */
export declare class Circle extends Sprite {
    _render(): SVGGraphicsElement;
    _applyShape(): void;
    _applyPosition(): void;
}

/** The declared properties of {@link Circle}. */
export interface Circle {
    /**
     * The radius.
     */
    radius: number;
}
