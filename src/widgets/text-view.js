/**
 * @module widgets/text-view
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Widget } from './widget.js';

/**
 * How a text view wraps lines that are too long.
 *
 * @enum {string}
 */
export const WrapMode = Object.freeze({
    NONE: 'none', // Do not wrap; scroll horizontally instead.
    CHAR: 'char', // Wrap between any two characters.
    WORD: 'word', // Wrap between words; a word longer than a line overflows.
    WORD_CHAR: 'word-char', // Wrap between words, and within words that do not fit on a line.
});

/**
 * A multi-line text editor, with the same frame as a line edit.
 *
 * The text view wraps a native `<textarea>`, which is its focus element. It scrolls its text
 * itself. Give it a size request or let it expand to make it larger than its default of a few
 * lines.
 *
 * Signals: `change` (`textView`, whenever the text changed).
 */
export class TextView extends Widget {
    _initialize() {
        super._initialize();

        this._textAreaEl.addEventListener('input', () => {
            this.text = this._textAreaEl.value;
        });

        this._textAreaEl.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._updateEditable();
        this._updateWrapMode();
    }

    _render() {
        const element = createElement(`
            <div class="wy-text-view wy-entry">
                <textarea class="wy-text-view-input" rows="4" cols="32" spellcheck="false"></textarea>
            </div>
        `);

        this._textAreaEl = element.querySelector('textarea');

        return element;
    }

    /**
     * The native textarea element.
     *
     * @type {HTMLTextAreaElement}
     */
    get focusElement() {
        return this._textAreaEl;
    }

    /**
     * Selects a range of characters.
     *
     * @param {number} start
     * @param {number} [end] The character after the last one, or -1 (the default) for the end.
     */
    selectRegion(start, end = -1) {
        const length = this._textAreaEl.value.length;

        start = Math.max(0, Math.min(start, length));
        end = end < 0 ? length : Math.min(end, length);

        if (end < start) {
            this._textAreaEl.setSelectionRange(end, start, 'backward');
        } else {
            this._textAreaEl.setSelectionRange(start, end);
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
        const start = this._textAreaEl.selectionStart;
        const end = this._textAreaEl.selectionEnd;

        return start === end ? null : { start, end };
    }

    /**
     * Returns the selected text, or `''`.
     *
     * @returns {string}
     */
    getSelectedText() {
        const bounds = this.getSelectionBounds();

        return bounds ? this._textAreaEl.value.slice(bounds.start, bounds.end) : '';
    }

    /**
     * Inserts text at the cursor, replacing the selection, as if typed.
     *
     * @param {string} text
     */
    insertAtCursor(text) {
        const area = this._textAreaEl;

        area.setRangeText(String(text), area.selectionStart, area.selectionEnd, 'end');

        this.text = area.value;
    }

    _updateEditable() {
        const editable = this._editable && this.isSensitive;

        this._textAreaEl.readOnly = !editable;
        this.el.classList.toggle('wy-read-only', !this._editable);

        if (editable !== this._isEditable) {
            this._isEditable = editable;

            this.emit('is-editable-change', this);
        }
    }

    _updateWrapMode() {
        const mode = this._wrapMode;

        this._textAreaEl.wrap = mode === WrapMode.NONE ? 'off' : 'soft';
        this.el.dataset.wrap = mode;
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        this._updateEditable();
    }

    _onKeyDown(event) {
        if (
            event.key !== Key.TAB ||
            !this._acceptsTab ||
            !this._isEditable ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return;
        }

        // Insert a tab instead of moving the focus; Shift+Tab still moves the focus backward.
        event.preventDefault();

        this.insertAtCursor('\t');
    }
}

defineProperties(TextView, {
    canFocus: { value: true },

    /**
     * The text.
     */
    text: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text).replace(/\r\n?/g, '\n');
        },
        changed(text) {
            const area = this._textAreaEl;
            if (area.value !== text) {
                // Keep the selection as far as possible when the text is set programmatically.
                const start = area.selectionStart;
                const end = area.selectionEnd;

                area.value = text;

                if (document.activeElement === area) {
                    area.setSelectionRange(
                        Math.min(start, text.length),
                        Math.min(end, text.length)
                    );
                }
            }

            this.emit('change', this);
        },
    },

    /**
     * Text shown while the text view is empty, as a hint.
     */
    placeholder: {
        value: '',
        changed(placeholder) {
            this._textAreaEl.placeholder = placeholder || '';
        },
    },

    /**
     * Whether the user can change the text. A text view that is not sensitive is never editable.
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
     * How long lines wrap: one of `WrapMode`.
     */
    wrapMode: {
        value: WrapMode.WORD_CHAR,
        coerce(mode) {
            if (!Object.values(WrapMode).includes(mode)) {
                throw new RangeError(`Invalid wrap mode '${mode}'.`);
            }

            return mode;
        },
        changed() {
            this._updateWrapMode();
        },
    },

    /**
     * Whether the text uses a monospace font, e.g. for code.
     */
    monospace: {
        value: false,
        coerce: Boolean,
        changed(monospace) {
            this.el.classList.toggle('wy-monospace', monospace);
        },
    },

    /**
     * Whether Tab inserts a tab character instead of moving the focus. Shift+Tab always moves the
     * focus backward.
     */
    acceptsTab: { value: false, coerce: Boolean },

    /**
     * Whether the text view has a frame.
     */
    hasFrame: {
        value: true,
        coerce: Boolean,
        changed(hasFrame) {
            this.el.classList.toggle('wy-no-frame', !hasFrame);
        },
    },
});

registerType('text-view', TextView);
