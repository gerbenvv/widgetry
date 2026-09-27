/**
 * @module widgets/expander
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import {
    attachAuxiliaryWidget,
    getAuxiliaryFocusChain,
    refreshAuxiliaryWidgets,
} from './auxiliary.js';
import { Bin } from './bin.js';

/**
 * A bin that shows or hides its child when its title is clicked, with a triangle that points
 * right when collapsed and down when expanded, like GTK's expander.
 *
 * The title is a text (`label`) or any widget (`labelWidget`). The title takes the keyboard
 * focus; Enter and Space toggle it.
 *
 * Signals: `activate` when the user toggles the expander (or `activate()` is called), and
 * `expanded-change`.
 */
export class Expander extends Bin {
    _initialize() {
        super._initialize();

        this._releaseLabelWidget = null;

        this._headerEl.addEventListener('click', (event) => this._onHeaderClick(event));
        this._headerEl.addEventListener('keydown', (event) => this._onHeaderKeyDown(event));

        this._syncExpanded();
        this._syncSpacing();
    }

    _render() {
        const bodyId = uniqueId('wy-expander-body');

        const element = createElement(`
            <div class="wy-expander">
                <div class="wy-expander-header" role="button" aria-expanded="false" aria-controls="${bodyId}">
                    <span class="wy-expander-arrow" aria-hidden="true"></span>
                    <span class="wy-expander-label"></span>
                </div>
                <div class="wy-expander-body" id="${bodyId}"></div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-expander-header');
        this._labelEl = element.querySelector('.wy-expander-label');
        this._bodyEl = element.querySelector('.wy-expander-body');

        return element;
    }

    /**
     * The title, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._headerEl;
    }

    /**
     * Toggles the expander, as a click on its title does, and emits `activate`.
     */
    activate() {
        this.expanded = !this._expanded;

        this.emit('activate', this);
    }

    destroy() {
        this._labelWidget?.destroy();

        super.destroy();
    }

    _getFocusChain() {
        const chain = getAuxiliaryFocusChain(this._labelWidget);

        return this._expanded ? [...chain, ...super._getFocusChain()] : chain;
    }

    _computeExpand(direction) {
        // A collapsed expander does not take extra space for its hidden child.
        return this._expanded && super._computeExpand(direction);
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        refreshAuxiliaryWidgets([this._labelWidget]);
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        refreshAuxiliaryWidgets([this._labelWidget]);
    }

    _syncExpanded() {
        const expanded = this._expanded;

        this.el.classList.toggle('wy-expanded', expanded);
        this._headerEl.setAttribute('aria-expanded', String(expanded));
        this._bodyEl.hidden = !expanded;

        this._refreshExpand();

        // Move the focus out of the child when it is hidden.
        const focusWidget = this.window?.focusWidget;
        if (!expanded && this.child && focusWidget && this.child.isAncestorOf(focusWidget)) {
            this.focus();
        }
    }

    _syncSpacing() {
        this.el.style.rowGap = this._spacing ? `${this._spacing}px` : '';
    }

    _onHeaderClick(event) {
        if (!this.isSensitive) {
            return;
        }

        // Leave clicks on an interactive label widget to that widget.
        const widget = this._labelWidget;
        if (widget && widget.canFocus && widget.el.contains(event.target)) {
            return;
        }

        this.focus();
        this.activate();
    }

    _onHeaderKeyDown(event) {
        if (event.target !== this._headerEl || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        if (event.key === Key.ENTER || event.key === Key.SPACE) {
            event.preventDefault();
            event.stopPropagation();

            this.activate();
        } else if (event.key === Key.RIGHT && !this._expanded) {
            event.preventDefault();
            this.activate();
        } else if (event.key === Key.LEFT && this._expanded) {
            event.preventDefault();
            this.activate();
        }
    }

    _onLabelWidgetDestroy() {
        this._releaseLabelWidget = null;
        this.labelWidget = null;
    }
}

defineProperties(Expander, {
    /**
     * Expanders take the keyboard focus on their title.
     */
    canFocus: { value: true },

    /**
     * Whether the child is shown.
     */
    expanded: {
        value: false,
        coerce: Boolean,
        changed() {
            this._syncExpanded();
        },
    },

    /**
     * The text of the title. It is not shown while there is a `labelWidget`, and reads as `null`
     * then.
     */
    label: {
        value: '',
        coerce(label) {
            return label === null || label === undefined ? '' : String(label);
        },
        get() {
            return this._labelWidget ? null : this._label;
        },
        changed(label) {
            if (!this._labelWidget) {
                this._labelEl.textContent = label;
            }
        },
    },

    /**
     * A widget to show as the title instead of the text, or `null`. The expander owns it.
     */
    labelWidget: {
        value: null,
        set(widget) {
            if (this._releaseLabelWidget) {
                this._releaseLabelWidget();
                this._releaseLabelWidget = null;
            }

            this._labelWidget = widget || null;
            this._labelEl.textContent = widget ? '' : this._label;

            if (widget) {
                this._releaseLabelWidget = attachAuxiliaryWidget(this, widget, this._labelEl, () =>
                    this._onLabelWidgetDestroy()
                );
            }
        },
    },

    /**
     * The space between the title and the child, in pixels.
     */
    spacing: {
        value: 0,
        changed() {
            this._syncSpacing();
        },
    },
});

registerType('expander', Expander);
