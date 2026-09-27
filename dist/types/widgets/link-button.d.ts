/**
 * @module widgets/link-button
 */
import { Button } from './button.js';
/**
 * A button that looks like a hyperlink and opens its `uri` when clicked, in a new browser tab.
 * Its label defaults to the URI. Once opened, the link is `visited` and drawn in the visited
 * color.
 *
 * Signals: `activate` (`button`); return `true` from a handler to handle the click yourself, so
 * the URI is not opened.
 */
export declare class LinkButton extends Button {
    _render(): HTMLElement;
    /**
     * Activates the link: emits `activate` and, unless a handler returned `true`, opens the URI
     * and marks the link visited.
     */
    activate(): void;
    _getContentLabel(): any;
}

/** The declared properties of {@link LinkButton}. */
export interface LinkButton {
    /**
     * The URI the link opens.
     */
    uri: string;
    /**
     * Whether the link has been opened.
     */
    visited: boolean;
}
