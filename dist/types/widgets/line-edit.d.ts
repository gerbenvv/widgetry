/**
 * @module widgets/line-edit
 */
import { Widget } from './widget.js';
/**
 * The positions of the icons of a line edit.
 *
 * @enum {string}
 */
export declare const EntryIconPosition: Readonly<{
    PRIMARY: "primary";
    SECONDARY: "secondary";
}>;
export type Validator = {
    /**
     * Whether a text is valid.
     */
    validate: (text: string) => boolean;
    /**
     * Optionally corrects an invalid text. It runs when
     * the line edit is activated or loses the focus while its text is invalid.
     */
    fixup?: (text: string) => string;
};
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
export declare class LineEdit extends Widget {
    _validatorDisconnect: any;
    _inputEl: HTMLInputElement;
    _iconEls: {
        primary: Element;
        secondary: Element;
    };
    _isValid: any;
    _isEditable: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The native input element.
     *
     * @type {HTMLInputElement}
     */
    get focusElement(): HTMLInputElement;
    /**
     * Emits `activate`, as pressing Enter does. An invalid text is corrected first if the
     * validator can fix it up.
     */
    activate(): void;
    destroy(): void;
    /**
     * Selects a range of characters. The selection is kept when the line edit gets the focus.
     *
     * @param {number} start The first character.
     * @param {number} [end] The character after the last one, or -1 (the default) for the end of
     *     the text. When smaller than `start`, the selection extends backward.
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
     * Inserts text at a position, as if typed there (subject to `maxLength`).
     *
     * @param {string} text
     * @param {number} [position] The character to insert before, or -1 (the default) for the
     *     cursor position.
     * @returns {number} The position after the inserted text.
     */
    insertText(text: string, position?: number): number;
    /**
     * Deletes a range of characters.
     *
     * @param {number} start
     * @param {number} [end] The character after the last one, or -1 (the default) for the end.
     */
    deleteText(start: number, end?: number): void;
    /**
     * Deletes the selected text, if any.
     */
    deleteSelection(): void;
    /**
     * Checks a text with the validator. Subclasses extend this with their own rules.
     *
     * @protected
     * @param {string} text
     * @returns {boolean}
     */
    protected _validate(text: string): boolean;
    /**
     * Validates the current text and updates `isValid` and the invalid state.
     *
     * @protected
     */
    protected _revalidate(): void;
    /**
     * Lets the validator correct an invalid text.
     *
     * @protected
     */
    protected _fixup(): void;
    /**
     * Called after the text changed, by the user or programmatically. Emits `change`.
     *
     * @protected
     * @param {string} _text
     */
    protected _onTextChange(_text: string): void;
    /**
     * Puts a text in the input. When the input has the focus, the selection is kept as far as
     * possible, and a cursor at the end of the text stays at the end.
     *
     * @protected
     * @param {string} text
     */
    protected _setInputValue(text: string): void;
    _isIconActivatable(position: any): any;
    _updateIcon(position: any): void;
    _updateEditable(): void;
    _updateAlignment(): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _onInput(): void;
    _onInputKeyDown(event: any): void;
    _onInputBlur(): void;
}

/** The declared properties of {@link LineEdit}. */
export interface LineEdit {
    /**
     * The text.
     */
    text: string;
    /**
     * The value: the text, or `null` if it is not valid. Setting it sets the text.
     */
    value: any;
    /**
     * Text shown while the line edit is empty, as a hint.
     */
    placeholder: string;
    /**
     * Whether the user can change the text. A line edit that is not sensitive is never editable.
     */
    editable: boolean;
    /**
     * Whether the user can currently change the text: it is `editable` and sensitive.
     */
    readonly isEditable: boolean;
    /**
     * Whether the text is shown. When `false`, the line edit is a password entry that shows every
     * character as a dot.
     */
    visibility: boolean;
    /**
     * The maximum number of characters, or 0 for no limit. A longer text is truncated.
     */
    maxLength: number;
    /**
     * The natural width in characters, or -1 for the default width.
     */
    widthChars: number;
    /**
     * The horizontal alignment of the text, from 0 (at the start) to 1 (at the end).
     */
    xAlign: number;
    /**
     * The alignment of the text as a `Justification`: `START`, `CENTER` or `END`. The same as
     * `xAlign` 0, 0.5 or 1.
     */
    alignment: any;
    /**
     * Whether the line edit has a frame. Without one it blends into its surroundings, e.g. when
     * editing a table cell.
     */
    hasFrame: boolean;
    /**
     * The border style: one of `ShadowType`. `NONE` is the same as having no frame.
     */
    shadowType: string;
    /**
     * The validator of the text, or `null`: an object with a `validate(text)` method (and
     * optionally `fixup(text)`), or a function. An invalid text is shown in the invalid state.
     * The text is validated again when a validator with a `change` signal (such as the
     * validators of `data/validators`) emits it.
     */
    validator: any;
    /**
     * Whether the text is valid according to the validator.
     */
    readonly isValid: boolean;
    /**
     * The name of the icon at the start, or `''` for none.
     */
    primaryIcon: string;
    /**
     * The name of the icon at the end, or `''` for none.
     */
    secondaryIcon: string;
    /**
     * Whether the icon at the start emits `icon-press` and `icon-release`.
     */
    primaryIconActivatable: boolean;
    /**
     * Whether the icon at the end emits `icon-press` and `icon-release`.
     */
    secondaryIconActivatable: boolean;
    /**
     * The tooltip (and accessible name) of the icon at the start.
     */
    primaryIconTooltip: string;
    /**
     * The tooltip (and accessible name) of the icon at the end.
     */
    secondaryIconTooltip: string;
    /**
     * The cursor position, as a character index.
     */
    cursorPosition: any;
}
