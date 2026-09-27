/**
 * @module widgets/scroll-bar
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Adjustment } from '../data/adjustment.js';
import { AbstractSlider } from './abstract-slider.js';
import { attachPressRepeat } from './auto-repeat.js';

/**
 * A scroll bar, which shows and changes the visible part (the page) of something larger.
 *
 * The thumb is as large, relative to the trough, as the page size is relative to the range of the
 * adjustment, but at least `--wy-scroll-bar-min-thumb` long. The thumb is hidden when everything
 * fits in the page. The steppers at both ends step while held, and pressing the trough pages
 * towards the pointer (or moves the thumb there with Shift or the middle button).
 *
 * Scroll bars do not take the keyboard focus by default; set `canFocus` to use the keyboard.
 *
 * Signals: `value-change`.
 */
export class ScrollBar extends AbstractSlider {
    _initialize() {
        super._initialize();

        this._stepperDetaches = [
            [this._backwardEl, false],
            [this._forwardEl, true],
        ].map(([element, forward]) =>
            attachPressRepeat(element, {
                canStart: () => this.isSensitive,
                onStep: () => this.isSensitive && this._step(forward),
            })
        );
    }

    _render() {
        const element = createElement(`
            <div class="wy-scroll-bar" role="scrollbar">
                <span class="wy-scroll-bar-stepper wy-backward" aria-hidden="true"></span>
                <div class="wy-scroll-bar-trough">
                    <div class="wy-scroll-bar-thumb"></div>
                </div>
                <span class="wy-scroll-bar-stepper wy-forward" aria-hidden="true"></span>
            </div>
        `);

        this._backwardEl = element.querySelector('.wy-backward');
        this._forwardEl = element.querySelector('.wy-forward');
        this._troughEl = element.querySelector('.wy-scroll-bar-trough');
        this._thumbEl = element.querySelector('.wy-scroll-bar-thumb');

        return element;
    }

    _createAdjustment() {
        return new Adjustment({
            lower: 0,
            upper: 100,
            stepIncrement: 1,
            pageIncrement: 10,
            pageSize: 10,
        });
    }

    destroy() {
        for (const detach of this._stepperDetaches) {
            detach();
        }

        super.destroy();
    }

    _step(forward) {
        const adjustment = this._adjustment;
        const oldValue = adjustment.value;

        // The steppers step in the direction they point at, also when inverted.
        if (forward !== this._isReversed()) {
            adjustment.increment();
        } else {
            adjustment.decrement();
        }

        return adjustment.value !== oldValue;
    }

    _getWheelStep() {
        const adjustment = this._adjustment;

        // Like GTK, a notch scrolls more on larger pages.
        return adjustment.pageSize > 0 ? adjustment.pageSize ** (2 / 3) : adjustment.stepIncrement;
    }

    _update() {
        super._update();

        const adjustment = this._adjustment;
        const atLower = adjustment.value <= adjustment.lower;
        const atUpper = adjustment.value >= adjustment.maximum;
        const reversed = this._isReversed();

        // Steppers that cannot step look inactive, and the thumb disappears when all fits.
        this._backwardEl.classList.toggle('wy-disabled', reversed ? atUpper : atLower);
        this._forwardEl.classList.toggle('wy-disabled', reversed ? atLower : atUpper);
        this.el.classList.toggle('wy-all-visible', atLower && atUpper);
    }
}

defineProperties(ScrollBar, {
    /**
     * Whether pressing the trough with the primary button moves the thumb there. Off for scroll
     * bars, which page instead.
     */
    primaryButtonWarps: { value: false },

    /**
     * The size of the page, forwarded to the adjustment.
     */
    pageSize: {
        signal: false,
        get() {
            return this._adjustment.pageSize;
        },
        set(pageSize) {
            this._adjustment.pageSize = pageSize;

            return false;
        },
    },
});

registerType('scroll-bar', ScrollBar);
