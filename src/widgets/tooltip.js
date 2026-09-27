/**
 * @module widgets/tooltip
 */

import { defineProperties } from '../core/instance.js';
import { placePopup } from '../core/popup.js';
import { registerType } from '../core/registry.js';
import { getScreen } from '../core/screen.js';
import { settings } from '../core/settings.js';
import { createElement, uniqueId } from '../core/util.js';
import { Bin } from './bin.js';
import { POPUP_ATTRIBUTE } from './menu-manager.js';

/**
 * How far in pixels below the pointer a tooltip appears, to clear the pointer's arrow.
 *
 * @type {number}
 */
const CURSOR_HEIGHT = 20;

/**
 * How long in milliseconds after a tooltip disappeared the next one appears without delay, when
 * the pointer moves from widget to widget ("browse mode").
 *
 * @type {number}
 */
const BROWSE_MODE_TIMEOUT = 500;

/**
 * Where tooltips are placed.
 *
 * @enum {string}
 */
export const TooltipPlacement = Object.freeze({
    POINTER: 'pointer', // Below the pointer, like the original toolkit.
    WIDGET: 'widget', // Below the widget.
});

/**
 * The tooltip that is currently shown.
 *
 * @type {Tooltip | null}
 */
let shownTooltip = null;

/**
 * When the last tooltip disappeared, as a `performance.now()` time.
 *
 * @type {number}
 */
let lastDisappearTime = -Infinity;

/**
 * A small popup with a hint about a widget, shown when the pointer rests on the widget.
 *
 * Widgets create their tooltip when `tooltipLabel` is set, and call `appearAt()` when the pointer
 * enters, `follow()` when it moves and `disappear()` when it leaves or presses. The tooltip
 * appears after `appearDelay` (by default `settings.tooltipAppearDelay`) of the pointer resting,
 * below the pointer (or below the widget), and disappears after `disappearDelay`. Only one
 * tooltip is shown at a time, and while one is shown (or just disappeared), moving to another
 * widget shows that widget's tooltip right away. Pressing a key or scrolling hides it.
 *
 * The tooltip shows its `label`, or a custom widget set as `content`. It describes its widget for
 * assistive technology (`aria-describedby`).
 */
export class Tooltip extends Bin {
    _initialize() {
        super._initialize();

        /** @type {import('./widget.js').Widget | null} */
        this._widget = null;

        this._pointer = null;
        this._appearTimer = 0;
        this._disappearTimer = 0;
        this._listening = false;

        this.el.id = uniqueId('wy-tooltip');

        this._onDocumentEvent = () => this._disappearNow();
    }

    _render() {
        const element = createElement(`
            <div class="wy-tooltip" role="tooltip" ${POPUP_ATTRIBUTE}>
                <span class="wy-tooltip-label"></span>
            </div>
        `);

        this._labelEl = element.querySelector('.wy-tooltip-label');

        return element;
    }

    /**
     * The tooltip that is currently shown, or `null`.
     *
     * @type {Tooltip | null}
     */
    static get shown() {
        return shownTooltip;
    }

    /**
     * Makes the tooltip appear for a widget after the delay, or right away when another tooltip is
     * shown or just disappeared.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {PointerEvent | MouseEvent} [event] The pointer event, for placing the tooltip at the
     *     pointer.
     */
    appearAt(widget, event) {
        if (this.destroyed || !widget) {
            return;
        }

        this._setWidget(widget);
        this._updatePointer(event);

        clearTimeout(this._disappearTimer);
        this._disappearTimer = 0;

        if (this._visible) {
            this._place();

            return;
        }

        clearTimeout(this._appearTimer);
        this._appearTimer = 0;

        const delay = this._appearDelay < 0 ? settings.tooltipAppearDelay : this._appearDelay;
        const browsing =
            (shownTooltip && shownTooltip !== this) ||
            performance.now() - lastDisappearTime < BROWSE_MODE_TIMEOUT;

        if (delay <= 0 || browsing) {
            this._appear();
        } else {
            this._appearTimer = setTimeout(() => this._appear(), delay);
        }
    }

    /**
     * Follows the pointer moving over the widget: while the tooltip waits to appear, the pointer
     * must rest again for the full delay; once shown, it moves along if `followPointer` is set.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {PointerEvent | MouseEvent} [event]
     */
    follow(widget, event) {
        if (this.destroyed || widget !== this._widget) {
            return;
        }

        this._updatePointer(event);

        if (this._visible) {
            if (this._followPointer) {
                this._place();
            }

            return;
        }

        if (this._appearTimer) {
            clearTimeout(this._appearTimer);

            const delay = this._appearDelay < 0 ? settings.tooltipAppearDelay : this._appearDelay;
            this._appearTimer = setTimeout(() => this._appear(), delay);
        }
    }

    /**
     * Makes the tooltip disappear after `disappearDelay`, and cancels a pending appearance.
     */
    disappear() {
        clearTimeout(this._appearTimer);
        this._appearTimer = 0;

        if (!this._visible) {
            return;
        }

        const delay =
            this._disappearDelay < 0 ? settings.tooltipDisappearDelay : this._disappearDelay;

        clearTimeout(this._disappearTimer);
        if (delay <= 0) {
            this._disappearNow();
        } else {
            this._disappearTimer = setTimeout(() => this._disappearNow(), delay);
        }
    }

    /**
     * Destroys the tooltip, removing it from the screen and from its widget's description.
     */
    destroy() {
        this._disappearNow();
        this._setWidget(null);

        super.destroy();
    }

    _appear() {
        this._appearTimer = 0;

        const widget = this._widget;
        if (
            this.destroyed ||
            !widget ||
            widget.destroyed ||
            !widget.isVisible ||
            !widget.isSensitive ||
            (!this._label && !this._children.length)
        ) {
            return;
        }

        if (shownTooltip && shownTooltip !== this) {
            shownTooltip._disappearNow();
        }

        shownTooltip = this;
        this.visible = true;

        this._listen(true);
    }

    _disappearNow() {
        clearTimeout(this._appearTimer);
        clearTimeout(this._disappearTimer);
        this._appearTimer = 0;
        this._disappearTimer = 0;

        this._listen(false);

        if (shownTooltip === this) {
            shownTooltip = null;
        }

        if (this._visible) {
            this.visible = false;
            lastDisappearTime = performance.now();
        }
    }

    _listen(listen) {
        if (listen === this._listening) {
            return;
        }

        this._listening = listen;

        const method = listen ? 'addEventListener' : 'removeEventListener';
        document[method]('keydown', this._onDocumentEvent, true);
        document[method]('wheel', this._onDocumentEvent, { capture: true, passive: true });
    }

    _updatePointer(event) {
        if (event && typeof event.clientX === 'number') {
            this._pointer = { x: event.clientX, y: event.clientY };
        }
    }

    _setWidget(widget) {
        const old = this._widget;
        if (old === widget) {
            return;
        }

        if (old && !old.destroyed) {
            const element = old.focusElement;
            const ids = (element.getAttribute('aria-describedby') || '')
                .split(/\s+/)
                .filter((x) => x && x !== this.el.id);

            if (ids.length) {
                element.setAttribute('aria-describedby', ids.join(' '));
            } else {
                element.removeAttribute('aria-describedby');
            }
        }

        this._widget = widget;

        if (widget) {
            const element = widget.focusElement;
            const ids = (element.getAttribute('aria-describedby') || '').split(/\s+/);
            if (!ids.includes(this.el.id)) {
                element.setAttribute('aria-describedby', [...ids, this.el.id].join(' ').trim());
            }

            // The description needs the element in the document, so keep it there (hidden).
            if (!this.el.isConnected) {
                getScreen().layer.append(this.el);
            }
        }
    }

    _onVisibleChange(visible) {
        this.el.hidden = !visible;

        if (visible) {
            const screen = getScreen();
            if (!this.el.isConnected) {
                screen.layer.append(this.el);
            }

            this.el.style.zIndex = String(screen.nextZIndex());
        }

        this._recalculateVisibility();
        this._recalculateSensitivity();

        if (visible) {
            this._place();
        }
    }

    _place() {
        if (!this._visible) {
            return;
        }

        // Measure at the origin, where the tooltip gets its natural width.
        this.el.style.left = '0px';
        this.el.style.top = '0px';

        if (this._fixedPosition) {
            const { x, y } = this._fixedPosition;
            placePopup(this.el, { x, y, width: 0, height: 0 }, { side: 'bottom', align: 'start' });

            return;
        }

        const widget = this._widget;
        const pointer = this._pointer;

        if (this._placement === TooltipPlacement.WIDGET || !pointer) {
            placePopup(this.el, widget.el, { side: 'bottom', align: 'start', offset: 2 });
        } else {
            placePopup(
                this.el,
                { x: pointer.x, y: pointer.y, width: 1, height: CURSOR_HEIGHT },
                { side: 'bottom', align: 'start' }
            );
        }
    }

    _updateContent() {
        this._labelEl.hidden = !this._label || this._children.length > 0;
    }

    _onChildrenChange() {
        super._onChildrenChange();

        this._updateContent();
    }
}

defineProperties(Tooltip, {
    isTopLevel: { value: true, readOnly: true },

    visible: {
        value: false,
        changed(visible) {
            this._onVisibleChange(visible);
        },
    },

    /**
     * The text of the tooltip.
     */
    label: {
        value: '',
        coerce(label) {
            return label === null || label === undefined ? '' : String(label);
        },
        changed(label) {
            this._labelEl.textContent = label;
            this._updateContent();

            if (!label && !this._children.length) {
                this._disappearNow();
            }
        },
    },

    /**
     * A custom widget shown instead of the label, or `null`. The same as `child`.
     */
    content: {
        signal: false,
        get() {
            return this.child;
        },
        set(widget) {
            this.child = widget;

            return false;
        },
    },

    /**
     * The widget the tooltip was last shown (or asked to appear) for, or `null`.
     */
    widget: {
        readOnly: true,
        get() {
            return this._widget;
        },
    },

    /**
     * The delay in milliseconds before the tooltip appears, or -1 for the default
     * (`settings.tooltipAppearDelay`).
     */
    appearDelay: { value: -1 },

    /**
     * The delay in milliseconds before the tooltip disappears, or -1 for the default
     * (`settings.tooltipDisappearDelay`).
     */
    disappearDelay: { value: -1 },

    /**
     * Where the tooltip appears: one of `TooltipPlacement`.
     */
    placement: {
        value: TooltipPlacement.POINTER,
        coerce(placement) {
            if (!Object.values(TooltipPlacement).includes(placement)) {
                throw new RangeError(`Invalid tooltip placement '${placement}'.`);
            }

            return placement;
        },
    },

    /**
     * Whether a shown tooltip moves along with the pointer.
     */
    followPointer: { value: false },

    /**
     * The position of the shown tooltip in viewport coordinates, as `{x, y}`. Setting it pins the
     * tooltip there (kept on screen); set `null` to place it automatically again.
     */
    position: {
        signal: false,
        get() {
            return { x: this.el.offsetLeft, y: this.el.offsetTop };
        },
        set(position) {
            if (position && (typeof position.x !== 'number' || typeof position.y !== 'number')) {
                throw new TypeError('A position must have numeric x and y.');
            }

            this._fixedPosition = position ? { x: position.x, y: position.y } : null;
            this._place();

            return false;
        },
    },

    /**
     * The x position of the tooltip. Does not signal.
     */
    x: {
        signal: false,
        get() {
            return this.position.x;
        },
        set(x) {
            this.position = { x, y: this.position.y };

            return false;
        },
    },

    /**
     * The y position of the tooltip. Does not signal.
     */
    y: {
        signal: false,
        get() {
            return this.position.y;
        },
        set(y) {
            this.position = { x: this.position.x, y };

            return false;
        },
    },
});

registerType('tooltip', Tooltip);
