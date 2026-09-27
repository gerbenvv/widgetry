/**
 * @module widgets/image
 */

import { Align } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { getIcon } from '../icons/icons.js';
import { Widget } from './widget.js';

/**
 * An image: a named icon (see `icons/icons.js`) or a picture loaded from a URL.
 *
 * Images keep their natural size by default (they are centered rather than stretched). A picture
 * that fails to load shows the `image-missing` placeholder.
 *
 * Signals: `load`, `error`.
 */
export class Image extends Widget {
    _render() {
        const element = createElement('<span class="wy-image" aria-hidden="true"></span>');

        this._pictureEl = null;

        return element;
    }

    _showIcon(name) {
        const svg = getIcon(name);

        this._pictureEl = null;
        this.el.innerHTML = svg || '';
        this.el.classList.toggle('wy-image-missing', !svg && Boolean(name));
        this.el.classList.add('wy-image-icon');
        this._applyPixelSize();
    }

    _showPicture(source) {
        this.el.classList.remove('wy-image-icon', 'wy-image-missing');
        this.el.textContent = '';

        if (!source) {
            this._pictureEl = null;

            return;
        }

        const picture = document.createElement('img');
        picture.alt = this._alternativeText;
        picture.draggable = false;
        picture.addEventListener('load', () => this.emit('load', this));
        picture.addEventListener('error', () => {
            this.el.classList.add('wy-image-missing');
            this.emit('error', this);
        });
        picture.src = source;

        this._pictureEl = picture;
        this.el.append(picture);
        this._applyPixelSize();
    }

    _syncAccessibleName() {
        const name = this._accessibleName || this._alternativeText;

        // Without a name the image is decorative, as in GTK.
        if (name) {
            this.el.setAttribute('role', 'img');
            this.el.setAttribute('aria-label', name);
            this.el.removeAttribute('aria-hidden');
        } else {
            this.el.removeAttribute('role');
            this.el.removeAttribute('aria-label');
            this.el.setAttribute('aria-hidden', 'true');
        }
    }

    _applyPixelSize() {
        const size = this._pixelSize > 0 ? `${this._pixelSize}px` : '';

        this.el.style.setProperty('--wy-icon-size', size || null);
    }
}

defineProperties(Image, {
    hAlign: { value: Align.CENTER },
    vAlign: { value: Align.CENTER },

    /**
     * The name of an icon, e.g. `'document-open'`. Setting it clears `source`.
     */
    icon: {
        value: '',
        changed(icon) {
            if (icon) {
                this._source = '';
            }

            this._showIcon(icon);
        },
    },

    /**
     * The URL of a picture. Setting it clears `icon`.
     */
    source: {
        value: '',
        changed(source) {
            if (source) {
                this._icon = '';
            }

            this._showPicture(source);
        },
    },

    /**
     * The size of an icon in pixels, or 0 for the default (16 pixels, or the font's size in
     * buttons). Pictures are scaled to fit it too.
     */
    pixelSize: {
        value: 0,
        changed() {
            this._applyPixelSize();
        },
    },

    /**
     * A text alternative for assistive technology, used when `accessibleName` is not set. An image
     * without either is decorative and hidden from assistive technology.
     */
    alternativeText: {
        value: '',
        changed(text) {
            if (this._pictureEl) {
                this._pictureEl.alt = text;
            }

            this._syncAccessibleName();
        },
    },
});

registerType('image', Image);
