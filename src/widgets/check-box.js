/**
 * @module widgets/check-box
 */

import { Align } from '../core/enums.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Label } from './label.js';
import { ToggleButton } from './toggle-button.js';

/**
 * A check box: a toggle button drawn as a small box with a check mark, followed by its label.
 * Clicking the box or the label toggles it. `inconsistent` shows a dash instead of the mark.
 */
export class CheckBox extends ToggleButton {
    _render() {
        const element = createElement(`
            <div class="wy-check-box" role="checkbox">
                <span class="wy-check-indicator" aria-hidden="true"></span>
                <div class="wy-check-box-body"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-check-box-body');

        return element;
    }

    _createLabel() {
        return new Label({ hAlign: Align.START });
    }

    _setAccessibleState(state) {
        this.el.setAttribute('aria-checked', state);
    }
}

registerType('check-box', CheckBox);
