/**
 * @module widgets/spacer
 */
import { Widget } from './widget.js';
/**
 * An empty widget that takes up extra space, e.g. to push the widgets after it in a box to the
 * end.
 *
 * A spacer has no size of its own. Unless `hExpand` or `vExpand` is set, it expands in the
 * direction of the box it is in (in both directions in other containers), so it does not make
 * the box expand the other way.
 */
export declare class Spacer extends Widget {
    _disconnectParent: any;
    _initialize(): void;
    _render(): HTMLElement;
    destroy(): void;
    _computeExpand(direction: any): boolean;
    _onParentChange(): void;
}
