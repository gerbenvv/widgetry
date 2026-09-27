/**
 * @module widgets/vector-canvas
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement } from '../core/util.js';
import { Matrix } from '../data/matrix.js';
import { Sprite, SVG_NAMESPACE } from '../sprites/sprite.js';
import { Widget } from './widget.js';

/**
 * Parses a view box: `null`, an object `{x, y, width, height}` or the SVG text form.
 *
 * @param {unknown} viewBox
 * @returns {{x: number, y: number, width: number, height: number} | null}
 */
function toViewBox(viewBox) {
    if (viewBox === null || viewBox === undefined) {
        return null;
    }

    const values =
        typeof viewBox === 'string'
            ? viewBox
                  .trim()
                  .split(/[\s,]+/)
                  .map(Number)
            : [viewBox.x ?? 0, viewBox.y ?? 0, viewBox.width, viewBox.height].map(Number);

    if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
        throw new TypeError('A view box needs x, y and a positive width and height.');
    }

    const [x, y, width, height] = values;

    return Object.freeze({ x, y, width, height });
}

/**
 * A surface for vector graphics: sprites (`RectangleSprite`, `CircleSprite`, `PathSprite`,
 * `LabelSprite`, `ImageSprite`) drawn as SVG, so they are crisp at any zoom, can be styled with CSS
 * and get pointer events on their painted shape.
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
 * canvas.addSprite(new CircleSprite({ position: { x: 50, y: 50 }, radius: 20, fill: '#5699d8' }));
 */
export class VectorCanvas extends Widget {
    _initialize() {
        /** @type {Sprite[]} */
        this._sprites = [];

        super._initialize();
    }

    _syncAccessibleName() {
        const name = this._accessibleName;

        // The drawing is decorative unless it has a name.
        if (name) {
            this._svgEl.setAttribute('aria-label', name);
            this._svgEl.removeAttribute('aria-hidden');
        } else {
            this._svgEl.removeAttribute('aria-label');
            this._svgEl.setAttribute('aria-hidden', 'true');
        }
    }

    _render() {
        const element = createElement(`
            <div class="wy-vector-canvas">
                <svg class="wy-vector-canvas-surface" xmlns="${SVG_NAMESPACE}" role="img" aria-hidden="true">
                    <g class="wy-vector-canvas-content"></g>
                </svg>
            </div>
        `);

        this._svgEl = element.querySelector('svg');
        this._contentEl = element.querySelector('g');

        return element;
    }

    /**
     * The SVG element, e.g. to add gradient definitions.
     *
     * @type {SVGSVGElement}
     */
    get svgElement() {
        return this._svgEl;
    }

    /**
     * Adds a sprite on top.
     *
     * @param {Sprite} sprite
     * @returns {Sprite} The sprite.
     */
    addSprite(sprite) {
        return this.insertSprite(sprite, this._sprites.length);
    }

    /**
     * Adds a sprite below the others.
     *
     * @param {Sprite} sprite
     * @returns {Sprite} The sprite.
     */
    prependSprite(sprite) {
        return this.insertSprite(sprite, 0);
    }

    /**
     * Inserts a sprite at an index in the drawing order.
     *
     * @param {Sprite} sprite
     * @param {number} index Between 0 and `spritesCount`.
     * @returns {Sprite} The sprite.
     */
    insertSprite(sprite, index) {
        if (!(sprite instanceof Sprite)) {
            throw new TypeError('Only sprites can be added to a vector canvas.');
        }

        if (sprite.parent) {
            throw new Error('The sprite has already been added to a canvas.');
        }

        if (!Number.isInteger(index) || index < 0 || index > this._sprites.length) {
            throw new RangeError(`Invalid sprite index ${index}.`);
        }

        this._sprites.splice(index, 0, sprite);
        sprite._setParent(this);
        this._updateOrder();

        this.emit('sprite-add', this, sprite);

        return sprite;
    }

    /**
     * Removes a sprite (without destroying it).
     *
     * @param {Sprite} sprite
     * @returns {number} The index the sprite had.
     * @throws {Error} If the sprite is not on this canvas.
     */
    removeSprite(sprite) {
        const index = this._sprites.indexOf(sprite);
        if (index < 0) {
            throw new Error('The sprite is not on this canvas.');
        }

        this._sprites.splice(index, 1);
        sprite.el.remove();
        sprite._setParent(null);

        this.emit('sprite-remove', this, sprite);

        return index;
    }

    /**
     * Removes the sprite at an index (without destroying it).
     *
     * @param {number} index
     * @returns {Sprite} The removed sprite.
     */
    removeSpriteByIndex(index) {
        const sprite = this.getSprite(index);
        this.removeSprite(sprite);

        return sprite;
    }

    /**
     * Removes and destroys all sprites, like the original toolkit.
     */
    removeAllSprites() {
        for (const sprite of [...this._sprites].reverse()) {
            sprite.destroy();
        }
    }

    /**
     * Returns the sprite at an index.
     *
     * @param {number} index
     * @returns {Sprite}
     * @throws {RangeError} If there is no such sprite.
     */
    getSprite(index) {
        const sprite = this._sprites[index];
        if (!sprite) {
            throw new RangeError(`There is no sprite at index ${index}.`);
        }

        return sprite;
    }

    /**
     * Returns the index of a sprite, or -1.
     *
     * @param {Sprite} sprite
     * @returns {number}
     */
    indexOfSprite(sprite) {
        return this._sprites.indexOf(sprite);
    }

    /**
     * Moves a sprite to another index in the drawing order.
     *
     * @param {Sprite} sprite
     * @param {number} index
     */
    reorderSprite(sprite, index) {
        const oldIndex = this._sprites.indexOf(sprite);
        if (oldIndex < 0) {
            throw new Error('The sprite is not on this canvas.');
        }

        this._sprites.splice(oldIndex, 1);
        this._sprites.splice(clamp(index, 0, this._sprites.length), 0, sprite);
        this._updateOrder();
    }

    /**
     * Draws a sprite above the others (with the same `zIndex`).
     *
     * @param {Sprite} sprite
     */
    raiseSprite(sprite) {
        this.reorderSprite(sprite, this._sprites.length);
    }

    /**
     * Draws a sprite below the others (with the same `zIndex`).
     *
     * @param {Sprite} sprite
     */
    lowerSprite(sprite) {
        this.reorderSprite(sprite, 0);
    }

    /**
     * Returns the topmost visible sprite whose painted shape is at a point, or `null`.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {Sprite | null}
     */
    getSpriteAtPosition(x, y) {
        const elements = document.elementsFromPoint(x - window.scrollX, y - window.scrollY);

        for (const element of elements) {
            if (!this._contentEl.contains(element)) {
                continue;
            }

            const sprite = Sprite.fromElement(element);
            if (sprite && sprite.parent === this && sprite.isVisible) {
                return sprite;
            }
        }

        return null;
    }

    /**
     * Converts a page point to canvas coordinates: the units of the view box, before the
     * transformation, which are the coordinates sprites use.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {{x: number, y: number}}
     */
    getCanvasPoint(x, y) {
        const matrix = this._contentEl.getScreenCTM();
        if (!matrix) {
            return { x: 0, y: 0 };
        }

        const point = new DOMPoint(x - window.scrollX, y - window.scrollY).matrixTransform(
            matrix.inverse()
        );

        return { x: point.x, y: point.y };
    }

    /**
     * Zooms around a point, by changing the transformation.
     *
     * @param {number} factor Greater than 1 to zoom in.
     * @param {{x: number, y: number}} [point] The point that stays in place, in canvas
     *     coordinates after the transformation. Defaults to the origin.
     */
    zoom(factor, point) {
        if (!Number.isFinite(factor) || factor <= 0) {
            throw new RangeError('A zoom factor must be a positive number.');
        }

        this.transformation = this._transformation.scale(factor, factor, point);
    }

    /**
     * Moves all sprites, by changing the transformation.
     *
     * @param {number} dx
     * @param {number} dy
     */
    pan(dx, dy) {
        this.transformation = this._transformation.translate(dx, dy);
    }

    destroy() {
        for (const sprite of [...this._sprites].reverse()) {
            sprite.destroy();
        }

        super.destroy();
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        for (const sprite of this._sprites) {
            sprite._recalculateVisibility();
        }
    }

    /**
     * Puts the sprite elements in drawing order: by `zIndex`, then in sprite order.
     *
     * @protected
     */
    _updateOrder() {
        const ordered = this._sprites
            .map((sprite, index) => ({ sprite, index }))
            .sort(
                (first, second) =>
                    first.sprite.zIndex - second.sprite.zIndex || first.index - second.index
            );

        // Only move elements that are out of place.
        let previous = null;
        for (const { sprite } of ordered) {
            const expected = previous ? previous.nextSibling : this._contentEl.firstChild;
            if (sprite.el !== expected) {
                this._contentEl.insertBefore(sprite.el, expected);
            }

            previous = sprite.el;
        }
    }
}

defineProperties(VectorCanvas, {
    /**
     * The sprites, in order. Do not modify the array.
     */
    sprites: {
        readOnly: true,
        get() {
            return this._sprites;
        },
    },

    /**
     * The number of sprites.
     */
    spritesCount: {
        readOnly: true,
        get() {
            return this._sprites.length;
        },
    },

    /**
     * The coordinate system, as `{x, y, width, height}` (or the SVG text `'0 0 100 100'`), or
     * `null` for pixels.
     */
    viewBox: {
        value: null,
        coerce: toViewBox,
        changed(viewBox) {
            if (viewBox) {
                this._svgEl.setAttribute(
                    'viewBox',
                    `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
                );
            } else {
                this._svgEl.removeAttribute('viewBox');
            }
        },
    },

    /**
     * How the view box fits the canvas: an SVG `preserveAspectRatio` value.
     */
    preserveAspectRatio: {
        value: 'xMidYMid meet',
        changed(value) {
            this._svgEl.setAttribute('preserveAspectRatio', value);
        },
    },

    /**
     * The transformation of all sprites, a `Matrix`, e.g. for panning and zooming.
     */
    transformation: {
        value: Matrix.identity,
        coerce(matrix) {
            if (!(matrix instanceof Matrix)) {
                throw new TypeError('A transformation must be a Matrix.');
            }

            return matrix;
        },
        changed(matrix) {
            if (matrix.isIdentity) {
                this._contentEl.removeAttribute('transform');
            } else {
                this._contentEl.setAttribute('transform', String(matrix));
            }
        },
    },

    /**
     * A description of the drawing, for assistive technologies, or `''` if it is decorative. The
     * same as `accessibleName`.
     */
    label: {
        signal: false,
        get() {
            return this._accessibleName;
        },
        set(label) {
            this.accessibleName = label;

            return false;
        },
    },
});

VectorCanvas.builderProperties = {
    sprites(builder, canvas, sprites) {
        // The original checked `typeof sprites !== 'array'`, which is always true.
        if (!Array.isArray(sprites)) {
            throw new Error('Vector canvas sprites must be an array.');
        }

        for (const sprite of builder.build(sprites)) {
            canvas.addSprite(sprite);
        }
    },
};

registerType('vector-canvas', VectorCanvas);
