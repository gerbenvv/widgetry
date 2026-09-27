/**
 * @module widgets/line-edit
 */

import { Align, Justification, ShadowType } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { getIcon } from '../icons/icons.js';
import { Widget } from './widget.js';

/**
 * The positions of the icons of a line edit.
 *
 * @enum {string}
 */
export const EntryIconPosition = Object.freeze({
    PRIMARY: 'primary', // At the start (the left in left-to-right text).
    SECONDARY: 'secondary', // At the end.
});

/**
 * @typedef {object} Validator
 * @property {(text: string) => boolean} validate Whether a text is valid.
 * @property {(text: string) => string} [fixup] Optionally corrects an invalid text. It runs when
 *     the line edit is activated or loses the focus while its text is invalid.
 */

/**
 * Checks that a value can be used as a validator.
 *
 * @param {unknown} validator
 * @returns {Validator | ((text: string) => boolean) | null}
 */
function checkValidator(validator) {
    if (validator === null || validator === undefined) {
        return null;
    }

    if (
        typeof validator === 'function' ||
        typeof validator?.validate === 'function' ||
        typeof validator?.isValid === 'function'
    ) {
        return validator;
    }

    throw new TypeError('A validator must be a function or have a validate(text) method.');
}

/**
 * A single-line text entry.
 *
 * The line edit wraps a native `<input>`, which is its focus element, so typing, selecting,
 * the clipboard, undo and input methods work as usual. It can hide its text (for passwords), limit
 * its length, validate its text and show icons at both ends, such as a clear button.
 *
 * A line edit that is not `editable`, or not sensitive, cannot be changed by the user. A non-editable
 * line edit can still be focused, and its text selected and copied.
 *
 * Signals: `change` (`lineEdit`, whenever the text changed), `activate` (`lineEdit`, Enter was
 * pressed), `icon-press` and `icon-release` (`lineEdit, position, event`), with an
 * `EntryIconPosition`.
 *
 * @example
 * const search = new LineEdit({ placeholder: 'Search', secondaryIcon: 'edit-clear' });
 * search.connect('icon-press', () => (search.text = ''));
 */
export class LineEdit extends Widget {
    _initialize() {
        super._initialize();

        this._validatorDisconnect = null;

        this._inputEl.addEventListener('input', () => this._onInput());
        this._inputEl.addEventListener('keydown', (event) => this._onInputKeyDown(event));
        this._inputEl.addEventListener('blur', () => this._onInputBlur());

        for (const position of Object.values(EntryIconPosition)) {
            const iconEl = this._iconEls[position];

            iconEl.addEventListener('pointerdown', (event) => {
                if (this._isIconActivatable(position)) {
                    this.emit('icon-press', this, position, event);
                }
            });

            iconEl.addEventListener('pointerup', (event) => {
                if (this._isIconActivatable(position)) {
                    this.emit('icon-release', this, position, event);
                }
            });
        }

        this._updateEditable();
        this._updateAlignment();
    }

    _render() {
        const element = createElement(`
            <div class="wy-line-edit wy-entry">
                <span class="wy-line-edit-icon wy-primary" hidden></span>
                <input class="wy-line-edit-input" type="text" autocomplete="off" spellcheck="false" />
                <span class="wy-line-edit-icon wy-secondary" hidden></span>
            </div>
        `);

        this._inputEl = element.querySelector('input');
        this._iconEls = {
            [EntryIconPosition.PRIMARY]: element.querySelector('.wy-primary'),
            [EntryIconPosition.SECONDARY]: element.querySelector('.wy-secondary'),
        };

        return element;
    }

    /**
     * The native input element.
     *
     * @type {HTMLInputElement}
     */
    get focusElement() {
        return this._inputEl;
    }

    /**
     * Emits `activate`, as pressing Enter does. An invalid text is corrected first if the
     * validator can fix it up.
     */
    activate() {
        this._fixup();

        this.emit('activate', this);
    }

    destroy() {
        this._validatorDisconnect?.();
        this._validatorDisconnect = null;

        super.destroy();
    }

    /**
     * Selects a range of characters. The selection is kept when the line edit gets the focus.
     *
     * @param {number} start The first character.
     * @param {number} [end] The character after the last one, or -1 (the default) for the end of
     *     the text. When smaller than `start`, the selection extends backward.
     */
    selectRegion(start, end = -1) {
        const length = this._inputEl.value.length;

        start = Math.max(0, Math.min(start, length));
        end = end < 0 ? length : Math.min(end, length);

        if (end < start) {
            this._inputEl.setSelectionRange(end, start, 'backward');
        } else {
            this._inputEl.setSelectionRange(start, end);
        }
    }

    /**
     * Selects all text.
     */
    selectAll() {
        this.selectRegion(0, -1);
    }

    /**
     * Returns the selected range, or `null` if nothing is selected.
     *
     * @returns {{start: number, end: number} | null}
     */
    getSelectionBounds() {
        const start = this._inputEl.selectionStart ?? 0;
        const end = this._inputEl.selectionEnd ?? 0;

        return start === end ? null : { start, end };
    }

    /**
     * Returns the selected text, or `''`.
     *
     * @returns {string}
     */
    getSelectedText() {
        const bounds = this.getSelectionBounds();

        return bounds ? this._inputEl.value.slice(bounds.start, bounds.end) : '';
    }

    /**
     * Inserts text at a position, as if typed there (subject to `maxLength`).
     *
     * @param {string} text
     * @param {number} [position] The character to insert before, or -1 (the default) for the
     *     cursor position.
     * @returns {number} The position after the inserted text.
     */
    insertText(text, position = -1) {
        const value = this._inputEl.value;
        const at = position < 0 ? (this._inputEl.selectionStart ?? value.length) : position;
        const index = Math.max(0, Math.min(at, value.length));

        let inserted = String(text);
        if (this._maxLength > 0) {
            inserted = inserted.slice(0, Math.max(0, this._maxLength - value.length));
        }

        this.text = value.slice(0, index) + inserted + value.slice(index);

        const end = index + inserted.length;
        this._inputEl.setSelectionRange(end, end);

        return end;
    }

    /**
     * Deletes a range of characters.
     *
     * @param {number} start
     * @param {number} [end] The character after the last one, or -1 (the default) for the end.
     */
    deleteText(start, end = -1) {
        const value = this._inputEl.value;

        start = Math.max(0, Math.min(start, value.length));
        end = end < 0 ? value.length : Math.max(start, Math.min(end, value.length));

        this.text = value.slice(0, start) + value.slice(end);
        this._inputEl.setSelectionRange(start, start);
    }

    /**
     * Deletes the selected text, if any.
     */
    deleteSelection() {
        const bounds = this.getSelectionBounds();
        if (bounds) {
            this.deleteText(bounds.start, bounds.end);
        }
    }

    /**
     * Checks a text with the validator. Subclasses extend this with their own rules.
     *
     * @protected
     * @param {string} text
     * @returns {boolean}
     */
    _validate(text) {
        const validator = this._validator;
        if (!validator) {
            return true;
        }

        if (typeof validator === 'function') {
            return Boolean(validator(text));
        }

        if (typeof validator.validate === 'function') {
            return Boolean(validator.validate(text));
        }

        return Boolean(validator.isValid(text));
    }

    /**
     * Validates the current text and updates `isValid` and the invalid state.
     *
     * @protected
     */
    _revalidate() {
        const valid = this._validate(this._text);

        this.el.classList.toggle('wy-invalid', !valid);

        if (valid) {
            this._inputEl.removeAttribute('aria-invalid');
        } else {
            this._inputEl.setAttribute('aria-invalid', 'true');
        }

        if (valid !== this._isValid) {
            this._isValid = valid;

            this.emit('is-valid-change', this);
        }
    }

    /**
     * Lets the validator correct an invalid text.
     *
     * @protected
     */
    _fixup() {
        const validator = this._validator;
        if (this._isValid || typeof validator?.fixup !== 'function') {
            return;
        }

        const fixed = validator.fixup(this._text);
        if (typeof fixed === 'string') {
            this.text = fixed;
        }
    }

    /**
     * Called after the text changed, by the user or programmatically. Emits `change`.
     *
     * @protected
     * @param {string} _text
     */
    _onTextChange(_text) {
        this.emit('change', this);
    }

    /**
     * Puts a text in the input. When the input has the focus, the selection is kept as far as
     * possible, and a cursor at the end of the text stays at the end.
     *
     * @protected
     * @param {string} text
     */
    _setInputValue(text) {
        const input = this._inputEl;
        if (input.value === text) {
            return;
        }

        if (document.activeElement !== input) {
            input.value = text;

            return;
        }

        const oldLength = input.value.length;
        const start = input.selectionStart ?? oldLength;
        const end = input.selectionEnd ?? oldLength;
        const direction = input.selectionDirection || 'none';

        input.value = text;

        if (start === oldLength && end === oldLength) {
            input.setSelectionRange(text.length, text.length);
        } else {
            input.setSelectionRange(
                Math.min(start, text.length),
                Math.min(end, text.length),
                direction
            );
        }
    }

    _isIconActivatable(position) {
        return (
            this.isSensitive &&
            Boolean(this[`_${position}Icon`]) &&
            this[`_${position}IconActivatable`]
        );
    }

    _updateIcon(position) {
        const element = this._iconEls[position];
        const name = this[`_${position}Icon`];
        const tooltip = this[`_${position}IconTooltip`];
        const activatable = this[`_${position}IconActivatable`];

        element.hidden = !name;
        element.innerHTML = name ? getIcon(name) || '' : '';
        element.classList.toggle('wy-activatable', activatable);
        element.title = tooltip || '';

        // Only an activatable icon with a tooltip is exposed to assistive technology.
        if (name && activatable && tooltip) {
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', tooltip);
            element.removeAttribute('aria-hidden');
        } else {
            element.removeAttribute('role');
            element.removeAttribute('aria-label');
            element.setAttribute('aria-hidden', 'true');
        }

        this.el.classList.toggle(`wy-has-${position}-icon`, Boolean(name));
    }

    _updateEditable() {
        const editable = this._editable && this.isSensitive;

        this._inputEl.readOnly = !editable;
        this.el.classList.toggle('wy-read-only', !this._editable);

        if (this._editable) {
            this._inputEl.removeAttribute('aria-readonly');
        } else {
            this._inputEl.setAttribute('aria-readonly', 'true');
        }

        if (editable !== this._isEditable) {
            this._isEditable = editable;

            this.emit('is-editable-change', this);
        }
    }

    _updateAlignment() {
        const xAlign = this._xAlign;
        const align = xAlign <= 0.25 ? 'start' : xAlign >= 0.75 ? 'end' : 'center';

        this._inputEl.style.textAlign = align === 'start' ? '' : align;
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        this._updateEditable();
    }

    _onInput() {
        const value = this._inputEl.value;

        this.text = value;

        // The text may have been changed by coercion (such as the maximum length).
        this._setInputValue(this._text);
    }

    _onInputKeyDown(event) {
        if (event.key === Key.ENTER && !event.isComposing && !event.altKey && !event.ctrlKey) {
            this.activate();
        }
    }

    _onInputBlur() {
        this._fixup();
    }
}

defineProperties(LineEdit, {
    canFocus: { value: true },

    vAlign: { value: Align.CENTER },

    /**
     * The text.
     */
    text: {
        value: '',
        coerce(text) {
            text = text === null || text === undefined ? '' : String(text);

            // Single-line text: line breaks (e.g. when pasted) become spaces.
            text = text.replace(/\r\n|[\r\n]/g, ' ');

            if (this._maxLength > 0 && text.length > this._maxLength) {
                text = text.slice(0, this._maxLength);
            }

            return text;
        },
        changed(text) {
            this._setInputValue(text);
            this._revalidate();
            this._onTextChange(text);
        },
    },

    /**
     * The value: the text, or `null` if it is not valid. Setting it sets the text.
     */
    value: {
        signal: false,
        get() {
            return this._isValid ? this._text : null;
        },
        set(value) {
            this.text = value;

            return false;
        },
    },

    /**
     * Text shown while the line edit is empty, as a hint.
     */
    placeholder: {
        value: '',
        changed(placeholder) {
            this._inputEl.placeholder = placeholder || '';
        },
    },

    /**
     * Whether the user can change the text. A line edit that is not sensitive is never editable.
     */
    editable: {
        value: true,
        coerce: Boolean,
        changed() {
            this._updateEditable();
        },
    },

    /**
     * Whether the user can currently change the text: it is `editable` and sensitive.
     */
    isEditable: { value: true, readOnly: true },

    /**
     * Whether the text is shown. When `false`, the line edit is a password entry that shows every
     * character as a dot.
     */
    visibility: {
        value: true,
        coerce: Boolean,
        changed(visibility) {
            // Changing the type keeps the element, and so the focus; keep the selection as well.
            const input = this._inputEl;
            const focused = document.activeElement === input;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const direction = input.selectionDirection || 'none';

            input.type = visibility ? 'text' : 'password';

            if (focused && start !== null) {
                input.setSelectionRange(start, end, direction);
            }
        },
    },

    /**
     * The maximum number of characters, or 0 for no limit. A longer text is truncated.
     */
    maxLength: {
        value: 0,
        coerce(maxLength) {
            return Math.max(0, Math.floor(Number(maxLength) || 0));
        },
        changed(maxLength) {
            if (maxLength > 0) {
                this._inputEl.maxLength = maxLength;
            } else {
                this._inputEl.removeAttribute('maxlength');
            }

            if (maxLength > 0 && this._text.length > maxLength) {
                this.text = this._text.slice(0, maxLength);
            }
        },
    },

    /**
     * The natural width in characters, or -1 for the default width.
     */
    widthChars: {
        value: -1,
        coerce(widthChars) {
            return Math.max(-1, Math.floor(Number(widthChars)));
        },
        changed(widthChars) {
            this.el.style.setProperty(
                '--wy-entry-width',
                widthChars >= 0 ? `calc(${widthChars}ch + 2px)` : null
            );
        },
    },

    /**
     * The horizontal alignment of the text, from 0 (at the start) to 1 (at the end).
     */
    xAlign: {
        value: 0,
        coerce(xAlign) {
            const value = Number(xAlign);
            if (!Number.isFinite(value)) {
                throw new RangeError(`Invalid alignment ${xAlign}.`);
            }

            return Math.max(0, Math.min(1, value));
        },
        changed() {
            this._updateAlignment();
            this.emit('alignment-change', this);
        },
    },

    /**
     * The alignment of the text as a `Justification`: `START`, `CENTER` or `END`. The same as
     * `xAlign` 0, 0.5 or 1.
     */
    alignment: {
        signal: false,
        get() {
            return this._xAlign <= 0.25
                ? Justification.START
                : this._xAlign >= 0.75
                  ? Justification.END
                  : Justification.CENTER;
        },
        set(alignment) {
            const xAligns = {
                [Justification.START]: 0,
                [Justification.FILL]: 0,
                [Justification.CENTER]: 0.5,
                [Justification.END]: 1,
            };

            if (!(alignment in xAligns)) {
                throw new RangeError(`Invalid alignment '${alignment}'.`);
            }

            this.xAlign = xAligns[alignment];

            return false;
        },
    },

    /**
     * Whether the line edit has a frame. Without one it blends into its surroundings, e.g. when
     * editing a table cell.
     */
    hasFrame: {
        value: true,
        coerce: Boolean,
        changed(hasFrame) {
            this.el.classList.toggle('wy-no-frame', !hasFrame);
        },
    },

    /**
     * The border style: one of `ShadowType`. `NONE` is the same as having no frame.
     */
    shadowType: {
        value: ShadowType.IN,
        coerce(shadowType) {
            if (!Object.values(ShadowType).includes(shadowType)) {
                throw new RangeError(`Invalid shadow type '${shadowType}'.`);
            }

            return shadowType;
        },
        changed(shadowType) {
            this.el.classList.toggle('wy-shadow-none', shadowType === ShadowType.NONE);
        },
    },

    /**
     * The validator of the text, or `null`: an object with a `validate(text)` method (and
     * optionally `fixup(text)`), or a function. An invalid text is shown in the invalid state.
     * The text is validated again when a validator with a `change` signal (such as the
     * validators of `data/validators`) emits it.
     */
    validator: {
        value: null,
        coerce: checkValidator,
        changed(validator) {
            this._validatorDisconnect?.();
            this._validatorDisconnect = null;

            if (typeof validator?.connect === 'function') {
                this._validatorDisconnect = validator.connect('change', () => this._revalidate());
            }

            this._revalidate();
        },
    },

    /**
     * Whether the text is valid according to the validator.
     */
    isValid: { value: true, readOnly: true },

    /**
     * The name of the icon at the start, or `''` for none.
     */
    primaryIcon: {
        value: '',
        coerce: (name) => name || '',
        changed() {
            this._updateIcon(EntryIconPosition.PRIMARY);
        },
    },

    /**
     * The name of the icon at the end, or `''` for none.
     */
    secondaryIcon: {
        value: '',
        coerce: (name) => name || '',
        changed() {
            this._updateIcon(EntryIconPosition.SECONDARY);
        },
    },

    /**
     * Whether the icon at the start emits `icon-press` and `icon-release`.
     */
    primaryIconActivatable: {
        value: true,
        coerce: Boolean,
        changed() {
            this._updateIcon(EntryIconPosition.PRIMARY);
        },
    },

    /**
     * Whether the icon at the end emits `icon-press` and `icon-release`.
     */
    secondaryIconActivatable: {
        value: true,
        coerce: Boolean,
        changed() {
            this._updateIcon(EntryIconPosition.SECONDARY);
        },
    },

    /**
     * The tooltip (and accessible name) of the icon at the start.
     */
    primaryIconTooltip: {
        value: '',
        changed() {
            this._updateIcon(EntryIconPosition.PRIMARY);
        },
    },

    /**
     * The tooltip (and accessible name) of the icon at the end.
     */
    secondaryIconTooltip: {
        value: '',
        changed() {
            this._updateIcon(EntryIconPosition.SECONDARY);
        },
    },

    /**
     * The cursor position, as a character index.
     */
    cursorPosition: {
        signal: false,
        get() {
            return this._inputEl.selectionEnd ?? this._inputEl.value.length;
        },
        set(position) {
            const index = Math.max(0, Math.min(Number(position) || 0, this._inputEl.value.length));
            this._inputEl.setSelectionRange(index, index);

            return false;
        },
    },
});

registerType('line-edit', LineEdit);
