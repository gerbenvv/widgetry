/**
 * @module widgets/abstract-slider
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { clamp } from '../core/util.js';
import { Adjustment } from '../data/adjustment.js';
import { Key } from '../events/constants.js';
import { startAutoRepeat } from './auto-repeat.js';
import { Widget } from './widget.js';

/**
 * Converts a wheel event to notches: about 1 per click of a mouse wheel.
 *
 * @param {WheelEvent} event
 * @returns {number} Positive when scrolling down or right.
 */
export function getWheelNotches(event) {
    const delta = event.deltaY || event.deltaX;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return delta / 3;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return delta * 10;
    }

    return delta / 100;
}

/**
 * Base class of widgets that show and change the value of an `Adjustment` along a trough: sliders
 * and scroll bars.
 *
 * The thumb is placed with CSS: the root element gets the custom properties `--wy-fraction` (the
 * position of the thumb from 0 at the start of the trough to 1 at its end, after inversion) and
 * `--wy-page-fraction` (the page size relative to the range), so no layout has to be measured
 * until the user drags.
 *
 * Pointer: dragging the thumb changes the value; pressing the trough either moves the thumb there
 * (`primaryButtonWarps`) or pages towards the pointer, repeating while held. Shift inverts that,
 * and the middle button always moves the thumb there. The wheel steps the value.
 *
 * Subclasses render `_troughEl` and `_thumbEl` in `_render()`.
 *
 * Signals: `value-change`, `lower-change`, `upper-change` (forwarded from the adjustment).
 */
export class AbstractSlider extends Widget {
    _initialize() {
        super._initialize();

        this._adjustmentDisconnects = [];
        this._drag = null;
        this._paging = null;
        this._stopPaging = null;

        this._troughEl.addEventListener('pointerdown', (event) => this._onTroughPointerDown(event));
        this._troughEl.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this._troughEl.addEventListener('pointerup', (event) => this._onPointerUp(event));
        this._troughEl.addEventListener('pointercancel', (event) => this._onPointerUp(event));
        this._troughEl.addEventListener('lostpointercapture', (event) => this._onPointerUp(event));

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this.el.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });

        this.adjustment = this._createAdjustment();

        this._updateOrientation();
    }

    /**
     * Creates the default adjustment. Subclasses override this for other defaults.
     *
     * @protected
     * @returns {Adjustment}
     */
    _createAdjustment() {
        return new Adjustment({ lower: 0, upper: 100, stepIncrement: 1, pageIncrement: 10 });
    }

    /**
     * Sets several properties, applying the bounds before the value so that it is not clamped to
     * the old bounds.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        const { value, ...rest } = properties;

        let changed = super.set(rest);
        if (value !== undefined && this.setProperty('value', value)) {
            changed = true;
        }

        return changed;
    }

    destroy() {
        this._stopPaging?.();
        this._connectAdjustment(null);

        super.destroy();
    }

    /**
     * The fraction of the thumb position along the trough, from 0 at the start (the left or top)
     * to 1 at the end, taking `inverted` into account.
     *
     * @protected
     * @returns {number}
     */
    _getDisplayFraction() {
        const fraction = this._adjustment.fraction;

        return this._isReversed() ? 1 - fraction : fraction;
    }

    /**
     * Sets the value from a thumb position fraction along the trough.
     *
     * @protected
     * @param {number} fraction
     */
    _setDisplayFraction(fraction) {
        fraction = clamp(fraction, 0, 1);

        const adjustment = this._adjustment;
        const value = this._isReversed() ? 1 - fraction : fraction;

        this._setValueFromUser(adjustment.lower + value * (adjustment.maximum - adjustment.lower));
    }

    /**
     * Whether the value increases towards the start of the trough: when `inverted`, or (in
     * right-to-left text) for horizontal widgets that are not inverted.
     *
     * @protected
     * @returns {boolean}
     */
    _isReversed() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;
        const rtl =
            horizontal && this.el.isConnected && getComputedStyle(this.el).direction === 'rtl';

        return this._inverted !== rtl;
    }

    /**
     * Sets the value because the user changed it. Subclasses may round it.
     *
     * @protected
     * @param {number} value
     */
    _setValueFromUser(value) {
        this._adjustment.value = value;
    }

    /**
     * Updates the element after the adjustment or the orientation changed. Subclasses extend this.
     *
     * @protected
     */
    _update() {
        const adjustment = this._adjustment;
        const range = adjustment.upper - adjustment.lower;
        const pageFraction = range > 0 ? clamp(adjustment.pageSize / range, 0, 1) : 1;

        this.el.classList.toggle('wy-reversed', this._isReversed());
        this.el.style.setProperty('--wy-fraction', String(this._getDisplayFraction()));
        this.el.style.setProperty('--wy-value-fraction', String(adjustment.fraction));
        this.el.style.setProperty('--wy-page-fraction', String(pageFraction));

        this.el.setAttribute('aria-valuenow', String(adjustment.value));
        this.el.setAttribute('aria-valuemin', String(adjustment.lower));
        this.el.setAttribute('aria-valuemax', String(adjustment.maximum));
    }

    _updateOrientation() {
        const horizontal = this._orientation === Orientation.HORIZONTAL;

        this.el.classList.toggle('wy-horizontal', horizontal);
        this.el.classList.toggle('wy-vertical', !horizontal);
        this.el.setAttribute('aria-orientation', this._orientation);

        this._update();
    }

    _connectAdjustment(adjustment) {
        for (const disconnect of this._adjustmentDisconnects) {
            disconnect();
        }

        this._adjustmentDisconnects = [];

        if (!adjustment) {
            return;
        }

        this._adjustmentDisconnects = [
            adjustment.connect('value-change', () => this.emit('value-change', this)),
            adjustment.connect('lower-change', () => this.emit('lower-change', this)),
            adjustment.connect('upper-change', () => this.emit('upper-change', this)),
            adjustment.connect('change', () => this._update()),
        ];
    }

    /**
     * Returns the pointer position along the trough, and the trough and thumb geometry.
     *
     * @protected
     * @param {PointerEvent} event
     * @returns {{position: number, start: number, length: number, thumbStart: number,
     *     thumbLength: number}}
     */
    _measure(event) {
        const horizontal = this._orientation === Orientation.HORIZONTAL;
        const trough = this._troughEl.getBoundingClientRect();
        const thumb = this._thumbEl.getBoundingClientRect();

        return horizontal
            ? {
                  position: event.clientX,
                  start: trough.left + this._troughEl.clientLeft,
                  length: this._troughEl.clientWidth,
                  thumbStart: thumb.left,
                  thumbLength: thumb.width,
              }
            : {
                  position: event.clientY,
                  start: trough.top + this._troughEl.clientTop,
                  length: this._troughEl.clientHeight,
                  thumbStart: thumb.top,
                  thumbLength: thumb.height,
              };
    }

    _startDrag(event, geometry, grabOffset) {
        this._drag = {
            pointerId: event.pointerId,
            grabOffset,
            start: geometry.start,
            range: Math.max(1, geometry.length - geometry.thumbLength),
        };

        try {
            this._troughEl.setPointerCapture(event.pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        this._thumbEl.classList.add('wy-pressed');
        this.el.classList.add('wy-dragging');
    }

    _startPaging(event, geometry) {
        const pointerId = event.pointerId;
        let position = geometry.position;

        this._paging = { pointerId, update: (x) => (position = x) };

        try {
            this._troughEl.setPointerCapture(pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        // Page towards the pointer until the thumb reaches it.
        this._stopPaging = startAutoRepeat(() => {
            const current = this._measure({ clientX: position, clientY: position });
            const before = position < current.thumbStart;
            const after = position >= current.thumbStart + current.thumbLength;

            if (!before && !after) {
                return false;
            }

            const adjustment = this._adjustment;
            const forward = after !== this._isReversed();
            const oldValue = adjustment.value;

            if (forward) {
                adjustment.incrementPage();
            } else {
                adjustment.decrementPage();
            }

            return adjustment.value !== oldValue;
        });
    }

    _onTroughPointerDown(event) {
        if (!this.isSensitive || this._drag || this._paging) {
            return;
        }

        const primary = event.button === 0;
        const middle = event.button === 1;
        if (!primary && !middle) {
            return;
        }

        if (this._canFocus) {
            this.focus();
        }

        event.preventDefault();

        const geometry = this._measure(event);
        const onThumb = this._thumbEl.contains(event.target);

        if (onThumb && primary) {
            this._startDrag(event, geometry, geometry.position - geometry.thumbStart);

            return;
        }

        const warp = middle || this._primaryButtonWarps !== event.shiftKey;

        if (warp) {
            // Center the thumb on the pointer, and keep dragging from there.
            const grabOffset = geometry.thumbLength / 2;
            const range = Math.max(1, geometry.length - geometry.thumbLength);

            this._setDisplayFraction((geometry.position - geometry.start - grabOffset) / range);
            this._startDrag(event, geometry, grabOffset);
        } else {
            this._startPaging(event, geometry);
        }
    }

    _onPointerMove(event) {
        if (this._paging && event.pointerId === this._paging.pointerId) {
            this._paging.update(
                this._orientation === Orientation.HORIZONTAL ? event.clientX : event.clientY
            );

            return;
        }

        const drag = this._drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const position =
            this._orientation === Orientation.HORIZONTAL ? event.clientX : event.clientY;

        this._setDisplayFraction((position - drag.start - drag.grabOffset) / drag.range);
    }

    _onPointerUp(event) {
        if (this._paging && event.pointerId === this._paging.pointerId) {
            this._stopPaging?.();
            this._stopPaging = null;
            this._paging = null;
        }

        if (this._drag && event.pointerId === this._drag.pointerId) {
            this._drag = null;

            this._thumbEl.classList.remove('wy-pressed');
            this.el.classList.remove('wy-dragging');
        }
    }

    /**
     * Returns the value change of one wheel notch.
     *
     * @protected
     * @returns {number}
     */
    _getWheelStep() {
        return this._adjustment.stepIncrement;
    }

    _onWheel(event) {
        if (!this.isSensitive || (!event.deltaY && !event.deltaX)) {
            return;
        }

        event.preventDefault();

        // Scrolling down or right increases the value, unless inverted.
        let notches = getWheelNotches(event);
        if (this._inverted) {
            notches = -notches;
        }

        this._applyWheel(notches);
    }

    /**
     * Changes the value by a number of wheel notches.
     *
     * @protected
     * @param {number} notches
     */
    _applyWheel(notches) {
        const adjustment = this._adjustment;

        this._setValueFromUser(adjustment.value + notches * this._getWheelStep());
    }

    _onKeyDown(event) {
        if (!this.isSensitive || event.altKey || event.metaKey || event.defaultPrevented) {
            return;
        }

        const adjustment = this._adjustment;
        const horizontal = this._orientation === Orientation.HORIZONTAL;
        const page = event.ctrlKey;
        const step = page ? adjustment.pageIncrement : adjustment.stepIncrement;

        // Towards the end of the trough: to the right, or down.
        const towardsEnd = (amount) => (this._isReversed() ? -amount : amount);

        let delta = null;
        switch (event.key) {
            case Key.LEFT:
                delta = horizontal ? towardsEnd(-step) : -step;
                break;

            case Key.RIGHT:
                delta = horizontal ? towardsEnd(step) : step;
                break;

            case Key.UP:
                delta = horizontal ? step : towardsEnd(-step);
                break;

            case Key.DOWN:
                delta = horizontal ? -step : towardsEnd(step);
                break;

            case Key.PAGE_UP:
                delta = horizontal
                    ? adjustment.pageIncrement
                    : towardsEnd(-adjustment.pageIncrement);
                break;

            case Key.PAGE_DOWN:
                delta = horizontal
                    ? -adjustment.pageIncrement
                    : towardsEnd(adjustment.pageIncrement);
                break;

            case '+':
            case '=':
                delta = step;
                break;

            case '-':
                delta = -step;
                break;

            case Key.HOME:
                this._setValueFromUser(adjustment.lower);
                break;

            case Key.END:
                this._setValueFromUser(adjustment.maximum);
                break;

            default:
                return;
        }

        if (delta !== null) {
            this._setValueFromUser(adjustment.value + delta);
        }

        event.preventDefault();
    }
}

function adjustmentProperty(name) {
    return {
        signal: false,
        get() {
            return this._adjustment[name];
        },
        set(value) {
            this._adjustment[name] = value;

            return false;
        },
    };
}

defineProperties(AbstractSlider, {
    /**
     * The `Adjustment` holding the value, its bounds and increments. A default one is created.
     */
    adjustment: {
        value: null,
        coerce(adjustment) {
            if (!(adjustment instanceof Adjustment)) {
                throw new TypeError('The adjustment must be an Adjustment.');
            }

            return adjustment;
        },
        changed(adjustment, old) {
            this._connectAdjustment(adjustment);
            this._update();

            if (old && old.value !== adjustment.value) {
                this.emit('value-change', this);
            }
        },
    },

    /**
     * The value, forwarded to the adjustment.
     */
    value: adjustmentProperty('value'),

    /**
     * The minimum value, forwarded to the adjustment.
     */
    lower: adjustmentProperty('lower'),

    /**
     * The maximum value, forwarded to the adjustment.
     */
    upper: adjustmentProperty('upper'),

    /**
     * The step of the arrow keys and the wheel, forwarded to the adjustment.
     */
    stepIncrement: adjustmentProperty('stepIncrement'),

    /**
     * The step of Page Up and Page Down and of paging, forwarded to the adjustment.
     */
    pageIncrement: adjustmentProperty('pageIncrement'),

    /**
     * The direction of the trough: one of `Orientation`.
     */
    orientation: {
        value: Orientation.HORIZONTAL,
        coerce(orientation) {
            if (!Object.values(Orientation).includes(orientation)) {
                throw new RangeError(`Invalid orientation '${orientation}'.`);
            }

            return orientation;
        },
        changed() {
            this._updateOrientation();
        },
    },

    /**
     * Whether the value increases towards the start (the left or top) instead of the end.
     */
    inverted: {
        value: false,
        coerce: Boolean,
        changed(inverted) {
            this.el.classList.toggle('wy-inverted', inverted);
            this._update();
        },
    },

    /**
     * Whether pressing the trough with the primary button moves the thumb there (otherwise it
     * pages towards the pointer). Shift inverts this.
     */
    primaryButtonWarps: { value: true, coerce: Boolean },
});
