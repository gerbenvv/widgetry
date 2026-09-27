/**
 * @module widgets/link-button
 */

import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Button, Relief } from './button.js';

/**
 * A button that looks like a hyperlink and opens its `uri` when clicked, in a new browser tab.
 * Its label defaults to the URI. Once opened, the link is `visited` and drawn in the visited
 * color.
 *
 * Signals: `activate` (`button`); return `true` from a handler to handle the click yourself, so
 * the URI is not opened.
 */
export class LinkButton extends Button {
    _render() {
        return createElement('<div class="wy-button wy-link-button" role="link"></div>');
    }

    /**
     * Activates the link: emits `activate` and, unless a handler returned `true`, opens the URI
     * and marks the link visited.
     */
    activate() {
        if (this.emit('activate', this) || !this._uri) {
            return;
        }

        this.visited = true;
        globalThis.open(this._uri, '_blank', 'noopener,noreferrer');
    }

    _getContentLabel() {
        return this._label || this._uri;
    }
}

defineProperties(LinkButton, {
    relief: { value: Relief.NONE },

    /**
     * The URI the link opens.
     */
    uri: {
        value: '',
        coerce(uri) {
            return uri === null || uri === undefined ? '' : String(uri);
        },
        changed(uri) {
            if (uri) {
                this.el.dataset.uri = uri;
            } else {
                delete this.el.dataset.uri;
            }

            this._syncContent();
        },
    },

    /**
     * Whether the link has been opened.
     */
    visited: {
        value: false,
        coerce: Boolean,
        changed(visited) {
            this.el.classList.toggle('wy-visited', visited);
        },
    },
});

registerType('link-button', LinkButton);
