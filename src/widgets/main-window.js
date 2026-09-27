/**
 * @module widgets/main-window
 */

import { Application } from '../core/application.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { AbstractWindow } from './abstract-window.js';

/**
 * The main application window. It fills its host element: by default the whole page (the
 * document body), or any element given as `host`, to embed an application in a page.
 *
 * There can be only one main window at a time. When it fills the page, its `title` is the
 * document title.
 */
export class MainWindow extends AbstractWindow {
    _initialize() {
        if (Application.mainWindow) {
            throw new Error('There can only be one main window.');
        }

        super._initialize();

        this._originalTitle = typeof document !== 'undefined' ? document.title : '';

        Application._setMainWindow(this);
    }

    _render() {
        const element = createElement(`
            <div class="wy-main-window" role="application">
                <div class="wy-main-window-body"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-main-window-body');

        return element;
    }

    /**
     * The element the main window fills.
     *
     * @type {HTMLElement}
     */
    get hostElement() {
        return this._host || document.body;
    }

    destroy() {
        super.destroy();

        if (!this._host) {
            document.title = this._originalTitle;
            document.documentElement.classList.remove('wy-page');
        }
    }

    _onVisibleChange(visible) {
        if (visible) {
            const host = this.hostElement;

            this.el.classList.toggle('wy-embedded', Boolean(this._host));
            document.documentElement.classList.toggle('wy-page', !this._host);

            host.append(this.el);
        }

        super._onVisibleChange(visible);

        if (!visible) {
            this.el.remove();
        }
    }
}

defineProperties(MainWindow, {
    /**
     * The element to fill, or `null` for the whole page. Set it before showing the window.
     */
    host: {
        value: null,
        changed() {
            if (this._visible) {
                this._onVisibleChange(true);
            }
        },
    },

    title: {
        value: '',
        changed(title) {
            if (!this._host) {
                document.title = title;
            }

            this.el.setAttribute('aria-label', title);
        },
    },
});

registerType('main-window', MainWindow);
