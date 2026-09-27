/**
 * @module widgets/bin
 */

import { defineProperties } from '../core/instance.js';
import { Container } from './container.js';

/**
 * A container with at most one child, which fills the body (subject to its alignment).
 */
export class Bin extends Container {
    _initialize() {
        super._initialize();

        this.bodyElement.classList.add('wy-bin-body');
    }

    /**
     * Adds the child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {import('./widget.js').Widget}
     * @throws {Error} If the bin already has a child.
     */
    insertChild(widget, index) {
        if (this._children.length) {
            throw new Error(`${this.constructor.name} already has a child.`);
        }

        return super.insertChild(widget, index);
    }
}

defineProperties(Bin, {
    /**
     * The child, or `null`. Setting it replaces (and destroys) the current child.
     */
    child: {
        get() {
            return this._children[0] || null;
        },
        set(widget) {
            const current = this._children[0] || null;
            if (current === widget) {
                return false;
            }

            if (current) {
                current.destroy();
            }

            if (widget) {
                this.addChild(widget);
            }
        },
    },
});
