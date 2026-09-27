/**
 * @module widgets/container
 */
import { Widget } from './widget.js';
/**
 * Base class of widgets that contain other widgets.
 *
 * Children's elements are placed in the body element (`bodyElement`, by default the root
 * element), in child order. A container expands in a direction when one of its visible children
 * does, unless its own `hExpand`/`vExpand` says otherwise.
 *
 * Signals: `child-add` and `child-remove` (`container, child`), `focus-child-change`.
 */
export declare class Container extends Widget {
    /** @type {Widget[]} */
    _children: Widget[];
    _focusChild: any;
    _initialize(): void;
    /**
     * The element the children's elements are placed in.
     *
     * @type {HTMLElement}
     */
    get bodyElement(): HTMLElement;
    /**
     * Adds a widget at the end. A widget can only be in one container at a time.
     *
     * @param {Widget} widget
     * @returns {Widget} The widget.
     */
    addChild(widget: Widget): Widget;
    /**
     * Adds a widget at the start.
     *
     * @param {Widget} widget
     * @returns {Widget} The widget.
     */
    prependChild(widget: Widget): Widget;
    /**
     * Inserts a widget at an index.
     *
     * @param {Widget} widget
     * @param {number} index Between 0 and `childrenCount`.
     * @returns {Widget} The widget.
     */
    insertChild(widget: Widget, index: number): Widget;
    /**
     * Removes a widget. To also destroy it, call its `destroy()` instead, which removes it from its
     * container.
     *
     * @param {Widget} widget A child of this container.
     * @returns {number} The index the widget had.
     * @throws {Error} If the widget is not a child.
     */
    removeChild(widget: Widget): number;
    /**
     * Removes the child at an index.
     *
     * @param {number} index
     * @returns {Widget} The removed widget.
     */
    removeChildAt(index: number): Widget;
    /**
     * Destroys all children, like the original toolkit's `removeAllChildren()`.
     */
    removeAllChildren(): void;
    /**
     * Moves a child to another index.
     *
     * @param {Widget} widget
     * @param {number} index
     */
    reorderChild(widget: Widget, index: number): void;
    /**
     * Returns the child at an index.
     *
     * @param {number} index
     * @returns {Widget}
     * @throws {RangeError} If there is no such child.
     */
    getChild(index: number): Widget;
    /**
     * Returns the index of a child, or -1.
     *
     * @param {Widget} widget
     * @returns {number}
     */
    indexOf(widget: Widget): number;
    /**
     * Calls a function for every child, optionally for all descendants (in post-order).
     *
     * @param {(widget: Widget, index: number) => void} method
     * @param {object} [context]
     * @param {boolean} [recursive]
     */
    forEach(method: (widget: Widget, index: number) => void, context?: object, recursive?: boolean): void;
    /**
     * Finds a descendant by `name`.
     *
     * @param {string} name
     * @returns {Widget | null}
     */
    findByName(name: string): Widget | null;
    /**
     * Returns the widgets that take part in keyboard focus navigation, in order. Containers that
     * show only some children (like a notebook) override this.
     *
     * @protected
     * @returns {Widget[]}
     */
    protected _getFocusChain(): Widget[];
    /**
     * Places a child's element in the body. Containers with a custom structure override this.
     *
     * @protected
     * @param {Widget} widget
     * @param {number} index
     */
    protected _attachChildElement(widget: Widget, index: number): void;
    /**
     * Removes a child's element from the body.
     *
     * @protected
     * @param {Widget} widget
     */
    protected _detachChildElement(widget: Widget): void;
    /**
     * Called after children were added, removed or reordered.
     *
     * @protected
     */
    protected _onChildrenChange(): void;
    /**
     * Called when a child's `visible` changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    protected _onChildVisibleChange(_widget: Widget): void;
    /**
     * Called when a child's effective expand flags changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    protected _onChildExpandChange(_widget: Widget): void;
    /**
     * Called when a child's layout properties (alignment, margins, size request) changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    protected _onChildLayoutChange(_widget: Widget): void;
    _computeExpand(direction: any): boolean;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    /**
     * Sets the child that is or contains the focus widget, and so on up the tree.
     *
     * @protected
     * @param {Widget | null} widget
     */
    protected _setFocusChild(widget: Widget | null): void;
    _clearFocusChain(): void;
    destroy(): void;
}

/** The declared properties of {@link Container}. */
export interface Container {
    /**
     * The children, in order. Do not modify the array.
     */
    readonly children: any;
    /**
     * The number of children.
     */
    readonly childrenCount: any;
    /**
     * The child that is or contains the focus widget of the window, or `null`.
     */
    readonly focusChild: any;
}
