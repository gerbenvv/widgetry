/**
 * @module sprites/path
 */
import { Sprite } from './sprite.js';
/**
 * A path, drawn from SVG path data (`'M 0 0 L 10 10 Z'`). The position translates the path.
 *
 * @example
 * new Path({ path: 'M 0 10 L 10 0 L 20 10', strokeColor: '#5699d8', strokeWidth: 2 });
 */
export declare class Path extends Sprite {
    _render(): SVGGraphicsElement;
    _applyShape(): void;
    _applyPosition(): void;
    _isPositionInTransform(): boolean;
}

/** The declared properties of {@link Path}. */
export interface Path {
    /**
     * The SVG path data.
     */
    path: string;
}
