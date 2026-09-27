/**
 * @module widgets/frame
 */

import { ShadowType } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { clamp, createElement, uniqueId } from '../core/util.js';
import {
    attachAuxiliaryWidget,
    getAuxiliaryFocusChain,
    refreshAuxiliaryWidgets,
} from './auxiliary.js';
import { Bin } from './bin.js';

/**
 * The shadow types a frame supports, for validating `shadowType`.
 *
 * @type {ReadonlySet<string>}
 */
const SHADOW_TYPES = new Set(Object.values(ShadowType));

/**
 * The smallest length in pixels of the border line on either side of the label.
 *
 * @type {number}
 */
const LABEL_INDENT = 8;

/**
 * A bin that draws a border around its child, with an optional label on the top border line,
 * like a GTK frame. The label is a text (`label`) or any widget (`labelWidget`), such as a check
 * box that enables the frame's contents.
 *
 * The label gets its natural size, and the frame is at least as wide as its label. Its position
 * along the top border is set with `labelXAlign`, from 0 (left) to 1 (right).
 *
 * @example
 * const frame = new Frame({ label: 'Indicators' });
 * frame.addChild(list);
 */
export class Frame extends Bin {
    _initialize() {
        super._initialize();

        this._releaseLabelWidget = null;

        this._syncLabel();
        this._syncLabelAlignment();
    }

    _render() {
        const labelId = uniqueId('wy-frame-label');

        const element = createElement(`
            <div class="wy-frame wy-shadow-etched-in" role="group">
                <div class="wy-frame-header">
                    <div class="wy-frame-label" id="${labelId}"></div>
                </div>
                <div class="wy-frame-body"></div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-frame-header');
        this._labelEl = element.querySelector('.wy-frame-label');
        this._bodyEl = element.querySelector('.wy-frame-body');

        return element;
    }

    destroy() {
        this._labelWidget?.destroy();

        super.destroy();
    }

    _getFocusChain() {
        return [...getAuxiliaryFocusChain(this._labelWidget), ...super._getFocusChain()];
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        refreshAuxiliaryWidgets([this._labelWidget]);
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        refreshAuxiliaryWidgets([this._labelWidget]);
    }

    _syncLabel() {
        const widget = this._labelWidget;
        const hasLabel = Boolean(widget || this._label);

        if (!widget) {
            this._labelEl.textContent = this._label;
        }

        this.el.classList.toggle('wy-has-label', hasLabel);

        if (hasLabel) {
            this.el.setAttribute('aria-labelledby', this._labelEl.id);
        } else {
            this.el.removeAttribute('aria-labelledby');
        }
    }

    _syncLabelAlignment() {
        const start = this._labelXAlign;

        this._headerEl.style.gridTemplateColumns =
            `minmax(${LABEL_INDENT}px, ${start}fr) auto ` +
            `minmax(${LABEL_INDENT}px, ${1 - start}fr)`;
    }

    _onLabelWidgetDestroy() {
        this._releaseLabelWidget = null;
        this.labelWidget = null;
    }
}

defineProperties(Frame, {
    /**
     * The text of the label, shown bold on the top border. It is not shown while there is a
     * `labelWidget`, and reads as `null` then, like in the original toolkit.
     */
    label: {
        value: '',
        coerce(label) {
            return label === null || label === undefined ? '' : String(label);
        },
        get() {
            return this._labelWidget ? null : this._label;
        },
        changed() {
            this._syncLabel();
        },
    },

    /**
     * A widget to show as the label instead of the text, or `null`. The frame owns it: it is
     * destroyed with the frame, and destroying it removes it from the frame.
     */
    labelWidget: {
        value: null,
        set(widget) {
            if (this._releaseLabelWidget) {
                this._releaseLabelWidget();
                this._releaseLabelWidget = null;
            }

            this._labelWidget = widget || null;
            this._labelEl.textContent = '';

            if (widget) {
                this._releaseLabelWidget = attachAuxiliaryWidget(this, widget, this._labelEl, () =>
                    this._onLabelWidgetDestroy()
                );
            }

            this._syncLabel();
        },
    },

    /**
     * The position of the label along the top border, from 0 (at the left) to 1 (at the right).
     * The label keeps its natural size.
     */
    labelXAlign: {
        value: 0.5,
        coerce(align) {
            const value = Number(align);
            if (!Number.isFinite(value)) {
                throw new TypeError(`Invalid label alignment: ${align}.`);
            }

            return clamp(value, 0, 1);
        },
        changed() {
            this._syncLabelAlignment();
        },
    },

    /**
     * The original toolkit's name of `labelXAlign`.
     */
    labelHAlign: {
        signal: false,
        get() {
            return this._labelXAlign;
        },
        set(align) {
            this.labelXAlign = align;

            return false;
        },
    },

    /**
     * The style of the border: one of `ShadowType`. Defaults to an etched line, like GTK.
     */
    shadowType: {
        value: ShadowType.ETCHED_IN,
        coerce(shadowType) {
            if (!SHADOW_TYPES.has(shadowType)) {
                throw new TypeError(`Invalid shadow type: ${shadowType}.`);
            }

            return shadowType;
        },
        changed(shadowType, oldShadowType) {
            this.el.classList.remove(`wy-shadow-${oldShadowType}`);
            this.el.classList.add(`wy-shadow-${shadowType}`);
        },
    },
});

registerType('frame', Frame);
