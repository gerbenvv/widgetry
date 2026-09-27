/**
 * @module core/cursor
 */

import { CursorShape } from './enums.js';
import { Instance, lazySingleton } from './instance.js';

/**
 * CSS cursor values of `CursorShape` values.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CSS_CURSORS = Object.freeze({
    [CursorShape.ARROW]: 'default',
    [CursorShape.MOVE]: 'move',
    [CursorShape.CROSSHAIR]: 'crosshair',
    [CursorShape.WAIT]: 'wait',
    [CursorShape.BUSY]: 'progress',
    [CursorShape.TEXT]: 'text',
    [CursorShape.HELP]: 'help',
    [CursorShape.POINTING_HAND]: 'pointer',
    [CursorShape.OPEN_HAND]: 'grab',
    [CursorShape.CLOSED_HAND]: 'grabbing',
    [CursorShape.NO_DROP]: 'no-drop',
    [CursorShape.COPY]: 'copy',
    [CursorShape.ALIAS]: 'alias',
    [CursorShape.RESIZE_N]: 'n-resize',
    [CursorShape.RESIZE_NE]: 'ne-resize',
    [CursorShape.RESIZE_E]: 'e-resize',
    [CursorShape.RESIZE_SE]: 'se-resize',
    [CursorShape.RESIZE_S]: 's-resize',
    [CursorShape.RESIZE_SW]: 'sw-resize',
    [CursorShape.RESIZE_W]: 'w-resize',
    [CursorShape.RESIZE_NW]: 'nw-resize',
    [CursorShape.RESIZE_H]: 'ew-resize',
    [CursorShape.RESIZE_V]: 'ns-resize',
});

/**
 * Overrides the pointer cursor of the whole page, e.g. while dragging or resizing. Shapes are
 * kept on a stack per context, so nested operations restore the previous shape.
 */
export class Cursor extends Instance {
    _initialize() {
        super._initialize();

        /** @type {{shape: string, context: string}[]} */
        this._stack = [];
    }

    /**
     * Pushes a cursor shape.
     *
     * @param {string} shape One of `CursorShape`.
     * @param {string} [context] Identifies the pusher, so it can pop its own shapes.
     */
    pushShape(shape, context = 'default') {
        this._stack.push({ shape, context });
        this._apply();
    }

    /**
     * Pops the most recent shape pushed with the given context.
     *
     * @param {string} [context]
     */
    popShape(context = 'default') {
        for (let i = this._stack.length - 1; i >= 0; --i) {
            if (this._stack[i].context === context) {
                this._stack.splice(i, 1);
                break;
            }
        }

        this._apply();
    }

    /**
     * The shape currently shown, or `null` when the page's own cursors apply.
     *
     * @type {string | null}
     */
    get shape() {
        return this._stack.length ? this._stack[this._stack.length - 1].shape : null;
    }

    _apply() {
        const root = document.documentElement;
        const shape = this.shape;

        if (shape) {
            root.style.setProperty('--wy-cursor-override', CSS_CURSORS[shape] || 'default');
            root.classList.add('wy-cursor-override');
        } else {
            root.style.removeProperty('--wy-cursor-override');
            root.classList.remove('wy-cursor-override');
        }
    }
}

/**
 * Returns the cursor singleton.
 *
 * @type {() => Cursor}
 */
export const getCursor = lazySingleton(() => new Cursor());
