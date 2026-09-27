/**
 * @module widgets/scroll-area
 */

import { Policy, ShadowType } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Adjustment } from '../data/adjustment.js';
import { Bin } from './bin.js';

/**
 * The step increment of the adjustments, in pixels, as in the original toolkit.
 *
 * @type {number}
 */
const STEP_INCREMENT = 10;

/**
 * The page increment of the adjustments, as a fraction of the page size.
 *
 * @type {number}
 */
const PAGE_INCREMENT_FRACTION = 0.9;

/**
 * The CSS overflow values of the scroll bar policies.
 *
 * @type {Readonly<Record<string, string>>}
 */
const OVERFLOW = Object.freeze({
    [Policy.ALWAYS]: 'scroll',
    [Policy.AUTOMATIC]: 'auto',
    [Policy.NEVER]: 'hidden',
});

/**
 * The shadow types a scroll area supports, for validating `shadowType`.
 *
 * @type {ReadonlySet<string>}
 */
const SHADOW_TYPES = new Set(Object.values(ShadowType));

function checkPolicy(policy) {
    if (!Object.hasOwn(OVERFLOW, policy)) {
        throw new TypeError(`Invalid scroll bar policy: ${policy}.`);
    }

    return policy;
}

function checkAdjustment(adjustment) {
    if (!(adjustment instanceof Adjustment)) {
        throw new TypeError('A scroll area adjustment must be an Adjustment.');
    }

    return adjustment;
}

function checkSize(size) {
    const value = Number(size);
    if (!Number.isFinite(value)) {
        throw new TypeError(`Invalid size: ${size}.`);
    }

    return Math.max(-1, Math.round(value));
}

/**
 * A scrolled view onto its child, with Clearlooks-styled scroll bars.
 *
 * The child gets at least its natural size, and fills the view when that is larger; with the
 * `never` policy in a direction, the child fits the view in that direction instead, and the
 * scroll area is as large as the child in that direction. Scrolling is native (wheel, touch,
 * keyboard), and is reflected in the adjustments `hAdjustment` and `vAdjustment`: their value is
 * the scroll offset, `upper` the size of the content and `pageSize` the size of the view.
 * Changing an adjustment's value scrolls the view.
 *
 * Like in GTK, the size of a scroll area does not depend on its content: its minimum and natural
 * size is `minContentWidth` by `minContentHeight` (by default nothing but the border), so it can
 * shrink in any container while its content keeps its size. Scroll areas expand in both
 * directions by default. Set `propagateNaturalWidth` or `propagateNaturalHeight` to make the
 * natural size that of the content.
 */
export class ScrollArea extends Bin {
    _initialize() {
        super._initialize();

        this._syncing = false;
        this._observedChild = null;
        this._adjustmentHandlers = new Map();

        this._hAdjustment = null;
        this._vAdjustment = null;
        this.hAdjustment = new Adjustment({ stepIncrement: STEP_INCREMENT });
        this.vAdjustment = new Adjustment({ stepIncrement: STEP_INCREMENT });

        this.el.addEventListener('scroll', () => this._syncAdjustments(), { passive: true });

        this._contentObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            this._contentObserver = new ResizeObserver(() => {
                if (!this.destroyed) {
                    this._syncNaturalSize();
                    this._syncAdjustments();
                }
            });

            this._contentObserver.observe(this.el);
        }

        // Watches the content for changes of its natural size, while that size is needed.
        this._mutationObserver = null;
        this._measureQueued = false;

        this._syncPolicies();
    }

    _render() {
        return createElement('<div class="wy-scroll-area wy-shadow-in"></div>');
    }

    /**
     * Scrolls as little as possible to show a descendant, as far as it fits.
     *
     * @param {import('./widget.js').Widget} widget A descendant.
     * @throws {Error} If the widget is not a descendant.
     */
    scrollToWidget(widget) {
        if (widget === this || !this.isAncestorOf(widget)) {
            throw new Error('The widget is not in this scroll area.');
        }

        this._syncAdjustments();

        const rect = widget.el.getBoundingClientRect();
        const own = this.el.getBoundingClientRect();

        const x = rect.left - own.left - this.el.clientLeft + this.el.scrollLeft;
        const y = rect.top - own.top - this.el.clientTop + this.el.scrollTop;

        this._hAdjustment.clampPage(x, x + rect.width);
        this._vAdjustment.clampPage(y, y + rect.height);
    }

    /**
     * Scrolls to a position of the content.
     *
     * @param {number} x
     * @param {number} y
     */
    scrollTo(x, y) {
        this._syncAdjustments();

        this._hAdjustment.value = x;
        this._vAdjustment.value = y;
    }

    destroy() {
        this._contentObserver?.disconnect();
        this._mutationObserver?.disconnect();

        for (const disconnect of this._adjustmentHandlers.values()) {
            disconnect();
        }

        this._adjustmentHandlers.clear();

        super.destroy();
    }

    _onChildrenChange() {
        super._onChildrenChange();

        const child = this._children[0] || null;
        if (child !== this._observedChild) {
            if (this._observedChild) {
                this._contentObserver?.unobserve(this._observedChild.el);
            }

            this._observedChild = child;

            if (child) {
                this._contentObserver?.observe(child.el);
            }
        }

        this._syncNaturalSize();
        this._syncAdjustments();
    }

    _onChildLayoutChange(widget) {
        super._onChildLayoutChange(widget);

        this._queueNaturalSize();
    }

    _setAdjustment(name, adjustment) {
        const field = `_${name}`;
        const old = this[field];
        if (old === adjustment) {
            return false;
        }

        this._adjustmentHandlers.get(name)?.();

        this[field] = adjustment;

        const horizontal = name === 'hAdjustment';
        this._adjustmentHandlers.set(
            name,
            adjustment.connect('value-change', () => this._onAdjustmentValueChange(horizontal))
        );

        this._syncAdjustments();

        return true;
    }

    _onAdjustmentValueChange(horizontal) {
        if (this._syncing) {
            return;
        }

        if (horizontal) {
            this.el.scrollLeft = this._hAdjustment.value;
        } else {
            this.el.scrollTop = this._vAdjustment.value;
        }
    }

    _syncAdjustments() {
        if (this._syncing || !this._hAdjustment || !this._vAdjustment) {
            return;
        }

        const element = this.el;

        this._syncing = true;
        try {
            this._hAdjustment.set({
                lower: 0,
                upper: element.scrollWidth,
                pageSize: element.clientWidth,
                pageIncrement: Math.max(
                    STEP_INCREMENT,
                    Math.round(element.clientWidth * PAGE_INCREMENT_FRACTION)
                ),
                value: element.scrollLeft,
            });

            this._vAdjustment.set({
                lower: 0,
                upper: element.scrollHeight,
                pageSize: element.clientHeight,
                pageIncrement: Math.max(
                    STEP_INCREMENT,
                    Math.round(element.clientHeight * PAGE_INCREMENT_FRACTION)
                ),
                value: element.scrollTop,
            });
        } finally {
            this._syncing = false;
        }
    }

    _syncPolicies() {
        const style = this.el.style;

        style.overflowX = OVERFLOW[this._hPolicy];
        style.overflowY = OVERFLOW[this._vPolicy];

        this.el.classList.toggle('wy-h-never', this._hPolicy === Policy.NEVER);
        this.el.classList.toggle('wy-v-never', this._vPolicy === Policy.NEVER);

        this._syncNaturalSize();
        this._syncAdjustments();
    }

    /**
     * Whether the natural size of the content must be measured: in directions that do not
     * scroll or that propagate it. (A direction that does not scroll while the other does is
     * measured; when only the vertical direction does not scroll, the height follows the content
     * by itself.)
     *
     * @returns {{width: boolean, height: boolean}}
     */
    _getMeasuredDirections() {
        const hNever = this._hPolicy === Policy.NEVER;
        const vNever = this._vPolicy === Policy.NEVER;

        return {
            width: !(hNever && vNever) && (hNever || this._propagateNaturalWidth),
            height: !vNever && this._propagateNaturalHeight,
        };
    }

    _queueNaturalSize() {
        if (this._measureQueued) {
            return;
        }

        this._measureQueued = true;
        queueMicrotask(() => {
            this._measureQueued = false;

            if (!this.destroyed) {
                this._syncNaturalSize();
            }
        });
    }

    /**
     * Updates the natural size of the scroll area. Scroll areas are size-contained, so their
     * content does not affect their size: their natural size is `minContentWidth` by
     * `minContentHeight`, unless it is measured from the content (see
     * `_getMeasuredDirections()`).
     */
    _syncNaturalSize() {
        const measured = this._getMeasuredDirections();
        const style = this.el.style;

        this._syncMutationObserver(measured.width || measured.height);

        const child = this._children[0];
        if (!child || !child.visible || !this.el.isConnected) {
            style.removeProperty('--wy-scroll-area-natural-width');
            style.removeProperty('--wy-scroll-area-natural-height');

            return;
        }

        const size = measured.width || measured.height ? this._measureChild(child) : null;

        if (measured.width) {
            style.setProperty('--wy-scroll-area-natural-width', `${size.width}px`);
        } else {
            style.removeProperty('--wy-scroll-area-natural-width');
        }

        if (measured.height) {
            style.setProperty('--wy-scroll-area-natural-height', `${size.height}px`);
        } else {
            style.removeProperty('--wy-scroll-area-natural-height');
        }

        // Ignore the style changes of measuring.
        this._mutationObserver?.takeRecords();
    }

    /**
     * Measures the natural size of the child, including its margins and room for the scroll
     * bar across it.
     *
     * @param {import('./widget.js').Widget} child
     * @returns {{width: number, height: number}}
     */
    _measureChild(child) {
        const style = child.el.style;
        const saved = [style.width, style.height, style.justifySelf, style.alignSelf];
        const margin = child.margin;
        const element = this.el;

        const verticalBar = element.offsetWidth - element.clientWidth - element.clientLeft * 2;
        const horizontalBar = element.offsetHeight - element.clientHeight - element.clientTop * 2;

        style.justifySelf = style.alignSelf = 'start';
        style.width = 'max-content';
        style.height = 'max-content';

        const width = child.el.getBoundingClientRect().width;

        // Content that fits the view in width has its height at that width.
        if (this._hPolicy === Policy.NEVER) {
            style.width = `${element.clientWidth - margin.left - margin.right}px`;
        }

        const height = child.el.getBoundingClientRect().height;

        [style.width, style.height, style.justifySelf, style.alignSelf] = saved;

        return {
            width: Math.ceil(width + margin.left + margin.right + Math.max(0, verticalBar)),
            height: Math.ceil(height + margin.top + margin.bottom + Math.max(0, horizontalBar)),
        };
    }

    _syncMutationObserver(wanted) {
        if (wanted && !this._mutationObserver && typeof MutationObserver !== 'undefined') {
            this._mutationObserver = new MutationObserver(() => this._queueNaturalSize());
            this._mutationObserver.observe(this.el, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class', 'hidden', 'style'],
            });
        } else if (!wanted && this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }
    }

    _syncMinimumSize() {
        const style = this.el.style;

        if (this._minContentWidth >= 0) {
            style.setProperty('--wy-scroll-area-min-width', `${this._minContentWidth}px`);
        } else {
            style.removeProperty('--wy-scroll-area-min-width');
        }

        if (this._minContentHeight >= 0) {
            style.setProperty('--wy-scroll-area-min-height', `${this._minContentHeight}px`);
        } else {
            style.removeProperty('--wy-scroll-area-min-height');
        }
    }
}

defineProperties(ScrollArea, {
    hExpand: { value: true },
    vExpand: { value: true },

    /**
     * The horizontal `Adjustment`: its value is the horizontal scroll offset. Only change its
     * value; the scroll area sets its bounds and page size.
     */
    hAdjustment: {
        value: null,
        coerce: checkAdjustment,
        set(adjustment) {
            return this._setAdjustment('hAdjustment', adjustment);
        },
    },

    /**
     * The vertical `Adjustment`: its value is the vertical scroll offset. Only change its
     * value; the scroll area sets its bounds and page size.
     */
    vAdjustment: {
        value: null,
        coerce: checkAdjustment,
        set(adjustment) {
            return this._setAdjustment('vAdjustment', adjustment);
        },
    },

    /**
     * When the horizontal scroll bar is shown: one of `Policy`. With `never`, the content fits
     * the width of the view.
     */
    hPolicy: {
        value: Policy.AUTOMATIC,
        coerce: checkPolicy,
        changed() {
            this._syncPolicies();
        },
    },

    /**
     * When the vertical scroll bar is shown: one of `Policy`. With `never`, the content fits the
     * height of the view.
     */
    vPolicy: {
        value: Policy.AUTOMATIC,
        coerce: checkPolicy,
        changed() {
            this._syncPolicies();
        },
    },

    /**
     * The border around the view: one of `ShadowType`.
     */
    shadowType: {
        value: ShadowType.IN,
        coerce(shadowType) {
            if (!SHADOW_TYPES.has(shadowType)) {
                throw new TypeError(`Invalid shadow type: ${shadowType}.`);
            }

            return shadowType;
        },
        changed(shadowType, oldShadowType) {
            this.el.classList.remove(`wy-shadow-${oldShadowType}`);
            this.el.classList.add(`wy-shadow-${shadowType}`);
        },
    },

    /**
     * Whether the natural width of the scroll area is that of its content, instead of
     * `minContentWidth`. In some containers the natural size is also the minimum size.
     */
    propagateNaturalWidth: {
        value: false,
        changed() {
            this._syncNaturalSize();
        },
    },

    /**
     * Whether the natural height of the scroll area is that of its content, instead of
     * `minContentHeight`. In some containers the natural size is also the minimum size.
     */
    propagateNaturalHeight: {
        value: false,
        changed() {
            this._syncNaturalSize();
        },
    },

    /**
     * The minimum width of the view in pixels, or -1 for none.
     */
    minContentWidth: {
        value: -1,
        coerce: checkSize,
        changed() {
            this._syncMinimumSize();
        },
    },

    /**
     * The minimum height of the view in pixels, or -1 for none.
     */
    minContentHeight: {
        value: -1,
        coerce: checkSize,
        changed() {
            this._syncMinimumSize();
        },
    },
});

registerType('scroll-area', ScrollArea);
