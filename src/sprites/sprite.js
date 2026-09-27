/**
 * @module sprites/sprite
 */

import { defineProperties, Instance } from '../core/instance.js';
import { EventType, Events, MouseButton } from '../events/constants.js';
import {
    ButtonEvent,
    CrossingEvent,
    getModifiers,
    MotionEvent,
    ScrollEvent,
} from '../events/events.js';
import { Matrix } from '../data/matrix.js';
import { countPress, EVENT_BINDINGS, getPressCount } from '../widgets/widget.js';

/**
 * The SVG namespace.
 *
 * @type {string}
 */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Stroke styles of sprites.
 *
 * @enum {number}
 */
export const StrokeStyle = Object.freeze({
    SOLID: 0,
    DASHED: 1,
    DOTTED: 2,
});

/**
 * Maps SVG elements to the sprite they are the element of.
 *
 * @type {WeakMap<Element, Sprite>}
 */
const SPRITE_BY_ELEMENT = new WeakMap();

/**
 * The event types sprites support: pointer events only, as sprites do not take the focus.
 *
 * @type {ReadonlySet<string>}
 */
const SPRITE_EVENT_TYPES = new Set([
    EventType.MOTION,
    EventType.SCROLL,
    EventType.BUTTON_PRESS,
    EventType.BUTTON_RELEASE,
    EventType.ENTER,
    EventType.LEAVE,
]);

/**
 * Pointer masks that make a sprite grab the pointer while a button is pressed on it, so dragging
 * a sprite keeps sending it motion.
 *
 * @type {number}
 */
const GRAB_MASK =
    Events.MOTION | Events.CAPTURE_MOTION | Events.BUTTON_RELEASE | Events.CAPTURE_BUTTON_RELEASE;

/**
 * Toolkit button numbers of DOM button numbers.
 *
 * @type {Readonly<Record<number, number>>}
 */
const DOM_TO_TOOLKIT_BUTTON = Object.freeze({
    0: MouseButton.PRIMARY,
    1: MouseButton.MIDDLE,
    2: MouseButton.SECONDARY,
});

function toPoint(point) {
    if (!point || typeof point !== 'object') {
        throw new TypeError('A position must be an object with x and y.');
    }

    const x = Number(point.x ?? 0);
    const y = Number(point.y ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError('A position must have finite coordinates.');
    }

    return Object.freeze({ x, y });
}

function toFraction(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
        throw new RangeError('An opacity must be a number from 0 to 1.');
    }

    return number;
}

/**
 * Base class of the shapes drawn on a `VectorCanvas`, as SVG elements.
 *
 * Like widgets, sprites have a parent (the canvas), are `visible` (and `isVisible` when their
 * canvas is too), can have style classes and emit event signals for the pointer events enabled
 * in their `events` mask: `button-press-event`, `button-release-event`, `motion-event`,
 * `scroll-event`, `enter-event` and `leave-event` (`sprite, event`), their `capture-` variants and
 * the generic `event`. Events are hit-tested on the painted shape: a shape without a fill only
 * gets events on its stroke. A handler returning `true` handles the event.
 *
 * All sprites share the paint properties (fill and stroke), a `position` and a `transformation`
 * (a `Matrix`). Sprites are drawn in the order of the canvas, sorted by `zIndex`.
 *
 * Signals: `destroy`, `parent-change`, `is-visible-change`, the property change signals and the
 * event signals.
 */
export class Sprite extends Instance {
    _initialize() {
        super._initialize();

        /** @type {import('../widgets/vector-canvas.js').VectorCanvas | null} */
        this._parent = null;
        this._isVisibleCache = false;

        // Attached DOM listeners, by DOM event name and phase.
        this._domListeners = new Map();

        /**
         * The SVG element.
         *
         * @type {SVGGraphicsElement}
         */
        this.el = this._render();
        this.el.classList.add('wy-sprite');
        SPRITE_BY_ELEMENT.set(this.el, this);

        this._titleEl = null;

        this._applyShape();
        this._applyPosition();
        this._applyTransform();
        this._applyPaint();
    }

    /**
     * Finds the sprite an element belongs to.
     *
     * @param {Node | null} node
     * @returns {Sprite | null}
     */
    static fromElement(node) {
        while (node) {
            const sprite = SPRITE_BY_ELEMENT.get(/** @type {Element} */ (node));
            if (sprite) {
                return sprite;
            }

            node = node.parentNode;
        }

        return null;
    }

    /**
     * Shows the sprite. The same as setting `visible` to `true`.
     */
    show() {
        this.visible = true;
    }

    /**
     * Hides the sprite. The same as setting `visible` to `false`.
     */
    hide() {
        this.visible = false;
    }

    /**
     * Adds a CSS class to the element.
     *
     * @param {string} className
     */
    addStyleClass(className) {
        this.el.classList.add(className);
    }

    /**
     * Removes a CSS class from the element.
     *
     * @param {string} className
     */
    removeStyleClass(className) {
        this.el.classList.remove(className);
    }

    /**
     * Whether the element has a CSS class.
     *
     * @param {string} className
     * @returns {boolean}
     */
    hasStyleClass(className) {
        return this.el.classList.contains(className);
    }

    /**
     * Enables event signals. The same as `sprite.events |= events`.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events) {
        this.events = this._events | events;
    }

    /**
     * Disables event signals. The same as `sprite.events &= ~events`.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events) {
        this.events = this._events & ~events;
    }

    /**
     * Draws the sprite above all sprites with the same `zIndex`.
     */
    raise() {
        this._requireParent().raiseSprite(this);
    }

    /**
     * Draws the sprite below all sprites with the same `zIndex`.
     */
    lower() {
        this._requireParent().lowerSprite(this);
    }

    /**
     * Returns the bounding box of the shape, before the transformation, in canvas units.
     *
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getBounds() {
        try {
            const box = this.el.getBBox();

            return { x: box.x, y: box.y, width: box.width, height: box.height };
        } catch (_error) {
            // Not rendered.
            return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    /**
     * Destroys the sprite, removing it from its canvas.
     */
    destroy() {
        super.destroy();

        if (this._parent) {
            this._parent.removeSprite(this);
        }

        this.el.remove();
    }

    /**
     * Creates the SVG element. Subclasses implement this.
     *
     * @protected
     * @returns {SVGGraphicsElement}
     */
    _render() {
        throw new Error(`${this.constructor.name} must implement _render().`);
    }

    /**
     * Creates an SVG element.
     *
     * @protected
     * @param {string} tagName
     * @param {Record<string, string | number>} [attributes]
     * @returns {SVGGraphicsElement}
     */
    _createShape(tagName, attributes = {}) {
        const element = /** @type {SVGGraphicsElement} */ (
            document.createElementNS(SVG_NAMESPACE, tagName)
        );

        for (const [name, value] of Object.entries(attributes)) {
            element.setAttribute(name, String(value));
        }

        return element;
    }

    /**
     * Writes the shape's own attributes. Subclasses implement this.
     *
     * @protected
     */
    _applyShape() {}

    /**
     * Writes the position. By default as the `x` and `y` attributes.
     *
     * @protected
     */
    _applyPosition() {
        this.el.setAttribute('x', String(this._position.x));
        this.el.setAttribute('y', String(this._position.y));
    }

    /**
     * Whether the position is part of the transform (for shapes without `x` and `y`).
     *
     * @protected
     * @returns {boolean}
     */
    _isPositionInTransform() {
        return false;
    }

    /**
     * Writes the `transform` attribute from the transformation (and the position, for shapes
     * that have no position attributes).
     *
     * @protected
     */
    _applyTransform() {
        const parts = [];
        const { x, y } = this._position;

        if (this._isPositionInTransform() && (x || y)) {
            parts.push(`translate(${x} ${y})`);
        }

        if (!this._transformation.isIdentity) {
            parts.push(String(this._transformation));
        }

        if (parts.length) {
            this.el.setAttribute('transform', parts.join(' '));
        } else {
            this.el.removeAttribute('transform');
        }
    }

    /**
     * Writes the fill and stroke attributes.
     *
     * @protected
     */
    _applyPaint() {
        const element = this.el;
        const width = this._strokeWidth;

        element.setAttribute('fill', this._fill || 'none');
        element.setAttribute('fill-opacity', String(this._fillOpacity));
        element.setAttribute('stroke', width > 0 && this._strokeColor ? this._strokeColor : 'none');
        element.setAttribute('stroke-width', String(width));
        element.setAttribute('stroke-opacity', String(this._strokeOpacity));

        if (this._strokeStyle === StrokeStyle.DASHED) {
            element.setAttribute('stroke-dasharray', `${4 * width} ${2 * width}`);
        } else if (this._strokeStyle === StrokeStyle.DOTTED) {
            element.setAttribute('stroke-dasharray', `${width} ${1.5 * width}`);
        } else {
            element.removeAttribute('stroke-dasharray');
        }

        if (this._opacity < 1) {
            element.setAttribute('opacity', String(this._opacity));
        } else {
            element.removeAttribute('opacity');
        }
    }

    _requireParent() {
        if (!this._parent) {
            throw new Error('The sprite is not on a canvas.');
        }

        return this._parent;
    }

    /**
     * Sets the parent. Called by the canvas.
     *
     * @protected
     * @param {import('../widgets/vector-canvas.js').VectorCanvas | null} parent
     */
    _setParent(parent) {
        if (parent && this._parent && this._parent !== parent) {
            throw new Error('The sprite has already been added to a canvas.');
        }

        this._parent = parent;
        this._recalculateVisibility();

        this.emit('parent-change', this);
    }

    /**
     * Recomputes `isVisible` from `visible` and the parent.
     *
     * @protected
     */
    _recalculateVisibility() {
        const isVisible = this._visible && Boolean(this._parent?.isVisible);
        if (isVisible === this._isVisibleCache) {
            return;
        }

        this._isVisibleCache = isVisible;
        this.emit('is-visible-change', this);
    }

    _syncEventListeners() {
        for (const [bubbleMask, captureMask, domName, type] of EVENT_BINDINGS) {
            if (!SPRITE_EVENT_TYPES.has(type)) {
                continue;
            }

            for (const capture of [false, true]) {
                const mask = capture ? captureMask : bubbleMask;
                const wanted =
                    Boolean(mask && this._events & mask) ||
                    (!capture && domName === 'pointerdown' && Boolean(this._events & GRAB_MASK));

                const key = `${domName}:${capture}`;
                const existing = this._domListeners.get(key);

                if (wanted && !existing) {
                    const listener = (event) => this._onDomEvent(event, type, capture);
                    this.el.addEventListener(domName, listener, { capture, passive: false });
                    this._domListeners.set(key, listener);
                } else if (!wanted && existing) {
                    this.el.removeEventListener(domName, existing, { capture });
                    this._domListeners.delete(key);
                }
            }
        }
    }

    _onDomEvent(nativeEvent, type, capture) {
        if (type === EventType.BUTTON_PRESS && !capture && this._events & GRAB_MASK) {
            try {
                this.el.setPointerCapture?.(nativeEvent.pointerId);
            } catch (_error) {
                // The pointer may already be gone.
            }
        }

        const mask = EVENT_BINDINGS.find((x) => x[3] === type)[capture ? 1 : 0];
        if (!(this._events & mask) || !this._parent?.isSensitive) {
            return;
        }

        const event = this._createEvent(nativeEvent, type);
        const prefix = capture ? 'capture-' : '';
        const handled =
            this.emit(`${prefix}${type}-event`, this, event) ||
            this.emit(`${prefix}event`, this, event);

        if (handled) {
            nativeEvent.stopPropagation();

            if (type !== EventType.BUTTON_PRESS && type !== EventType.BUTTON_RELEASE) {
                nativeEvent.preventDefault();
            }
        }
    }

    _createEvent(nativeEvent, type) {
        const modifiers = getModifiers(nativeEvent);
        const x = nativeEvent.pageX ?? 0;
        const y = nativeEvent.pageY ?? 0;

        switch (type) {
            case EventType.MOTION:
                return new MotionEvent(this, modifiers, x, y, nativeEvent);

            case EventType.SCROLL: {
                // Lines, positive when scrolling up, like widget scroll events.
                let lines = nativeEvent.deltaY || nativeEvent.deltaX;
                if (nativeEvent.deltaMode === 0) {
                    lines /= 33.3;
                } else if (nativeEvent.deltaMode === 2) {
                    lines *= 20;
                }

                return new ScrollEvent(this, modifiers, x, y, -lines, nativeEvent);
            }

            case EventType.BUTTON_PRESS:
            case EventType.BUTTON_RELEASE: {
                const press = type === EventType.BUTTON_PRESS;
                if (press && nativeEvent.wySpritePressCount === undefined) {
                    nativeEvent.wySpritePressCount = countPress(nativeEvent);
                }

                const button = DOM_TO_TOOLKIT_BUTTON[nativeEvent.button] || MouseButton.PRIMARY;
                const count = press ? nativeEvent.wySpritePressCount : getPressCount();

                return new ButtonEvent(this, modifiers, x, y, press, button, count, nativeEvent);
            }

            default: {
                const related = Sprite.fromElement(nativeEvent.relatedTarget);

                return new CrossingEvent(
                    this,
                    modifiers,
                    x,
                    y,
                    type === EventType.ENTER,
                    related,
                    nativeEvent
                );
            }
        }
    }
}

defineProperties(Sprite, {
    /**
     * Whether the sprite is shown. Set last when passing several properties.
     */
    visible: {
        value: true,
        late: true,
        changed(visible) {
            if (visible) {
                this.el.removeAttribute('display');
            } else {
                this.el.setAttribute('display', 'none');
            }

            this._recalculateVisibility();
        },
    },

    /**
     * Whether the sprite is effectively visible: it is `visible` and on a visible canvas.
     */
    isVisible: {
        readOnly: true,
        get() {
            return this._isVisibleCache;
        },
    },

    /**
     * The canvas the sprite is on, or `null`.
     */
    parent: {
        readOnly: true,
        get() {
            return this._parent;
        },
    },

    /**
     * The window of the canvas, or `null`.
     */
    window: {
        readOnly: true,
        get() {
            return this._parent?.window || null;
        },
    },

    /**
     * Whether this is a top-level object. Sprites never are.
     */
    isTopLevel: { value: false, readOnly: true },

    /**
     * A name for finding the sprite, also set as the `data-name` attribute.
     */
    name: {
        value: '',
        changed(name) {
            if (name) {
                this.el.dataset.name = name;
            } else {
                delete this.el.dataset.name;
            }
        },
    },

    /**
     * A title, shown as the native tooltip and used as the accessible name, or `''`.
     */
    title: {
        value: '',
        changed(title) {
            if (!title) {
                this._titleEl?.remove();
                this._titleEl = null;

                return;
            }

            if (!this._titleEl) {
                this._titleEl = document.createElementNS(SVG_NAMESPACE, 'title');
                this.el.prepend(this._titleEl);
            }

            this._titleEl.textContent = title;
        },
    },

    /**
     * The mask of `Events` whose signals the sprite emits. Only pointer events apply.
     */
    events: {
        value: Events.NONE,
        changed() {
            this._syncEventListeners();
        },
    },

    /**
     * The stacking order: sprites with a higher `zIndex` are drawn on top. Sprites with the same
     * `zIndex` are drawn in the order of the canvas.
     */
    zIndex: {
        value: 0,
        coerce(zIndex) {
            if (!Number.isFinite(zIndex)) {
                throw new TypeError('The z-index must be a number.');
            }

            return zIndex;
        },
        changed() {
            this._parent?._updateOrder();
        },
    },

    /**
     * The position of the sprite, as `{x, y}` in canvas units.
     */
    position: {
        value: Object.freeze({ x: 0, y: 0 }),
        coerce: toPoint,
        set(position) {
            if (position.x === this._position.x && position.y === this._position.y) {
                return false;
            }

            this._position = position;
            this._applyPosition();
            this._applyTransform();
        },
    },

    /**
     * The horizontal position.
     */
    x: {
        signal: false,
        get() {
            return this._position.x;
        },
        set(x) {
            this.position = { x, y: this._position.y };

            return false;
        },
    },

    /**
     * The vertical position.
     */
    y: {
        signal: false,
        get() {
            return this._position.y;
        },
        set(y) {
            this.position = { x: this._position.x, y };

            return false;
        },
    },

    /**
     * The transformation of the sprite, a `Matrix`.
     */
    transformation: {
        value: Matrix.identity,
        coerce(matrix) {
            if (!(matrix instanceof Matrix)) {
                throw new TypeError('A transformation must be a Matrix.');
            }

            return matrix;
        },
        changed() {
            this._applyTransform();
        },
    },

    /**
     * The fill: a CSS color (or `currentColor`), a paint server reference such as
     * `url(#gradient)`, or `''` for no fill.
     */
    fill: {
        value: '',
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The fill opacity, from 0 to 1.
     */
    fillOpacity: {
        value: 1,
        coerce: toFraction,
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The stroke color. The default, `currentColor`, is the text color of the theme.
     */
    strokeColor: {
        value: 'currentColor',
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The stroke width. 0 draws no stroke.
     */
    strokeWidth: {
        value: 1,
        coerce(width) {
            const number = Number(width);
            if (!Number.isFinite(number) || number < 0) {
                throw new RangeError('A stroke width must be a non-negative number.');
            }

            return number;
        },
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The stroke style: one of {@link StrokeStyle}.
     */
    strokeStyle: {
        value: StrokeStyle.SOLID,
        coerce(style) {
            if (!Object.values(StrokeStyle).includes(style)) {
                throw new RangeError(`Invalid stroke style ${style}.`);
            }

            return style;
        },
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The stroke opacity, from 0 to 1.
     */
    strokeOpacity: {
        value: 1,
        coerce: toFraction,
        changed() {
            this._applyPaint();
        },
    },

    /**
     * The opacity of the whole sprite, from 0 to 1.
     */
    opacity: {
        value: 1,
        coerce: toFraction,
        changed() {
            this._applyPaint();
        },
    },
});
