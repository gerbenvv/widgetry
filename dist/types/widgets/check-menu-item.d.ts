/**
 * @module widgets/check-menu-item
 */
import { MenuItem } from './menu-item.js';
/**
 * A menu item with a check mark, which activating toggles.
 *
 * Signals: `activate` (when activated, after toggling) and `toggle` (whenever `active` changes).
 */
export declare class CheckMenuItem extends MenuItem {
    inconsistent: boolean;
    active: boolean;
    _initialize(): void;
    _getRole(): string;
    /**
     * Activates the item: toggles it and emits `activate`. Does nothing if it is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate(): boolean;
    /**
     * Changes `active` for an activation. Radio items override this.
     *
     * @protected
     */
    protected _toggleOnActivate(): void;
    _updateCheckState(): void;
}

/** The declared properties of {@link CheckMenuItem}. */
export interface CheckMenuItem {
    /**
     * Whether the check is drawn as a radio dot.
     */
    drawAsRadio: boolean;
}
