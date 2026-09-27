/**
 * @module widgets/check-box
 */
import { Label } from './label.js';
import { ToggleButton } from './toggle-button.js';
/**
 * A check box: a toggle button drawn as a small box with a check mark, followed by its label.
 * Clicking the box or the label toggles it. `inconsistent` shows a dash instead of the mark.
 */
export declare class CheckBox extends ToggleButton {
    _bodyEl: Element;
    _render(): HTMLElement;
    _createLabel(): Label;
    _setAccessibleState(state: any): void;
}
