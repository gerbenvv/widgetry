/**
 * @module sprites/sprite
 */
import { Instance } from '../core/instance.js';
import { ButtonEvent, CrossingEvent, MotionEvent, ScrollEvent } from '../events/events.js';
/**
 * The SVG namespace.
 *
 * @type {string}
 */
export declare const SVG_NAMESPACE: string;
/**
 * Stroke styles of sprites.
 *
 * @enum {string}
 */
export declare const StrokeStyle: Readonly<{
    SOLID: "solid";
    DASHED: "dashed";
    DOTTED: "dotted";
}>;
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
export declare class Sprite extends Instance {
    /** @type {import('../widgets/vector-canvas.js').VectorCanvas | null} */
    _parent: import('../widgets/vector-canvas.js').VectorCanvas | null;
    _isVisibleCache: any;
    _domListeners: Map<any, any>;
    /**
     * The SVG element.
     *
     * @type {SVGGraphicsElement}
     */
    el: SVGGraphicsElement;
    _titleEl: any;
    _grabState: {
        onLost: (event: any) => void;
        onUp: (event: any) => void;
    };
    _initialize(): void;
    /**
     * Finds the sprite an element belongs to.
     *
     * @param {Node | null} node
     * @returns {Sprite | null}
     */
    static fromElement(node: Node | null): Sprite | null;
    /**
     * Shows the sprite. The same as setting `visible` to `true`.
     */
    show(): void;
    /**
     * Hides the sprite. The same as setting `visible` to `false`.
     */
    hide(): void;
    /**
     * Adds a CSS class to the element.
     *
     * @param {string} className
     */
    addStyleClass(className: string): void;
    /**
     * Removes a CSS class from the element.
     *
     * @param {string} className
     */
    removeStyleClass(className: string): void;
    /**
     * Whether the element has a CSS class.
     *
     * @param {string} className
     * @returns {boolean}
     */
    hasStyleClass(className: string): boolean;
    /**
     * Enables event signals. The same as `sprite.events |= events`.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events: number): void;
    /**
     * Disables event signals. The same as `sprite.events &= ~events`.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events: number): void;
    /**
     * Draws the sprite above all sprites with the same `zIndex`.
     */
    raise(): void;
    /**
     * Draws the sprite below all sprites with the same `zIndex`.
     */
    lower(): void;
    /**
     * Returns the bounding box of the shape, before the transformation, in canvas units.
     *
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getBounds(): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /**
     * Destroys the sprite, removing it from its canvas.
     */
    destroy(): void;
    /**
     * Creates the SVG element. Subclasses implement this.
     *
     * @protected
     * @returns {SVGGraphicsElement}
     */
    protected _render(): SVGGraphicsElement;
    /**
     * Creates an SVG element.
     *
     * @protected
     * @param {string} tagName
     * @param {Record<string, string | number>} [attributes]
     * @returns {SVGGraphicsElement}
     */
    protected _createShape(tagName: string, attributes?: Record<string, string | number>): SVGGraphicsElement;
    /**
     * Writes the shape's own attributes. Subclasses implement this.
     *
     * @protected
     */
    protected _applyShape(): void;
    /**
     * Writes the position. By default as the `x` and `y` attributes.
     *
     * @protected
     */
    protected _applyPosition(): void;
    /**
     * Whether the position is part of the transform (for shapes without `x` and `y`).
     *
     * @protected
     * @returns {boolean}
     */
    protected _isPositionInTransform(): boolean;
    /**
     * Writes the `transform` attribute from the transformation (and the position, for shapes
     * that have no position attributes).
     *
     * @protected
     */
    protected _applyTransform(): void;
    /**
     * Writes the fill and stroke attributes.
     *
     * @protected
     */
    protected _applyPaint(): void;
    _requireParent(): import("../index.js").VectorCanvas;
    /**
     * Sets the parent. Called by the canvas.
     *
     * @protected
     * @param {import('../widgets/vector-canvas.js').VectorCanvas | null} parent
     */
    protected _setParent(parent: import('../widgets/vector-canvas.js').VectorCanvas | null): void;
    /**
     * Recomputes `isVisible` from `visible` and the parent.
     *
     * @protected
     */
    protected _recalculateVisibility(): void;
    _syncEventListeners(): void;
    _onDomEvent(nativeEvent: any, type: any, capture: any): void;
    /**
     * Grabs the pointer while a button is pressed on the sprite, so motion and the release keep
     * coming to it, also outside the canvas.
     *
     * @param {PointerEvent} nativeEvent The press.
     */
    _grab(nativeEvent: PointerEvent): void;
    _releaseGrab(): void;
    _dispatchDomEvent(nativeEvent: any, type: any, capture: any): void;
    _createEvent(nativeEvent: any, type: any): ButtonEvent | CrossingEvent | MotionEvent | ScrollEvent;
}

/** The declared properties of {@link Sprite}. */
export interface Sprite {
    /**
     * Whether the sprite is shown. Set last when passing several properties.
     */
    visible: boolean;
    /**
     * Whether the sprite is effectively visible: it is `visible` and on a visible canvas.
     */
    readonly isVisible: boolean;
    /**
     * The canvas the sprite is on, or `null`.
     */
    readonly parent: any;
    /**
     * The window of the canvas, or `null`.
     */
    readonly window: any;
    /**
     * Whether this is a top-level object. Sprites never are.
     */
    readonly isTopLevel: boolean;
    /**
     * A name for finding the sprite, also set as the `data-name` attribute.
     */
    name: string;
    /**
     * A title, shown as the native tooltip and used as the accessible name, or `''`.
     */
    title: string;
    /**
     * The mask of `Events` whose signals the sprite emits. Only pointer events apply.
     */
    events: number;
    /**
     * The stacking order: sprites with a higher `zIndex` are drawn on top. Sprites with the same
     * `zIndex` are drawn in the order of the canvas.
     */
    zIndex: number;
    /**
     * The position of the sprite, as `{x, y}` in canvas units.
     */
    position: any;
    /**
     * The horizontal position.
     */
    x: any;
    /**
     * The vertical position.
     */
    y: any;
    /**
     * The transformation of the sprite, a `Matrix`.
     */
    transformation: any;
    /**
     * The fill: a CSS color (or `currentColor`), a paint server reference such as
     * `url(#gradient)`, or `''` for no fill.
     */
    fill: string;
    /**
     * The fill opacity, from 0 to 1.
     */
    fillOpacity: number;
    /**
     * The stroke color. The default, `currentColor`, is the text color of the theme.
     */
    strokeColor: string;
    /**
     * The stroke width. 0 draws no stroke.
     */
    strokeWidth: number;
    /**
     * The stroke style: one of {@link StrokeStyle}.
     */
    strokeStyle: string;
    /**
     * The stroke opacity, from 0 to 1.
     */
    strokeOpacity: number;
    /**
     * The opacity of the whole sprite, from 0 to 1.
     */
    opacity: number;
}
