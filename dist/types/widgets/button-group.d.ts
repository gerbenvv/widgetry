/**
 * @module widgets/button-group
 */
import { Instance } from '../core/instance.js';
/**
 * A group of toggling widgets (radio buttons, toggle buttons, radio menu items, radio tool items)
 * of which at most one is active at a time.
 *
 * A member must have an `active` property and a `group` property, and emit `active-change`. Adding
 * a widget to a group is the same as setting its `group`.
 *
 * Signals: `add` and `remove` (`group, button`), `active-change`.
 */
export declare class ButtonGroup extends Instance {
    _buttons: any[];
    _active: any;
    _initialize(): void;
    /**
     * Adds a button. If it is active, it becomes the active button of the group.
     *
     * @param {import('./widget.js').Widget & {active: boolean, group: ButtonGroup | null}} button
     */
    addButton(button: import('./widget.js').Widget & {
        active: boolean;
        group: ButtonGroup | null;
    }): void;
    /**
     * Removes a button.
     *
     * @param {import('./widget.js').Widget} button
     * @throws {Error} If the button is not in the group.
     */
    removeButton(button: import('./widget.js').Widget): void;
    destroy(): void;
    _onButtonActiveChange(button: any): void;
    _onButtonDestroy(button: any): void;
}
export declare namespace ButtonGroup {
    var builderProperties: {
        buttons(builder: any, group: any, buttons: any): void;
    };
}

/** The declared properties of {@link ButtonGroup}. */
export interface ButtonGroup {
    /**
     * The active button, or `null`. Setting it activates that button and deactivates the others.
     */
    active: any;
    /**
     * The buttons in the group. Do not modify the array.
     */
    readonly buttons: any;
    /**
     * The number of buttons.
     */
    readonly buttonsCount: number;
}
