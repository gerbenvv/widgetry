/**
 * @module widgets/button
 */

import { Align, Orientation, Position } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Bin } from './bin.js';
import { Box } from './box.js';
import { attachButtonBehavior } from './button-behavior.js';
import { Image } from './image.js';
import { Label } from './label.js';
import { Widget } from './widget.js';

/**
 * Button relief styles: whether the button's frame is drawn.
 *
 * @enum {string}
 */
export const Relief = Object.freeze({
    NORMAL: 'normal', // Always draw the frame.
    NONE: 'none', // Flat: draw the frame only while hovered, pressed or active.
});

/**
 * Buttons with `isDefault`, which Enter in their window activates.
 *
 * @type {Set<Button>}
 */
const DEFAULT_BUTTONS = new Set();

/**
 * Elements in which Enter has a meaning of its own, so it never activates the default button.
 *
 * @type {string}
 */
const ENTER_ELEMENTS =
    'textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"])';

/**
 * The space in pixels between the image and the label of a button.
 *
 * @type {number}
 */
const IMAGE_SPACING = 4;

let defaultListenerInstalled = false;

function onDocumentKeyDown(event) {
    if (
        event.key !== Key.ENTER ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element) ||
        event.target.closest(ENTER_ELEMENTS)
    ) {
        return;
    }

    const window = Widget.fromElement(event.target)?.window;
    if (!window) {
        return;
    }

    for (const button of DEFAULT_BUTTONS) {
        if (button.window === window && button.isVisible && button.isSensitive) {
            event.preventDefault();
            button._behavior.activate();

            return;
        }
    }
}

function installDefaultListener() {
    if (!defaultListenerInstalled) {
        defaultListenerInstalled = true;

        // Listen on the document, after the focus widget had the chance to handle Enter.
        document.addEventListener('keydown', onDocumentKeyDown);
    }
}

/**
 * A push button. It holds one child, usually made from `label` and `icon`, and emits `activate`
 * when clicked: when the primary pointer button is released over it, when Space is released or
 * when Enter is pressed while it has the focus, or when its mnemonic is pressed.
 *
 * Setting `label`, `icon` or `useUnderline` creates the child: a label, an image, or both in a
 * box. When the child was set explicitly instead, `label` changes the text of a label child and
 * leaves other children alone.
 *
 * A button with `isDefault` is the default button of its window, as in dialogs: it gets a
 * stronger frame, and Enter activates it when the focus widget does not use Enter itself.
 * Widgets that handle Enter prevent the default of the key event, which keeps the default button
 * from activating; Enter in multi-line text never activates it.
 *
 * Signals: `activate` (`button`), and `clicked` (`button`), emitted after every click, also for
 * toggle buttons.
 */
export class Button extends Bin {
    _initialize() {
        super._initialize();

        this._content = null;
        this._contentKey = '';
        this._labelWidget = null;
        this._imageWidget = null;
        this._ownImage = null;
        this._givenImage = null;

        this._behavior = attachButtonBehavior(this, { onActivate: () => this._click() });

        // Apply the default relief, which subclasses may change.
        this.el.classList.toggle('wy-relief-none', this._relief === Relief.NONE);
    }

    _render() {
        return createElement('<div class="wy-button" role="button"></div>');
    }

    /**
     * Activates the button, as if it was clicked: emits `activate`.
     */
    activate() {
        this.emit('activate', this);
    }

    /**
     * Clicks the button: activates it and emits `clicked`. Called by the pointer, keyboard,
     * mnemonic and default-button handling.
     *
     * @protected
     */
    _click() {
        this._onClicked();

        if (!this.destroyed) {
            this.emit('clicked', this);
        }
    }

    /**
     * What a click does. Toggle buttons override this to toggle.
     *
     * @protected
     */
    _onClicked() {
        this.activate();
    }

    /**
     * Activates the button for its mnemonic: clicks it, or only focuses it when other widgets
     * share the mnemonic.
     *
     * @protected
     * @param {boolean} groupCycling Whether several widgets share the mnemonic.
     */
    _mnemonicActivate(groupCycling) {
        this.focus();

        if (!groupCycling) {
            this._behavior.activate();
        }
    }

    destroy() {
        DEFAULT_BUTTONS.delete(this);
        this._behavior.destroy();

        super.destroy();
    }

    /**
     * Returns the text for the label of the created child, or `''` for none.
     *
     * @protected
     * @returns {string}
     */
    _getContentLabel() {
        return this._label ?? '';
    }

    /**
     * Creates the label of the created child. Subclasses change its alignment.
     *
     * @protected
     * @returns {Label}
     */
    _createLabel() {
        return new Label({ hAlign: Align.CENTER });
    }

    /**
     * Creates, updates or removes the child made from `label` and `icon`.
     *
     * @protected
     */
    _syncContent() {
        const child = this.child;
        const label = this._getContentLabel();

        // A child set explicitly is kept; only the text of a label child follows `label`.
        if (child && child !== this._content) {
            if (child instanceof Label && this._label !== null) {
                child.text = label;
                child.useUnderline = this._useUnderline;
            }

            return;
        }

        const icon = this._icon;
        const key = `${label ? 'label' : ''}:${icon ? 'image' : ''}:${this._imagePosition}`;

        if (this._content && this._contentKey === key) {
            this._updateContentParts(label, icon);

            return;
        }

        this._removeContent();

        if (!label && !icon) {
            return;
        }

        this._updateContentParts(label, icon);

        let content = this._labelWidget || this._imageWidget;

        if (label && icon) {
            const position = this._imagePosition;
            const vertical = position === Position.TOP || position === Position.BOTTOM;

            content = new Box({
                orientation: vertical ? Orientation.VERTICAL : Orientation.HORIZONTAL,
                spacing: IMAGE_SPACING,
                hAlign: this._labelWidget.hAlign,
                vAlign: Align.CENTER,
            });
            content.addStyleClass('wy-button-content');

            const imageFirst = position === Position.LEFT || position === Position.TOP;
            content.addChild(imageFirst ? this._imageWidget : this._labelWidget);
            content.addChild(imageFirst ? this._labelWidget : this._imageWidget);
        }

        this._content = content;
        this._contentKey = key;
        this.addChild(content);
    }

    _updateContentParts(label, icon) {
        if (label) {
            if (!this._labelWidget) {
                this._labelWidget = this._createLabel();
            }

            this._labelWidget.set({ text: label, useUnderline: this._useUnderline });
        }

        if (icon instanceof Image) {
            this._imageWidget = icon;
        } else if (icon) {
            if (!this._ownImage) {
                this._ownImage = new Image();
            }

            this._ownImage.icon = icon;
            this._imageWidget = this._ownImage;
        }
    }

    _removeContent() {
        const content = this._content;
        const image = this._imageWidget;

        this._content = null;
        this._contentKey = '';
        this._labelWidget = null;
        this._imageWidget = null;
        this._ownImage = null;

        // An image given as `icon` belongs to the caller; take it out instead of destroying it.
        const given = image && image === this._givenImage ? image : null;
        if (given?.parent) {
            given.parent.removeChild(given);
        }

        if (content && !content.destroyed && content !== given) {
            content.destroy();
        }
    }

    _onChildrenChange() {
        super._onChildrenChange();

        // The created child was replaced or removed from outside.
        if (this._content && this.child !== this._content) {
            this._content = null;
            this._contentKey = '';
            this._labelWidget = null;
            this._imageWidget = null;
            this._ownImage = null;
        }
    }

    _setDefault(isDefault) {
        this.el.classList.toggle('wy-default', isDefault);

        if (isDefault) {
            DEFAULT_BUTTONS.add(this);
            installDefaultListener();
        } else {
            DEFAULT_BUTTONS.delete(this);
        }
    }
}

defineProperties(Button, {
    canFocus: { value: true },

    /**
     * The text of the button's label, or `null`. Setting it creates a label child (next to the
     * image of `icon`) when the button has no child of its own. Reading it returns the text of a
     * label child, or `null` if there is none.
     */
    label: {
        value: null,
        get() {
            const child = this.child;
            if (child && child !== this._content) {
                return child instanceof Label ? child.text : null;
            }

            return this._label;
        },
        coerce(label) {
            return label === null || label === undefined ? null : String(label);
        },
        changed() {
            this._syncContent();
        },
    },

    /**
     * The icon of the button: an icon name (see `Image#icon`), an `Image` widget, or `''` for
     * none. It is shown next to the label, see `imagePosition`.
     */
    icon: {
        value: '',
        coerce(icon) {
            if (icon === null || icon === undefined) {
                return '';
            }

            if (typeof icon !== 'string' && !(icon instanceof Image)) {
                throw new TypeError('A button icon must be an icon name or an Image.');
            }

            return icon;
        },
        set(icon) {
            this._removeContent();

            this._icon = icon;
            this._givenImage = icon instanceof Image ? icon : null;
            this._syncContent();
        },
    },

    /**
     * Where the image is shown relative to the label: one of `Position`.
     */
    imagePosition: {
        value: Position.LEFT,
        coerce(position) {
            if (!Object.values(Position).includes(position)) {
                throw new Error(`Invalid image position '${position}'.`);
            }

            return position;
        },
        changed() {
            this._syncContent();
        },
    },

    /**
     * Whether an underscore in `label` marks the mnemonic (`'_Open'`), which is underlined and
     * clicks the button with Alt.
     */
    useUnderline: {
        value: false,
        changed() {
            this._syncContent();
        },
    },

    /**
     * The relief style: one of `Relief`. Buttons with `Relief.NONE` are flat and show their frame
     * only while hovered or pressed, as in tool bars.
     */
    relief: {
        value: Relief.NORMAL,
        coerce(relief) {
            if (!Object.values(Relief).includes(relief)) {
                throw new Error(`Invalid relief '${relief}'.`);
            }

            return relief;
        },
        changed(relief) {
            this.el.classList.toggle('wy-relief-none', relief === Relief.NONE);
        },
    },

    /**
     * Whether this is the default button of its window, which Enter activates.
     */
    isDefault: {
        value: false,
        changed(isDefault) {
            this._setDefault(isDefault);
        },
    },
});

registerType('button', Button);
