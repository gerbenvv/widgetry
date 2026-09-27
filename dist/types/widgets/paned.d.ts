/**
 * @module widgets/paned
 */
import { Container } from './container.js';
/**
 * The size of the splitter between the panes, in pixels.
 *
 * @type {number}
 */
export declare const SPLITTER_SIZE: number;
export type PaneOptions = {
    /**
     * Whether the pane grows and shrinks when the paned is resized.
     */
    resize: boolean;
    /**
     * Whether the pane can be made smaller than its child's minimum size.
     */
    shrink: boolean;
};
/**
 * @typedef {object} PaneOptions
 * @property {boolean} resize Whether the pane grows and shrinks when the paned is resized.
 * @property {boolean} shrink Whether the pane can be made smaller than its child's minimum size.
 */
/**
 * Two panes side by side (or above each other) with a splitter between them that the user can
 * drag to divide the space, like GTK's paned.
 *
 * Each child has two flags, given to `addChild(widget, resize, shrink)`:
 *
 * - `resize` (default `true`): whether the pane takes part in size changes of the paned. When
 *   both panes resize (or neither does), they keep their proportions; otherwise only the pane that
 *   resizes changes size.
 * - `shrink` (default `false`, as the original toolkit): whether the user can make the pane
 *   smaller than its child's minimum size, which then gets clipped.
 *
 * Until `position` is set (by the user dragging the splitter or by code), the space is divided
 * equally. Like in GTK, the splitter is not in the Tab order: F8 gives it the keyboard focus
 * (again for the next outer paned), Escape or Enter gives the focus back. With the focus, the
 * arrow keys move it by 10 pixels, Page Up and Page Down by a tenth of the space, and Home and
 * End move it to the ends. With `canFocus`, the splitter is in the Tab order as well.
 *
 * Signals: `position-change` whenever the position of the splitter changes.
 */
export declare class Paned extends Container {
    /** @type {Map<import('./widget.js').Widget, PaneOptions>} */
    _paneOptions: Map<import('./widget.js').Widget, PaneOptions>;
    /** @type {PaneOptions | null} */
    _pendingOptions: PaneOptions | null;
    _reference: number;
    _lastPosition: any;
    _drag: {
        move: (moveEvent: any) => void;
        end: () => void;
    };
    _previousFocus: any;
    _paneObserver: ResizeObserver;
    _paneEls: Element[];
    _splitterEl: Element;
    _position: number;
    position: number;
    _positionSet: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The splitter, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * The element of the splitter, e.g. for styling.
     *
     * @type {HTMLElement}
     */
    get splitterElement(): HTMLElement;
    /**
     * Adds a child as the first or second pane.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize] Whether the pane takes part in resizing the paned.
     * @param {boolean} [shrink] Whether the pane may become smaller than the child's minimum size.
     * @returns {import('./widget.js').Widget} The widget.
     * @throws {Error} If the paned already has two children.
     */
    addChild(widget: import('./widget.js').Widget, resize?: boolean, shrink?: boolean): import('./widget.js').Widget;
    /**
     * Adds the first pane, like GTK's `pack1()`.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize]
     * @param {boolean} [shrink]
     * @returns {import('./widget.js').Widget}
     */
    pack1(widget: import('./widget.js').Widget, resize?: boolean, shrink?: boolean): import('./widget.js').Widget;
    /**
     * Adds the second pane, like GTK's `pack2()`.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {boolean} [resize]
     * @param {boolean} [shrink]
     * @returns {import('./widget.js').Widget}
     */
    pack2(widget: import('./widget.js').Widget, resize?: boolean, shrink?: boolean): import('./widget.js').Widget;
    insertChild(widget: any, index: any): import("./widget.js").Widget;
    removeChild(widget: any): number;
    /**
     * Returns the pane flags of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @returns {PaneOptions}
     * @throws {Error} If the widget is not a child.
     */
    getChildOptions(widget: import('./widget.js').Widget): PaneOptions;
    /**
     * Changes the pane flags of a child.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {Partial<PaneOptions>} options
     * @throws {Error} If the widget is not a child.
     */
    setChildOptions(widget: import('./widget.js').Widget, options: Partial<PaneOptions>): void;
    destroy(): void;
    _attachChildElement(_widget: any, _index: any): void;
    _detachChildElement(widget: any): void;
    _onChildrenChange(): void;
    _syncPaneElements(): void;
    _getHorizontal(): boolean;
    /**
     * Returns the size available to both panes together, without the splitter, or -1 when the
     * paned is not rendered.
     *
     * @returns {number}
     */
    _getAvailableSize(): number;
    _getVisiblePanes(): import("./widget.js").Widget[];
    _updateLayout(): void;
    _getTemplate(first: any, second: any): string;
    _clampPosition(position: any, available: any): number;
    /**
     * Returns the rendered position of the splitter, or `null` when it is not shown.
     *
     * @returns {number | null}
     */
    _measurePosition(): number | null;
    _checkPosition(): void;
    /**
     * Moves the splitter as the user does: the position is clamped to the minimum sizes of the
     * panes, and the rendered position is stored.
     *
     * @param {number} position
     */
    _moveSplitter(position: number): void;
    _onPointerDown(event: any): void;
    _endDrag(): void;
    /**
     * Gives the splitter the keyboard focus, as F8 does.
     *
     * @returns {boolean} Whether the splitter got the focus.
     */
    focusSplitter(): boolean;
    _onPanedKeyDown(event: any): void;
    _onKeyDown(event: any): void;
}
export declare namespace Paned {
    var builderProperties: {
        /**
         * Builds the (at most two) children. A child object may have `resize` and `shrink` flags
         * besides the widget's own properties.
         *
         * @param {object} builder
         * @param {Paned} paned
         * @param {object[]} children
         */
        children(builder: object, paned: Paned, children: object[]): void;
    };
}

/** The declared properties of {@link Paned}. */
export interface Paned {
    /**
     * The direction the panes are placed in: one of `Orientation`. Horizontal places them side
     * by side, with a vertical splitter.
     */
    orientation: any;
    /**
     * Whether `position` was set. When `false`, the panes share the space equally.
     */
    positionSet: boolean;
    /**
     * The original toolkit's name of `position`.
     */
    splitterPosition: any;
    /**
     * The smallest position the splitter can have, in pixels.
     */
    minSplitterPosition: number;
    /**
     * The largest position the splitter can have, in pixels.
     */
    maxSplitterPosition: any;
}
