/**
 * @module widgets/vector-canvas
 */
import { Sprite } from '../sprites/sprite.js';
import { Widget } from './widget.js';
/**
 * A surface for vector graphics: sprites (`Rectangle`, `Circle`, `Path`, `LabelSprite`,
 * `ImageSprite`) drawn as SVG, so they are crisp at any zoom, can be styled with CSS and get
 * pointer events on their painted shape.
 *
 * Sprites are drawn in order (sorted by their `zIndex`), later sprites on top. The `viewBox` sets
 * the coordinate system (by default one unit is one pixel), and the `transformation` pans and
 * zooms all sprites, e.g. with {@link VectorCanvas#zoom} and {@link VectorCanvas#pan}.
 *
 * The canvas has no natural size; give it a `width` and `height`, or let it expand.
 *
 * Signals: `sprite-add` and `sprite-remove` (`canvas, sprite`).
 *
 * @example
 * const canvas = new VectorCanvas({ width: 300, height: 200 });
 * canvas.addSprite(new Circle({ position: { x: 50, y: 50 }, radius: 20, fill: '#5699d8' }));
 */
export declare class VectorCanvas extends Widget {
    /** @type {Sprite[]} */
    _sprites: Sprite[];
    _svgEl: SVGSVGElement;
    _contentEl: SVGGElement;
    transformation: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The SVG element, e.g. to add gradient definitions.
     *
     * @type {SVGSVGElement}
     */
    get svgElement(): SVGSVGElement;
    /**
     * Adds a sprite on top.
     *
     * @param {Sprite} sprite
     * @returns {Sprite} The sprite.
     */
    addSprite(sprite: Sprite): Sprite;
    /**
     * Adds a sprite below the others.
     *
     * @param {Sprite} sprite
     * @returns {Sprite} The sprite.
     */
    prependSprite(sprite: Sprite): Sprite;
    /**
     * Inserts a sprite at an index in the drawing order.
     *
     * @param {Sprite} sprite
     * @param {number} index Between 0 and `spritesCount`.
     * @returns {Sprite} The sprite.
     */
    insertSprite(sprite: Sprite, index: number): Sprite;
    /**
     * Removes a sprite (without destroying it).
     *
     * @param {Sprite} sprite
     * @returns {number} The index the sprite had.
     * @throws {Error} If the sprite is not on this canvas.
     */
    removeSprite(sprite: Sprite): number;
    /**
     * Removes the sprite at an index (without destroying it).
     *
     * @param {number} index
     * @returns {Sprite} The removed sprite.
     */
    removeSpriteByIndex(index: number): Sprite;
    /**
     * Removes and destroys all sprites, like the original toolkit.
     */
    removeAllSprites(): void;
    /**
     * Returns the sprite at an index.
     *
     * @param {number} index
     * @returns {Sprite}
     * @throws {RangeError} If there is no such sprite.
     */
    getSprite(index: number): Sprite;
    /**
     * Returns the index of a sprite, or -1.
     *
     * @param {Sprite} sprite
     * @returns {number}
     */
    indexOfSprite(sprite: Sprite): number;
    /**
     * Moves a sprite to another index in the drawing order.
     *
     * @param {Sprite} sprite
     * @param {number} index
     */
    reorderSprite(sprite: Sprite, index: number): void;
    /**
     * Draws a sprite above the others (with the same `zIndex`).
     *
     * @param {Sprite} sprite
     */
    raiseSprite(sprite: Sprite): void;
    /**
     * Draws a sprite below the others (with the same `zIndex`).
     *
     * @param {Sprite} sprite
     */
    lowerSprite(sprite: Sprite): void;
    /**
     * Returns the topmost visible sprite whose painted shape is at a point, or `null`.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {Sprite | null}
     */
    getSpriteAtPosition(x: number, y: number): Sprite | null;
    /**
     * Converts a page point to canvas coordinates: the units of the view box, before the
     * transformation, which are the coordinates sprites use.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {{x: number, y: number}}
     */
    getCanvasPoint(x: number, y: number): {
        x: number;
        y: number;
    };
    /**
     * Zooms around a point, by changing the transformation.
     *
     * @param {number} factor Greater than 1 to zoom in.
     * @param {{x: number, y: number}} [point] The point that stays in place, in canvas
     *     coordinates after the transformation. Defaults to the origin.
     */
    zoom(factor: number, point?: {
        x: number;
        y: number;
    }): void;
    /**
     * Moves all sprites, by changing the transformation.
     *
     * @param {number} dx
     * @param {number} dy
     */
    pan(dx: number, dy: number): void;
    destroy(): void;
    _onIsVisibleChange(isVisible: any): void;
    /**
     * Puts the sprite elements in drawing order: by `zIndex`, then in sprite order.
     *
     * @protected
     */
    protected _updateOrder(): void;
}
export declare namespace VectorCanvas {
    var builderProperties: {
        sprites(builder: any, canvas: any, sprites: any): void;
    };
}

/** The declared properties of {@link VectorCanvas}. */
export interface VectorCanvas {
    /**
     * The sprites, in order. Do not modify the array.
     */
    readonly sprites: any;
    /**
     * The number of sprites.
     */
    readonly spritesCount: any;
    /**
     * The coordinate system, as `{x, y, width, height}` (or the SVG text `'0 0 100 100'`), or
     * `null` for pixels.
     */
    viewBox: any;
    /**
     * How the view box fits the canvas: an SVG `preserveAspectRatio` value.
     */
    preserveAspectRatio: string;
    /**
     * A description of the drawing, for assistive technologies, or `''` if it is decorative.
     */
    label: string;
}
