/**
 * @module widgets/text-view
 */
import { Widget } from './widget.js';
/**
 * How a text view wraps lines that are too long.
 *
 * @enum {string}
 */
export declare const WrapMode: Readonly<{
    NONE: "none";
    CHAR: "char";
    WORD: "word";
    WORD_CHAR: "word-char";
}>;
/**
 * A multi-line text editor, with the same frame as a line edit.
 *
 * The text view wraps a native `<textarea>`, which is its focus element. It scrolls its text
 * itself. Give it a size request or let it expand to make it larger than its default of a few
 * lines.
 *
 * Signals: `change` (`textView`, whenever the text changed).
 */
export declare class TextView extends Widget {
    text: string;
    _textAreaEl: HTMLTextAreaElement;
    _isEditable: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The native textarea element.
     *
     * @type {HTMLTextAreaElement}
     */
    get focusElement(): HTMLTextAreaElement;
    /**
     * Selects a range of characters.
     *
     * @param {number} start
     * @param {number} [end] The character after the last one, or -1 (the default) for the end.
     */
    selectRegion(start: number, end?: number): void;
    /**
     * Selects all text.
     */
    selectAll(): void;
    /**
     * Returns the selected range, or `null` if nothing is selected.
     *
     * @returns {{start: number, end: number} | null}
     */
    getSelectionBounds(): {
        start: number;
        end: number;
    } | null;
    /**
     * Returns the selected text, or `''`.
     *
     * @returns {string}
     */
    getSelectedText(): string;
    /**
     * Inserts text at the cursor, replacing the selection, as if typed.
     *
     * @param {string} text
     */
    insertAtCursor(text: string): void;
    _updateEditable(): void;
    _updateWrapMode(): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _onKeyDown(event: any): void;
}

/** The declared properties of {@link TextView}. */
export interface TextView {
    canFocus: any;
    /**
     * Text shown while the text view is empty, as a hint.
     */
    placeholder: string;
    /**
     * Whether the user can change the text. A text view that is not sensitive is never editable.
     */
    editable: boolean;
    /**
     * Whether the user can currently change the text: it is `editable` and sensitive.
     */
    readonly isEditable: any;
    /**
     * How long lines wrap: one of `WrapMode`.
     */
    wrapMode: any;
    /**
     * Whether the text uses a monospace font, e.g. for code.
     */
    monospace: boolean;
    /**
     * Whether Tab inserts a tab character instead of moving the focus. Shift+Tab always moves the
     * focus backward.
     */
    acceptsTab: any;
    /**
     * Whether the text view has a frame.
     */
    hasFrame: boolean;
    /**
     * The accessible name of the text area, for text views without a visible label.
     */
    accessibleName: string;
}
