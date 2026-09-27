/**
 * The built-in icons: small, monochrome SVG icons with freedesktop (GTK) names, drawn with
 * `currentColor` so they follow the text color. Register more with `registerIcon()`.
 *
 * @module icons/icons
 */

/**
 * Path data of the built-in icons, on a 16 by 16 grid. Strokes are drawn 1.5 wide with round
 * ends; paths that start with `F` are filled instead.
 *
 * @type {Record<string, string[]>}
 */
const ICON_PATHS = {
    'document-new': ['M4 1.5h5.5L13 5v9.5H4z', 'M9.5 1.5V5H13', 'M6.5 9.5h4M8.5 7.5v4'],
    'document-open': ['M1.5 13.5v-10h4l1.5 1.5h6v2', 'M1.5 13.5l2.5-6h11l-2.5 6z'],
    'document-save': ['M2.5 2.5h9l2 2v9h-11z', 'M5 2.5v3.5h5V2.5', 'M5 13.5v-4h6v4'],
    'document-save-as': [
        'M2.5 2.5h9l2 2v4',
        'M5 2.5v3.5h5V2.5',
        'M2.5 2.5v11h5',
        'M9 14l1-3 4-4 2 2-4 4z',
    ],
    'document-print': ['M4.5 5.5v-4h7v4', 'M4.5 11.5h-3v-6h13v6h-3', 'M4.5 9.5h7v5h-7z'],
    'document-properties': ['M4 1.5h8.5v13h-9v-13', 'M6 5h5M6 8h5M6 11h3'],
    'edit-cut': [
        'M5 11a2 2 0 1 1-2.8 2.8A2 2 0 0 1 5 11zm6 0a2 2 0 1 0 2.8 2.8A2 2 0 0 0 11 11z',
        'M5 11l6-9.5M11 11L5 1.5',
    ],
    'edit-copy': ['M5.5 5.5h8v9h-8z', 'M3.5 10.5h-1v-9h8v1'],
    'edit-paste': ['M4.5 3h-2v11.5h11V3h-2', 'M5.5 1.5h5v3h-5z', 'M5.5 8h5M5.5 11h3'],
    'edit-undo': ['M5.5 3.5L2 7l3.5 3.5', 'M2.5 7H10a3.5 3.5 0 0 1 0 7H7'],
    'edit-redo': ['M10.5 3.5L14 7l-3.5 3.5', 'M13.5 7H6a3.5 3.5 0 0 0 0 7h3'],
    'edit-delete': ['M2.5 4h11', 'M6 4V2h4v2', 'M4 4l.8 10.5h6.4L12 4', 'M6.8 6.5v5.5M9.2 6.5v5.5'],
    'edit-find': ['M10.5 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M9.5 9.5l5 5'],
    'edit-clear': ['M5 3.5h9v9H5L1.5 8z', 'M7.5 6l4 4m0-4l-4 4'],
    'edit-select-all': ['M2.5 2.5h11v11h-11z', 'F5 5h6v6H5z'],
    'list-add': ['M8 2.5v11M2.5 8h11'],
    'list-remove': ['M2.5 8h11'],
    'go-previous': ['M9.5 3L4.5 8l5 5', 'M4.5 8h9'],
    'go-next': ['M6.5 3l5 5-5 5', 'M11.5 8h-9'],
    'go-up': ['M3 7.5l5-5 5 5', 'M8 2.5v11'],
    'go-down': ['M3 8.5l5 5 5-5', 'M8 13.5v-11'],
    'go-first': ['M3.5 3v10', 'M11.5 3l-5 5 5 5'],
    'go-last': ['M12.5 3v10', 'M4.5 3l5 5-5 5'],
    'go-home': ['M1.5 8L8 2l6.5 6', 'M3.5 6.5v8h9v-8', 'M6.5 14.5v-4h3v4'],
    'go-jump': ['M2.5 12.5c0-5 3-8 9-8', 'M9 1.5l3 3-3 3'],
    'view-refresh': ['M13 3.5v3h-3', 'M12.8 6.5A5.5 5.5 0 1 0 13.5 9'],
    'view-list': ['M5.5 4h8M5.5 8h8M5.5 12h8', 'F2 3h2v2H2zM2 7h2v2H2zM2 11h2v2H2z'],
    'view-grid': ['M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z'],
    'view-fullscreen': ['M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4'],
    'view-sort-ascending': ['M4.5 2v12M2 11.5l2.5 2.5 2.5-2.5', 'M9 4h5M9 8h3.5M9 12h2'],
    'view-sort-descending': ['M4.5 2v12M2 11.5l2.5 2.5 2.5-2.5', 'M9 4h2M9 8h3.5M9 12h5'],
    'zoom-in': ['M10.5 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M9.5 9.5l5 5', 'M4.5 6.5h4M6.5 4.5v4'],
    'zoom-out': ['M10.5 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M9.5 9.5l5 5', 'M4.5 6.5h4'],
    'zoom-fit-best': ['M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4', 'M5.5 5.5h5v5h-5z'],
    'zoom-original': ['M10.5 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M9.5 9.5l5 5', 'M5.5 5l1-.5v4'],
    'help-about': [
        'M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
        'M8 7v4.5',
        'F7.1 4.2h1.8v1.8H7.1z',
    ],
    'help-contents': [
        'M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
        'M6 6.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.3v.5',
        'F7.1 11h1.8v1.8H7.1z',
    ],
    'dialog-information': [
        'M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
        'M8 7v4.5',
        'F7.1 4.2h1.8v1.8H7.1z',
    ],
    'dialog-warning': ['M8 1.8L14.8 13.8H1.2z', 'M8 6v3.8', 'F7.1 10.8h1.8v1.8H7.1z'],
    'dialog-error': ['M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z', 'M5.5 5.5l5 5m0-5l-5 5'],
    'dialog-question': [
        'M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
        'M6 6.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.3v.5',
        'F7.1 11h1.8v1.8H7.1z',
    ],
    'preferences-system': [
        'M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
        'M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
    ],
    'window-close': ['M3.5 3.5l9 9m0-9l-9 9'],
    'window-new': ['M1.5 2.5h13v11h-13z', 'M1.5 5.5h13'],
    'application-exit': ['M9.5 4.5v-3h-7v13h7v-3', 'M6.5 8h8M12 5.5L14.5 8 12 10.5'],
    folder: ['M1.5 13.5v-11h4.5l1.5 2h7v9z'],
    'folder-new': ['M1.5 13.5v-11h4.5l1.5 2h7v9z', 'M8 7.5v4M6 9.5h4'],
    'text-x-generic': ['M4 1.5h5.5L13 5v9.5H4z', 'M9.5 1.5V5H13', 'M6 8h5M6 10.5h5M6 13h3'],
    'x-office-spreadsheet': ['M2.5 2.5h11v11h-11z', 'M2.5 6h11M2.5 9.5h11M6.5 2.5v11'],
    'x-office-presentation': ['M1.5 2.5h13v8h-13z', 'M8 10.5v3M5 14.5l3-1 3 1'],
    'office-chart-line': ['M1.5 1.5v13h13', 'M3.5 11l3-4 3 2 4-6'],
    'office-chart-bar': ['M1.5 1.5v13h13', 'M4.5 12.5v-4M7.5 12.5v-7M10.5 12.5v-5M13.5 12.5v-9'],
    user: [
        'M10.8 5a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0z',
        'M2.5 14.5c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5',
    ],
    mail: ['M1.5 3.5h13v9h-13z', 'M1.5 3.5L8 9l6.5-5.5'],
    calendar: ['M2.5 3.5h11v10h-11z', 'M2.5 6.5h11', 'M5 2v3M11 2v3', 'F5 8.5h2v2H5zM9 8.5h2v2H9z'],
    starred: ['M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z'],
    bookmark: ['M4 1.5h8v13l-4-3-4 3z'],
    'media-playback-start': ['F4.5 2.5L13 8l-8.5 5.5z'],
    'media-playback-pause': ['F4 2.5h2.8v11H4zM9.2 2.5H12v11H9.2z'],
    'media-playback-stop': ['F3.5 3.5h9v9h-9z'],
    'format-text-bold': [
        'M4.5 2.5h4a2.8 2.8 0 0 1 0 5.5h-4z',
        'M4.5 8h4.8a2.8 2.8 0 0 1 0 5.5H4.5z',
    ],
    'format-text-italic': ['M7 2.5h5M4 13.5h5M9.5 2.5l-3 11'],
    'format-text-underline': ['M4.5 2v5.5a3.5 3.5 0 0 0 7 0V2', 'M3 14.5h10'],
    'format-justify-left': ['M2 3h12M2 6.3h8M2 9.7h12M2 13h8'],
    'format-justify-center': ['M2 3h12M4 6.3h8M2 9.7h12M4 13h8'],
    'format-justify-right': ['M2 3h12M6 6.3h8M2 9.7h12M6 13h8'],
    'object-select': ['M2.5 8.5l3.5 3.5 7.5-8'],
    'process-stop': [
        'M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z',
        'M5.5 5.5l5 5m0-5l-5 5',
    ],
    'system-search': ['M10.5 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M9.5 9.5l5 5'],
    'emblem-favorite': ['M8 14s-6-3.8-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 14 6c0 4.2-6 8-6 8z'],
    'open-menu': ['M2.5 4h11M2.5 8h11M2.5 12h11'],
    'weather-clear': [
        'M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
        'M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1',
    ],
    'weather-clear-night': ['M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z'],
    'pan-down': ['F4 6h8l-4 4.5z'],
    'pan-up': ['F4 10h8L8 5.5z'],
    'pan-start': ['F10 4v8L5.5 8z'],
    'pan-end': ['F6 4v8l4.5-4z'],
};

/**
 * Colors of icons that are not monochrome, keyed by name.
 *
 * @type {Record<string, string>}
 */
const ICON_COLORS = {
    'dialog-information': '#3b7fcf',
    'dialog-warning': '#d9a400',
    'dialog-error': '#d23b32',
    'dialog-question': '#3b7fcf',
    starred: '#e6a800',
};

/** @type {Map<string, string>} */
const ICONS = new Map();

function toSvg(paths, color) {
    const stroke = color || 'currentColor';

    const elements = paths.map((path) => {
        if (path.startsWith('F')) {
            return `<path d="${path.slice(1)}" fill="${stroke}"/>`;
        }

        return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">${elements.join('')}</svg>`;
}

for (const [name, paths] of Object.entries(ICON_PATHS)) {
    ICONS.set(name, toSvg(paths, ICON_COLORS[name]));
}

/**
 * Registers an icon, or replaces a built-in one.
 *
 * @param {string} name
 * @param {string} svg The SVG markup. Use `currentColor` to follow the text color.
 */
export function registerIcon(name, svg) {
    ICONS.set(name, svg);
}

/**
 * Returns the SVG markup of an icon, or `null` if there is no such icon.
 *
 * @param {string} name
 * @returns {string | null}
 */
export function getIcon(name) {
    return ICONS.get(name) || null;
}

/**
 * Returns the names of all registered icons.
 *
 * @returns {string[]}
 */
export function getIconNames() {
    return [...ICONS.keys()].sort();
}
