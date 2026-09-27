/**
 * @module widgets/spacer
 */

import { Orientation } from '../core/enums.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Widget } from './widget.js';

/**
 * An empty widget that takes up extra space, e.g. to push the widgets after it in a box to the
 * end.
 *
 * A spacer has no size of its own. Unless `hExpand` or `vExpand` is set, it expands in the
 * direction of the box it is in (in both directions in other containers), so it does not make
 * the box expand the other way.
 */
export class Spacer extends Widget {
    _initialize() {
        super._initialize();

        this._disconnectParent = null;

        this.connect('parent-change', this._onParentChange, this);
        this._refreshExpand();
    }

    _render() {
        return createElement('<div class="wy-spacer" aria-hidden="true"></div>');
    }

    destroy() {
        this._disconnectParent?.();
        this._disconnectParent = null;

        super.destroy();
    }

    _computeExpand(direction) {
        const orientation = this.parent?.hasProperty?.('orientation')
            ? this.parent.orientation
            : null;

        if (orientation === Orientation.HORIZONTAL) {
            return direction === 'h';
        }

        if (orientation === Orientation.VERTICAL) {
            return direction === 'v';
        }

        return true;
    }

    _onParentChange() {
        this._disconnectParent?.();
        this._disconnectParent = null;

        // Follow the orientation of the box.
        if (this.parent?.hasProperty?.('orientation')) {
            this._disconnectParent = this.parent.connect('orientation-change', () =>
                this._refreshExpand()
            );
        }

        this._refreshExpand();
    }
}

registerType('spacer', Spacer);
