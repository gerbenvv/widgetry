# Changelog

## 1.0.0 (2026-09-27)

The first release of Widgetry, a desktop-style widget toolkit for the browser in the spirit of GTK
and the classic Clearlooks theme. It is a modern reimplementation of a GTK-inspired JavaScript
library written between 2012 and 2014. It keeps that library's widgets, properties, signals and
layout model, and rebuilds them on ES modules, CSS layout, pointer events, `Intl` and ARIA, with
no dependencies.

### Widgets

- Windows: a main window that fills the page or a host element, and floating windows that can be
  moved, resized, maximized, closed and made modal. Dialogs with response buttons and a promise
  (`run()`), message dialogs, and `alert()`, `confirm()` and `prompt()`.
- Menus: menu bars, menus and context menus with check, radio and separator items, submenus,
  keyboard navigation, mnemonics and accelerators. Toolbars with tool items, check, radio and
  separator items and an overflow menu. Tooltips and popovers.
- Buttons: push, toggle, check, radio, link and menu buttons, button groups and button boxes,
  switches, and color buttons with a color chooser (a palette and an editor).
- Text and input: labels with markup and mnemonics, line edits with validation, placeholders and
  icons, multi-line text views, spin buttons, combo boxes (with type-ahead and editable entries),
  calendars and date entries.
- Ranges and progress: sliders, scroll bars, progress bars and throbbers.
- Containers: boxes, grids, fixed positioning, panes with a splitter, notebooks (tabs), expanders,
  frames, scroll areas, status bars, info bars, separators, spacers and a resize grip.
- Lists: list boxes that hold any widgets, with selection, activation, filtering, sorting, headers
  and model binding.
- Tables: a virtualized table for a hundred thousand rows, with sortable and resizable text,
  number, date, check box (editable) and index columns, multiple selection, and a tree view for
  tree models with lazily loaded children.
- A vector canvas with interactive rectangles, circles, paths, labels and images, which all take
  transformations the same way.

### Infrastructure

- An object model with declared properties (each emitting a change signal), signals, actions and
  declarative construction from plain objects or JSON with the builder.
- GTK's layout model on CSS flexbox and grid: natural and minimum sizes, expanding (inherited from
  the children), alignment, margins and size requests.
- Focus handling per window as on the desktop (the previously active window is activated again
  when one closes, and modal windows keep the focus), Tab navigation, mnemonics, accelerators and
  ARIA roles throughout.
- Event signals with capture and bubble phases, multiple-press counting, pointer grabs, and drag
  and drop with typed data.
- List, filtered and tree models with sorting, selections, search and condition filters, and
  text, integer and floating-point validators.
- Internationalization based on `Intl`: a locale manager, `sprintf`- and `strftime`-like
  formatters, parsers that read numbers and dates as people type them (and as `Intl` formats them)
  in many locales, a translator with plural forms and on-demand dictionaries, translated texts, and
  Dutch, German, French and Spanish translations of the toolkit's own texts.
- A navigator that keeps the location hash in sync with the application.
- Freedesktop-named monochrome SVG icons, and a light and a dark Clearlooks theme (or following
  the system) with a configurable accent color, all through CSS custom properties.

### Tooling

- ES modules, a bundled ES module, a minified classic script that defines the global `widgetry`,
  a bundled stylesheet and TypeScript declarations, in `dist/`.
- Node tests for the logic and Playwright browser tests in Chromium and Firefox, ESLint with
  Prettier, and GitHub workflows for the tests, the demo on GitHub Pages and releases to npm.
- A demo of every widget, an example of an application embedded in a web page, and documentation
  of the architecture, the builder and internationalization.
