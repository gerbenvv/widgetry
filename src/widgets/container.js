/**
 * @module widgets/container
 */

import { defineProperties } from '../core/instance.js';
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
export class Container extends Widget {
    _initialize() {
        /** @type {Widget[]} */
        this._children = [];

        super._initialize();

        this.el.classList.add('wy-container');
    }

    /**
     * The element the children's elements are placed in.
     *
     * @type {HTMLElement}
     */
    get bodyElement() {
        return this._bodyEl || this.el;
    }

    /**
     * Adds a widget at the end. A widget can only be in one container at a time.
     *
     * @param {Widget} widget
     * @returns {Widget} The widget.
     */
    addChild(widget) {
        return this.insertChild(widget, this._children.length);
    }

    /**
     * Adds a widget at the start.
     *
     * @param {Widget} widget
     * @returns {Widget} The widget.
     */
    prependChild(widget) {
        return this.insertChild(widget, 0);
    }

    /**
     * Inserts a widget at an index.
     *
     * @param {Widget} widget
     * @param {number} index Between 0 and `childrenCount`.
     * @returns {Widget} The widget.
     */
    insertChild(widget, index) {
        if (!(widget instanceof Widget)) {
            throw new TypeError('Only widgets can be added to a container.');
        }

        if (index < 0 || index > this._children.length) {
            throw new RangeError(`Invalid child index ${index}.`);
        }

        widget._setParent(this);

        this._children.splice(index, 0, widget);
        this._attachChildElement(widget, index);

        widget._onParented();

        this._onChildrenChange();
        this.emit('child-add', this, widget);

        return widget;
    }

    /**
     * Removes a widget. To also destroy it, call its `destroy()` instead, which removes it from its
     * container.
     *
     * @param {Widget} widget A child of this container.
     * @returns {number} The index the widget had.
     * @throws {Error} If the widget is not a child.
     */
    removeChild(widget) {
        const index = this._children.indexOf(widget);
        if (index < 0) {
            throw new Error('The widget is not a child of this container.');
        }

        this._children.splice(index, 1);
        this._detachChildElement(widget);

        widget._setParent(null);

        if (this._focusChild === widget) {
            this._setFocusChild(null);
        }

        this._onChildrenChange();
        this.emit('child-remove', this, widget);

        return index;
    }

    /**
     * Removes the child at an index.
     *
     * @param {number} index
     * @returns {Widget} The removed widget.
     */
    removeChildAt(index) {
        const widget = this.getChild(index);
        this.removeChild(widget);

        return widget;
    }

    /**
     * Destroys all children, like the original toolkit's `removeAllChildren()`.
     */
    removeAllChildren() {
        for (const widget of [...this._children].reverse()) {
            widget.destroy();
        }
    }

    /**
     * Moves a child to another index.
     *
     * @param {Widget} widget
     * @param {number} index
     */
    reorderChild(widget, index) {
        const oldIndex = this._children.indexOf(widget);
        if (oldIndex < 0) {
            throw new Error('The widget is not a child of this container.');
        }

        this._children.splice(oldIndex, 1);
        index = Math.max(0, Math.min(index, this._children.length));
        this._children.splice(index, 0, widget);

        this._detachChildElement(widget);
        this._attachChildElement(widget, index);

        this._onChildrenChange();
    }

    /**
     * Returns the child at an index.
     *
     * @param {number} index
     * @returns {Widget}
     * @throws {RangeError} If there is no such child.
     */
    getChild(index) {
        const widget = this._children[index];
        if (!widget) {
            throw new RangeError(`There is no child at index ${index}.`);
        }

        return widget;
    }

    /**
     * Returns the index of a child, or -1.
     *
     * @param {Widget} widget
     * @returns {number}
     */
    indexOf(widget) {
        return this._children.indexOf(widget);
    }

    /**
     * Calls a function for every child, optionally for all descendants (in post-order).
     *
     * @param {(widget: Widget, index: number) => void} method
     * @param {object} [context]
     * @param {boolean} [recursive]
     */
    forEach(method, context, recursive = false) {
        this._children.forEach((child, index) => {
            if (recursive && child instanceof Container) {
                child.forEach(method, context, true);
            }

            method.call(context, child, index);
        });
    }

    /**
     * Finds a descendant by `name`.
     *
     * @param {string} name
     * @returns {Widget | null}
     */
    findByName(name) {
        for (const child of this._children) {
            if (child.name === name) {
                return child;
            }

            if (child instanceof Container) {
                const result = child.findByName(name);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Returns the widgets that take part in keyboard focus navigation, in order. Containers that
     * show only some children (like a notebook) override this.
     *
     * @protected
     * @returns {Widget[]}
     */
    _getFocusChain() {
        const chain = [];

        for (const child of this._children) {
            if (!child.isVisible || !child.isSensitive) {
                continue;
            }

            if (child.canFocus) {
                chain.push(child);
            }

            if (child instanceof Container) {
                chain.push(...child._getFocusChain());
            }
        }

        return chain;
    }

    /**
     * Places a child's element in the body. Containers with a custom structure override this.
     *
     * @protected
     * @param {Widget} widget
     * @param {number} index
     */
    _attachChildElement(widget, index) {
        const next = this._children[index + 1];
        this.bodyElement.insertBefore(widget.el, next ? next.el : null);
    }

    /**
     * Removes a child's element from the body.
     *
     * @protected
     * @param {Widget} widget
     */
    _detachChildElement(widget) {
        widget.el.remove();
    }

    /**
     * Called after children were added, removed or reordered.
     *
     * @protected
     */
    _onChildrenChange() {
        this._refreshExpand();
        this._queueLayout();
    }

    /**
     * Called when a child's `visible` changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    _onChildVisibleChange(_widget) {
        this._refreshExpand();
        this._queueLayout();
    }

    /**
     * Called when a child's effective expand flags changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    _onChildExpandChange(_widget) {
        this._refreshExpand();
        this._queueLayout();
    }

    /**
     * Called when a child's layout properties (alignment, margins, size request) changed.
     *
     * @protected
     * @param {Widget} _widget
     */
    _onChildLayoutChange(_widget) {
        this._queueLayout();
    }

    _computeExpand(direction) {
        const property = direction === 'h' ? 'isHExpand' : 'isVExpand';

        return this._children.some((child) => child.visible && child[property]);
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        for (const child of this._children) {
            child._recalculateVisibility();
        }
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        for (const child of this._children) {
            child._recalculateSensitivity();
        }
    }

    /**
     * Sets the child that is or contains the focus widget, and so on up the tree.
     *
     * @protected
     * @param {Widget | null} widget
     */
    _setFocusChild(widget) {
        if (this._focusChild === widget) {
            return;
        }

        const old = this._focusChild;
        this._focusChild = widget;

        // Clear the old chain below us, without walking back up.
        if (old instanceof Container && old._focusChild) {
            old._focusChild = null;
            old._clearFocusChain();
        }

        this.emit('focus-child-change', this);
    }

    _clearFocusChain() {
        const old = this._focusChild;
        this._focusChild = null;

        if (old instanceof Container) {
            old._clearFocusChain();
        }

        this.emit('focus-child-change', this);
    }

    destroy() {
        // Destroy the children first, so they can still reach their window.
        for (const widget of [...this._children].reverse()) {
            widget.destroy();
        }

        super.destroy();
    }
}

defineProperties(Container, {
    /**
     * The children, in order. Do not modify the array.
     */
    children: {
        readOnly: true,
        get() {
            return this._children;
        },
    },

    /**
     * The number of children.
     */
    childrenCount: {
        readOnly: true,
        get() {
            return this._children.length;
        },
    },

    /**
     * The child that is or contains the focus widget of the window, or `null`.
     */
    focusChild: { value: null, readOnly: true },
});
