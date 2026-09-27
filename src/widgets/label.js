/**
 * @module widgets/label
 */

import { Application } from '../core/application.js';
import { Align, EllipsizeMode, Justification, LabelStyles } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Widget } from './widget.js';

/**
 * The markup tags a label accepts, mapped to the tag and class they are rendered as. Everything
 * else in markup is shown as literal text.
 *
 * @type {Readonly<Record<string, {tag: string, className?: string}>>}
 */
const MARKUP_TAGS = Object.freeze({
    b: { tag: 'b' },
    strong: { tag: 'strong' },
    i: { tag: 'i' },
    em: { tag: 'em' },
    u: { tag: 'u' },
    s: { tag: 's' },
    strike: { tag: 's' },
    del: { tag: 'del' },
    ins: { tag: 'ins' },
    small: { tag: 'small' },
    big: { tag: 'span', className: 'wy-markup-big' },
    sub: { tag: 'sub' },
    sup: { tag: 'sup' },
    tt: { tag: 'code' },
    code: { tag: 'code' },
    mark: { tag: 'mark' },
    span: { tag: 'span' },
    br: { tag: 'br' },
});

/**
 * Matches a markup tag: an opening, closing or self-closing tag with optional attributes.
 *
 * @type {RegExp}
 */
const TAG_PATTERN =
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

/**
 * Matches the `class` attribute in the attributes of a tag.
 *
 * @type {RegExp}
 */
const CLASS_PATTERN = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

/**
 * Matches a character reference (an HTML entity) at the start of a string.
 *
 * @type {RegExp}
 */
const ENTITY_PATTERN = /^&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;

/**
 * The labels that have a mnemonic, for finding the one of a pressed Alt+key.
 *
 * @type {Set<Label>}
 */
const MNEMONIC_LABELS = new Set();

/**
 * The CSS `text-align` of each `Justification`.
 *
 * @type {Readonly<Record<string, string>>}
 */
const TEXT_ALIGN = Object.freeze({
    [Justification.START]: 'start',
    [Justification.END]: 'end',
    [Justification.CENTER]: 'center',
    [Justification.FILL]: 'justify',
});

let mnemonicListenerInstalled = false;

/**
 * Escapes text for HTML, keeping character references (such as `&amp;` or `&#169;`) intact.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeMarkupText(text) {
    let result = '';

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (character === '&') {
            const entity = ENTITY_PATTERN.exec(text.slice(index));
            if (entity) {
                result += entity[0];
                index += entity[0].length - 1;
            } else {
                result += '&amp;';
            }
        } else if (character === '<') {
            result += '&lt;';
        } else if (character === '>') {
            result += '&gt;';
        } else if (character === '"') {
            result += '&quot;';
        } else {
            result += character;
        }
    }

    return result;
}

/**
 * Parses the mnemonic out of text: `_` marks the next character as the mnemonic, `__` is a literal
 * underscore. Only the first marked character is the mnemonic.
 *
 * @param {string} text
 * @param {boolean} markup Whether the text is markup, where a character can be an entity.
 * @param {{found: boolean}} state Shared between the text parts of one label.
 * @returns {{parts: Array<string | {mnemonic: string}>, key: string}}
 */
function parseUnderlines(text, markup, state) {
    const parts = [];
    let key = '';
    let plain = '';

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character !== '_' || index === text.length - 1) {
            plain += character;
            continue;
        }

        const next = text[index + 1];
        if (next === '_') {
            plain += '_';
            index += 1;
            continue;
        }

        // The marked character; in markup an entity counts as one character.
        let marked = next;
        const entity = markup && next === '&' ? ENTITY_PATTERN.exec(text.slice(index + 1)) : null;
        if (entity) {
            marked = entity[0];
        } else if (next.codePointAt(0) > 0xffff) {
            marked = String.fromCodePoint(next.codePointAt(0));
        }

        index += marked.length;

        if (state.found || /\s/.test(marked)) {
            plain += marked;
            continue;
        }

        state.found = true;

        parts.push(plain);
        parts.push({ mnemonic: marked });
        plain = '';

        key = entity ? decodeEntity(marked) : marked;
    }

    parts.push(plain);

    return { parts, key: key.toLowerCase() };
}

/**
 * Decodes a single character reference.
 *
 * @param {string} entity
 * @returns {string}
 */
function decodeEntity(entity) {
    const template = document.createElement('template');
    template.innerHTML = entity;

    return template.content.textContent || '';
}

/**
 * Converts label markup to safe HTML. Accepted tags are re-created without their attributes
 * (except style classes on `span`); other tags and unmatched closing tags are escaped, and tags
 * left open are closed.
 *
 * @param {string} markup
 * @param {boolean} useUnderline Whether underscores mark a mnemonic.
 * @returns {{html: string, key: string}}
 */
function markupToHtml(markup, useUnderline) {
    const stack = [];
    const state = { found: false };

    let html = '';
    let key = '';
    let position = 0;

    function addText(text) {
        if (!useUnderline) {
            html += escapeMarkupText(text);

            return;
        }

        const parsed = parseUnderlines(text, true, state);
        key = key || parsed.key;

        for (const part of parsed.parts) {
            if (typeof part === 'string') {
                html += escapeMarkupText(part);
            } else {
                html += `<u class="wy-mnemonic">${escapeMarkupText(part.mnemonic)}</u>`;
            }
        }
    }

    for (const match of markup.matchAll(TAG_PATTERN)) {
        addText(markup.slice(position, match.index));
        position = match.index + match[0].length;

        const closing = Boolean(match[1]);
        const name = match[2].toLowerCase();
        const entry = MARKUP_TAGS[name];

        if (!entry) {
            addText(match[0]);
            continue;
        }

        if (entry.tag === 'br') {
            if (!closing) {
                html += '<br>';
            }

            continue;
        }

        if (closing) {
            const index = stack.lastIndexOf(name);
            if (index < 0) {
                addText(match[0]);
                continue;
            }

            // Close the tags that were left open inside this one as well.
            while (stack.length > index) {
                html += `</${MARKUP_TAGS[stack.pop()].tag}>`;
            }

            continue;
        }

        const classes = [];
        if (entry.className) {
            classes.push(entry.className);
        }

        if (name === 'span') {
            const classMatch = CLASS_PATTERN.exec(match[3]);
            const value = classMatch ? (classMatch[1] ?? classMatch[2] ?? classMatch[3]) : '';

            classes.push(...value.split(/\s+/).filter((x) => /^[\w-]+$/.test(x)));
        }

        const classAttribute = classes.length ? ` class="${classes.join(' ')}"` : '';

        if (match[4]) {
            // A self-closing tag, such as `<b/>`, has no content.
            html += `<${entry.tag}${classAttribute}></${entry.tag}>`;
        } else {
            html += `<${entry.tag}${classAttribute}>`;
            stack.push(name);
        }
    }

    addText(markup.slice(position));

    while (stack.length) {
        html += `</${MARKUP_TAGS[stack.pop()].tag}>`;
    }

    return { html, key };
}

/**
 * Creates the nodes of plain text, with the mnemonic character underlined.
 *
 * @param {Array<string | {mnemonic: string}>} parts
 * @returns {Node[]}
 */
function partsToNodes(parts) {
    return parts
        .filter((part) => part !== '')
        .map((part) => {
            if (typeof part === 'string') {
                return document.createTextNode(part);
            }

            const underline = document.createElement('u');
            underline.className = 'wy-mnemonic';
            underline.textContent = part.mnemonic;

            return underline;
        });
}

/**
 * Splits text parts at a character offset, for middle ellipsizing.
 *
 * @param {Array<string | {mnemonic: string}>} parts
 * @param {number} offset An offset in code points.
 * @returns {[Array<string | {mnemonic: string}>, Array<string | {mnemonic: string}>]}
 */
function splitParts(parts, offset) {
    const first = [];
    const second = [];

    let remaining = offset;
    for (const part of parts) {
        if (typeof part !== 'string') {
            (remaining > 0 ? first : second).push(part);
            remaining -= 1;
            continue;
        }

        const characters = Array.from(part);
        if (remaining >= characters.length) {
            first.push(part);
        } else if (remaining <= 0) {
            second.push(part);
        } else {
            first.push(characters.slice(0, remaining).join(''));
            second.push(characters.slice(remaining).join(''));
        }

        remaining -= characters.length;
    }

    return [first, second];
}

/**
 * Returns the number of code points of text parts.
 *
 * @param {Array<string | {mnemonic: string}>} parts
 * @returns {number}
 */
function countCharacters(parts) {
    return parts.reduce(
        (total, part) => total + (typeof part === 'string' ? Array.from(part).length : 1),
        0
    );
}

/**
 * Returns the key of a key event for mnemonics: the lowercase character, also when a modifier
 * changed the character (such as Option on macOS).
 *
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function getMnemonicKey(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : '';
    if (/^[a-z0-9]$/.test(key)) {
        return key;
    }

    // Alt (Option on macOS) may have changed the character; use the physical key then.
    const code = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code || '');
    if (code) {
        return (code[1] || code[2]).toLowerCase();
    }

    return key;
}

function onDocumentKeyDown(event) {
    if (
        event.defaultPrevented ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        !Application.activeWindow
    ) {
        return;
    }

    const key = getMnemonicKey(event);
    if (key && activateMnemonic(Application.activeWindow, key)) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function installMnemonicListener() {
    if (mnemonicListenerInstalled || typeof document === 'undefined') {
        return;
    }

    mnemonicListenerInstalled = true;
    document.addEventListener('keydown', onDocumentKeyDown);
}

/**
 * Activates the mnemonic of a key in a window, as pressing Alt and the key does: the widget of
 * the label with that mnemonic is activated (a button is clicked) or focused. When several
 * labels share the mnemonic, each press focuses the next of their widgets instead.
 *
 * @param {import('./abstract-window.js').AbstractWindow} window
 * @param {string} key A single character.
 * @returns {boolean} Whether a mnemonic was activated.
 */
export function activateMnemonic(window, key) {
    if (typeof key !== 'string' || !key) {
        throw new TypeError('A mnemonic key must be a non-empty string.');
    }

    key = key.toLowerCase();

    const targets = [];
    for (const label of MNEMONIC_LABELS) {
        if (label._mnemonicKey !== key || !label.isVisible || label.window !== window) {
            continue;
        }

        const target = label._getMnemonicTarget();
        if (target && target.isVisible && target.isSensitive && !targets.includes(target)) {
            targets.push(target);
        }
    }

    if (!targets.length) {
        return false;
    }

    // Keep the widgets in tree order, so cycling through them follows the window.
    targets.sort((first, second) =>
        first.el.compareDocumentPosition(second.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    if (targets.length === 1) {
        const target = targets[0];

        if (target._mnemonicActivate) {
            target._mnemonicActivate(false);
        } else {
            target.focus();
        }

        return true;
    }

    const current = targets.findIndex((x) => x.isAncestorOf(window.focusWidget));
    const next = targets[(current + 1) % targets.length];

    if (next._mnemonicActivate) {
        next._mnemonicActivate(true);
    } else {
        next.focus();
    }

    return true;
}

/**
 * A widget that shows a small to medium amount of text, most often to label another widget.
 *
 * Labels keep their natural size by default: they are aligned at the start horizontally and
 * centered vertically (`hAlign` is `START`, `vAlign` is `CENTER`), like a GTK label with an
 * `xalign` of 0. Set `hAlign` to `FILL` to give the label all horizontal space, and `justify` to
 * align the lines of its text within it. Spaces and newlines in the text are kept.
 *
 * With `useMarkup`, the text may contain a small set of formatting tags: `b`, `strong`, `i`,
 * `em`, `u`, `s`, `strike`, `del`, `ins`, `small`, `big`, `sub`, `sup`, `tt`, `code`, `mark`,
 * `br` and `span` (whose `class` attribute is kept, for style classes). Other tags are shown as
 * text and attributes are dropped, so markup is safe to use with untrusted text as long as the
 * text parts are escaped. Character references such as `&amp;` are allowed.
 *
 * With `useUnderline`, an underscore marks the next character as the mnemonic (`'_File'`), which
 * is underlined; `'__'` is a literal underscore. Pressing Alt and the mnemonic key activates the
 * `mnemonicWidget`, or the nearest ancestor that handles mnemonics, like a button.
 *
 * Add the style class `dim-label` for secondary, dimmed text.
 */
export class Label extends Widget {
    _initialize() {
        super._initialize();

        this._id = '';
        this._mnemonicKey = '';

        // Apply the defaults.
        this._renderContent();
        this._applyStyles();
    }

    _render() {
        return createElement('<div class="wy-label"></div>');
    }

    destroy() {
        MNEMONIC_LABELS.delete(this);
        this._unlinkMnemonicWidget(this._mnemonicWidget);

        super.destroy();
    }

    _applyLayoutStyle() {
        super._applyLayoutStyle();

        this.el.classList.toggle('wy-label-fill', this._hAlign === Align.FILL);
    }

    /**
     * Returns the widget the mnemonic activates: the mnemonic widget, or the nearest ancestor
     * that handles mnemonics.
     *
     * @protected
     * @returns {Widget | null}
     */
    _getMnemonicTarget() {
        if (this._mnemonicWidget) {
            return this._mnemonicWidget;
        }

        let widget = this.parent;
        while (widget && !widget.isWindow) {
            if (typeof widget._mnemonicActivate === 'function') {
                return widget;
            }

            widget = widget.parent;
        }

        return null;
    }

    _renderContent() {
        const text = this._text;
        const element = this.el;

        element.textContent = '';

        let key;

        if (this._useMarkup) {
            const result = markupToHtml(text, this._useUnderline);
            key = result.key;

            const content = document.createElement('span');
            content.className = 'wy-label-text';
            content.innerHTML = result.html;
            element.append(content);
        } else {
            const parts = this._useUnderline
                ? parseUnderlines(text, false, { found: false })
                : { parts: [text], key: '' };
            key = parts.key;

            if (this._ellipsize === EllipsizeMode.MIDDLE && !this._wrap) {
                // Two halves: the first is cut at its end, the second at its start.
                const [first, second] = splitParts(
                    parts.parts,
                    Math.ceil(countCharacters(parts.parts) / 2)
                );

                const start = document.createElement('span');
                start.className = 'wy-label-start';
                start.append(...partsToNodes(first));

                const end = document.createElement('span');
                end.className = 'wy-label-end';
                const inner = document.createElement('span');
                inner.append(...partsToNodes(second));
                end.append(inner);

                element.append(start, end);
            } else {
                const content = document.createElement('span');
                content.className = 'wy-label-text';
                content.append(...partsToNodes(parts.parts));
                element.append(content);
            }
        }

        this._mnemonicKey = key;

        if (key) {
            MNEMONIC_LABELS.add(this);
            installMnemonicListener();
        } else {
            MNEMONIC_LABELS.delete(this);
        }
    }

    _applyStyles() {
        const style = this.el.style;
        const styles = this._styles;

        style.fontWeight = styles & LabelStyles.BOLD ? 'bold' : '';
        style.fontStyle = styles & LabelStyles.ITALIC ? 'italic' : '';

        // Both lines can be combined, which the original toolkit could not do.
        const lines = [];
        if (styles & LabelStyles.UNDERLINE) {
            lines.push('underline');
        }

        if (styles & LabelStyles.STRIKETHROUGH) {
            lines.push('line-through');
        }

        style.textDecorationLine = lines.join(' ');
    }

    _applyEllipsize() {
        const mode = this._ellipsize;
        const classList = this.el.classList;

        for (const value of Object.values(EllipsizeMode)) {
            classList.toggle(`wy-ellipsize-${value}`, value === mode && value !== 'none');
        }

        this._applyLines();
        this._renderContent();
    }

    _applyLines() {
        const clamp = this._wrap && this._lines > 0 && this._ellipsize !== EllipsizeMode.NONE;

        this.el.classList.toggle('wy-line-clamp', clamp);
        this.el.style.setProperty('--wy-label-lines', clamp ? String(this._lines) : null);
    }

    _applyWidthChars() {
        const style = this.el.style;

        style.setProperty(
            '--wy-label-min-width',
            this._widthChars >= 0 ? `${this._widthChars}ch` : null
        );
        style.setProperty(
            '--wy-label-max-width',
            this._maxWidthChars >= 0 ? `min(100%, ${this._maxWidthChars}ch)` : null
        );
    }

    _linkMnemonicWidget(widget) {
        if (!widget) {
            return;
        }

        if (!this._id) {
            this._id = uniqueId('wy-label');
            this.el.id = this._id;
        }

        const element = widget.focusElement;
        if (!element.hasAttribute('aria-labelledby')) {
            element.setAttribute('aria-labelledby', this._id);
        }
    }

    _unlinkMnemonicWidget(widget) {
        const element = widget?.focusElement;
        if (element && this._id && element.getAttribute('aria-labelledby') === this._id) {
            element.removeAttribute('aria-labelledby');
        }
    }
}

/**
 * Validates an enumeration value.
 *
 * @param {Record<string, string>} enumeration
 * @param {string} name The name of the enumeration, for the error message.
 * @returns {(value: string) => string}
 */
function enumValue(enumeration, name) {
    const values = Object.values(enumeration);

    return (value) => {
        if (!values.includes(value)) {
            throw new Error(`Invalid ${name} '${value}'; expected one of ${values.join(', ')}.`);
        }

        return value;
    };
}

defineProperties(Label, {
    hAlign: { value: Align.START },
    vAlign: { value: Align.CENTER },

    /**
     * The text of the label. With `useMarkup` it is markup, with `useUnderline` underscores mark
     * the mnemonic.
     */
    text: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text);
        },
        changed() {
            this._renderContent();
        },
    },

    /**
     * The same as `text`, following GTK's name.
     */
    label: {
        signal: false,
        get() {
            return this._text;
        },
        set(text) {
            this.text = text;

            return false;
        },
    },

    /**
     * Whether the text is markup with a small set of formatting tags (see the class
     * description).
     */
    useMarkup: {
        value: false,
        changed() {
            this._renderContent();
        },
    },

    /**
     * The same as `useMarkup`, following the original toolkit's name.
     */
    enableMarkup: {
        signal: false,
        get() {
            return this._useMarkup;
        },
        set(useMarkup) {
            this.useMarkup = useMarkup;

            return false;
        },
    },

    /**
     * Whether an underscore in the text marks the next character as the mnemonic.
     */
    useUnderline: {
        value: false,
        changed() {
            this._renderContent();
        },
    },

    /**
     * The mnemonic key (lowercase), or `''` if the label has no mnemonic.
     */
    mnemonicKey: {
        readOnly: true,
        get() {
            return this._mnemonicKey;
        },
    },

    /**
     * The widget the mnemonic activates, or `null` for the nearest ancestor that handles
     * mnemonics (such as a button). The label also becomes the accessible label of the widget.
     */
    mnemonicWidget: {
        value: null,
        set(widget) {
            if (widget !== null && !(widget instanceof Widget)) {
                throw new TypeError('The mnemonic widget must be a widget or null.');
            }

            this._unlinkMnemonicWidget(this._mnemonicWidget);
            this._mnemonicWidget = widget;
            this._linkMnemonicWidget(widget);
        },
    },

    /**
     * The text styles: a mask of `LabelStyles`.
     */
    styles: {
        value: LabelStyles.NORMAL,
        coerce(styles) {
            if (!Number.isInteger(styles) || styles < 0) {
                throw new Error(`Invalid label styles ${styles}.`);
            }

            return styles;
        },
        changed() {
            this._applyStyles();
        },
    },

    /**
     * How the lines of the text are aligned relative to each other: one of `Justification`.
     */
    justify: {
        value: Justification.START,
        coerce: enumValue(Justification, 'justification'),
        changed(justify) {
            this.el.style.textAlign = justify === Justification.START ? '' : TEXT_ALIGN[justify];
        },
    },

    /**
     * Whether the text wraps at word boundaries when it does not fit. A wrapping label's natural
     * width is limited (see `maxWidthChars`), unless it fills its space.
     */
    wrap: {
        value: false,
        changed(wrap) {
            this.el.classList.toggle('wy-wrap', wrap);

            this._applyLines();
            this._renderContent();
        },
    },

    /**
     * How the text is shortened with an ellipsis when it does not fit: one of `EllipsizeMode`.
     * An ellipsizing label can shrink below its natural width. Middle ellipsizing needs plain
     * text; markup is ellipsized at the end instead.
     */
    ellipsize: {
        value: EllipsizeMode.NONE,
        coerce: enumValue(EllipsizeMode, 'ellipsize mode'),
        changed() {
            this._applyEllipsize();
        },
    },

    /**
     * The maximum number of lines of a wrapping, ellipsizing label, or -1 for no limit.
     */
    lines: {
        value: -1,
        changed() {
            this._applyLines();
        },
    },

    /**
     * Whether the user can select the text, e.g. to copy it.
     */
    selectable: {
        value: false,
        changed(selectable) {
            this.el.classList.toggle('wy-selectable', selectable);

            if (!selectable) {
                const selection = document.getSelection();
                if (selection?.anchorNode && this.el.contains(selection.anchorNode)) {
                    selection.removeAllRanges();
                }
            }
        },
    },

    /**
     * The minimum width in characters, or -1 for the natural width.
     */
    widthChars: {
        value: -1,
        changed() {
            this._applyWidthChars();
        },
    },

    /**
     * The maximum natural width in characters, or -1 for no limit (a wrapping label is limited
     * to about 60 characters then).
     */
    maxWidthChars: {
        value: -1,
        changed() {
            this._applyWidthChars();
        },
    },
});

registerType('label', Label);
