/**
 * @module widgets/switch
 */

import { Align } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { clamp, createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Widget } from './widget.js';

/**
 * An on/off switch, like GTK 3's: a sunken trough with a raised slider that sits at the left when
 * off and at the right when on, where the trough is filled with the accent color. The uncovered
 * half shows a symbol for the state.
 *
 * Clicking the switch toggles it, and so does dragging the slider past the middle. Space and
 * Enter toggle it while it has the focus, and so does its mnemonic (as the `mnemonicWidget` of a
 * label).
 *
 * When the user toggles the switch, `state-set` (`switch, state`) is emitted with the new state
 * before `active` changes. A handler that returns `true` vetoes the change, as in GTK: `active`
 * keeps its value, and the handler may set it later itself, for example once a slow operation
 * finished. Setting `active` from code does not emit `state-set`.
 *
 * Signals: `state-set` (`switch, state`), `activate` (`switch`) when the user toggled it, and
 * `active-change`.
 *
 * @example
 * const wifi = new Switch({ active: true });
 * wifi.connect('state-set', (_switch, state) => {
 *     enableWifi(state);
 * });
 */
export class Switch extends Widget {
    _initialize() {
        super._initialize();

        this._drag = null;

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this.el.addEventListener('pointerup', (event) => this._onPointerUp(event, true));
        this.el.addEventListener('pointercancel', (event) => this._onPointerUp(event, false));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._updateState();
    }

    _render() {
        const element = createElement(`
            <div class="wy-switch" role="switch" aria-checked="false">
                <span class="wy-switch-trough" aria-hidden="true">
                    <span class="wy-switch-on-symbol"></span>
                    <span class="wy-switch-off-symbol"></span>
                </span>
                <span class="wy-switch-slider" aria-hidden="true"></span>
            </div>
        `);

        this._sliderEl = element.querySelector('.wy-switch-slider');

        return element;
    }

    /**
     * Toggles the switch as if the user clicked it: emits `state-set`, and changes `active` unless
     * a handler vetoed it.
     *
     * @returns {boolean} Whether `active` changed.
     */
    activate() {
        return this._requestState(!this._active);
    }

    /**
     * Asks for a new state on behalf of the user, as described for `state-set`.
     *
     * @protected
     * @param {boolean} state
     * @returns {boolean} Whether `active` changed.
     */
    _requestState(state) {
        if (!this.isSensitive || this.destroyed) {
            return false;
        }

        if (this.emit('state-set', this, state) || this.destroyed) {
            this._updateState();

            return false;
        }

        this.active = state;

        this.emit('activate', this);

        return true;
    }

    /**
     * Focuses and toggles the switch for its mnemonic, or only focuses it when other widgets share
     * the mnemonic.
     *
     * @protected
     * @param {boolean} groupCycling
     */
    _mnemonicActivate(groupCycling) {
        this.focus();

        if (!groupCycling) {
            this.activate();
        }
    }

    /**
     * Updates the state classes, the accessible state and the slider position.
     *
     * @protected
     */
    _updateState() {
        this.el.classList.toggle('wy-active', this._active);
        this.el.setAttribute('aria-checked', String(this._active));
        this.el.style.removeProperty('--wy-switch-position');
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive || this._drag) {
            return;
        }

        // Keep the text selection and the default focus handling out of the way.
        event.preventDefault();
        this.focus();

        const trough = this.el.getBoundingClientRect();
        const slider = this._sliderEl.getBoundingClientRect();

        this._drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startLeft: slider.left - trough.left,
            range: Math.max(1, trough.width - slider.width),
            dragging: false,
        };

        try {
            this.el.setPointerCapture(event.pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }

        this.el.classList.add('wy-pressed');
    }

    _onPointerMove(event) {
        const drag = this._drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const distance = event.clientX - drag.startX;
        if (!drag.dragging && Math.abs(distance) < settings.dragThreshold) {
            return;
        }

        drag.dragging = true;
        this.el.classList.add('wy-dragging');

        // The slider follows the pointer, as a position from 0 (off) to 1 (on).
        const position = clamp((drag.startLeft + distance) / drag.range, 0, 1);
        this.el.style.setProperty('--wy-switch-position', String(position));
    }

    _onPointerUp(event, released) {
        const drag = this._drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        this._drag = null;

        const position = Number(this.el.style.getPropertyValue('--wy-switch-position') || 0);

        this.el.classList.remove('wy-pressed', 'wy-dragging');
        this._updateState();

        if (!released) {
            return;
        }

        // A drag chooses the side the slider ended on; a click toggles.
        if (drag.dragging) {
            const state = position >= 0.5;
            if (state !== this._active) {
                this._requestState(state);
            }
        } else {
            this.activate();
        }
    }

    _onKeyDown(event) {
        if (
            !this.isSensitive ||
            event.target !== this.el ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            (event.key !== Key.SPACE && event.key !== Key.ENTER)
        ) {
            return;
        }

        // Handling Enter keeps it from activating the default button of the window.
        event.preventDefault();

        if (!event.repeat) {
            this.activate();
        }
    }
}

defineProperties(Switch, {
    canFocus: { value: true },

    hAlign: { value: Align.START },
    vAlign: { value: Align.CENTER },

    /**
     * Whether the switch is on.
     */
    active: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateState();
        },
    },
});

registerType('switch', Switch);
