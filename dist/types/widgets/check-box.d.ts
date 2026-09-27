/**
 * @module widgets/check-box
 */
import { Label } from './label.js';
import { ToggleButton } from './toggle-button.js';
/**
 * A check box: a toggle button drawn as a small box with a check mark, followed by its label.
 * Clicking the box or the label toggles it. `inconsistent` shows a dash instead of the mark.
 *
 * Signals: `activate` (`button`) when the user activates the check box (a click, Space or Enter,
 * or its mnemonic) or `activate()` is called, after it toggled; `toggle` (`button`) and
 * `active-change` on every change of `active`, also from code; and `clicked` (`button`) after a
 * click.
 */
export declare class CheckBox extends ToggleButton {
    _bodyEl: Element;
    _render(): HTMLElement;
    _createLabel(): Label;
    _setAccessibleState(state: any): void;
}
