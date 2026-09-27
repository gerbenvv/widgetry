// The Widgetry demo: a desktop-style showcase of the widgets. It uses the classic script build
// (`dist/widgetry.min.js`), which exposes the global `widgetry`, so it also works from a file.
(function () {
    'use strict';

    const w = widgetry;

    const application = w.Application;

    // The number of rows in the file table.
    const FILE_COUNT = 10000;

    let mainWindow = null;
    let statusBar = null;
    let statusContext = 0;

    /**
     * Shows a message in the status bar for a few seconds.
     */
    function say(text) {
        const id = statusBar.push(statusContext, text);

        setTimeout(() => statusBar.remove(id, statusContext), 4000);
    }

    /**
     * Makes a frame with a vertical box inside and returns the box.
     */
    function framed(parent, label, properties = {}) {
        const frame = new w.Frame({ label, ...properties });
        const box = new w.Box({ orientation: 'vertical', spacing: 6, margin: 8 });

        frame.addChild(box);
        parent.addChild(frame);

        return box;
    }

    /**
     * Makes a horizontal row of widgets.
     */
    function row(...children) {
        const box = new w.Box({ spacing: 6 });
        children.forEach((x) => box.addChild(x));

        return box;
    }

    function makeMenuBar() {
        const builder = new w.Builder();

        // The theme and accent items are built from data.
        const themes = [
            ['_Light', 'light'],
            ['_Dark', 'dark'],
            ['_Automatic', 'auto'],
        ];
        const accents = [
            ['_Blue', null],
            ['_Green', '#4e9a06'],
            ['_Orange', '#ce5c00'],
            ['_Purple', '#75507b'],
            ['_Red', '#cc0000'],
        ];

        // The radio groups are defined after the items that reference them, in the same build.
        const [menuBar] = builder.build([
            {
                type: 'menu-bar',
                children: [
                    {
                        type: 'menu-item',
                        label: '_File',
                        submenu: {
                            type: 'menu',
                            children: [
                                {
                                    type: 'menu-item',
                                    label: '_New Window',
                                    icon: 'window-new',
                                    accelerator: 'Ctrl+Alt+N',
                                    handlers: { activate: openToolWindow },
                                },
                                {
                                    type: 'menu-item',
                                    label: '_Open…',
                                    icon: 'document-open',
                                    accelerator: 'Ctrl+O',
                                    handlers: { activate: openFile },
                                },
                                {
                                    type: 'menu-item',
                                    label: '_Save',
                                    icon: 'document-save',
                                    accelerator: 'Ctrl+S',
                                    handlers: { activate: () => say('Saved (not really).') },
                                },
                                {
                                    type: 'menu-item',
                                    label: 'Open _Recent',
                                    submenu: {
                                        type: 'menu',
                                        children: [
                                            'budget-2026.ods',
                                            'notes.txt',
                                            'slides.odp',
                                        ].map((name) => ({
                                            type: 'menu-item',
                                            label: name,
                                            handlers: { activate: () => say(`Opened ${name}.`) },
                                        })),
                                    },
                                },
                                { type: 'separator-menu-item' },
                                {
                                    type: 'menu-item',
                                    label: '_Print…',
                                    icon: 'document-print',
                                    accelerator: 'Ctrl+P',
                                    sensitive: false,
                                },
                                { type: 'separator-menu-item' },
                                {
                                    type: 'menu-item',
                                    label: '_Quit',
                                    icon: 'application-exit',
                                    accelerator: 'Ctrl+Q',
                                    handlers: { activate: quit },
                                },
                            ],
                        },
                    },
                    {
                        type: 'menu-item',
                        label: '_Edit',
                        submenu: {
                            type: 'menu',
                            children: [
                                {
                                    type: 'menu-item',
                                    label: '_Undo',
                                    icon: 'edit-undo',
                                    accelerator: 'Ctrl+Z',
                                    sensitive: false,
                                },
                                {
                                    type: 'menu-item',
                                    label: '_Redo',
                                    icon: 'edit-redo',
                                    accelerator: 'Ctrl+Shift+Z',
                                    sensitive: false,
                                },
                                { type: 'separator-menu-item' },
                                {
                                    type: 'menu-item',
                                    label: '_Preferences…',
                                    icon: 'preferences-system',
                                    handlers: { activate: openPreferences },
                                },
                            ],
                        },
                    },
                    {
                        type: 'menu-item',
                        label: '_View',
                        submenu: {
                            type: 'menu',
                            children: [
                                {
                                    type: 'check-menu-item',
                                    id: 'show-tool-bar',
                                    label: 'Show _Toolbar',
                                    active: true,
                                },
                                {
                                    type: 'check-menu-item',
                                    id: 'show-status-bar',
                                    label: 'Show _Status Bar',
                                    active: true,
                                },
                                { type: 'separator-menu-item' },
                                {
                                    type: 'menu-item',
                                    label: '_Theme',
                                    submenu: {
                                        type: 'menu',
                                        children: themes.map(([label, theme]) => ({
                                            type: 'radio-menu-item',
                                            id: `theme-${theme}`,
                                            label,
                                            group: { id: 'themes' },
                                            active: theme === 'light',
                                            handlers: {
                                                toggle(item) {
                                                    if (item.active) {
                                                        application.theme = theme;
                                                    }
                                                },
                                            },
                                        })),
                                    },
                                },
                                {
                                    type: 'menu-item',
                                    label: '_Accent Color',
                                    submenu: {
                                        type: 'menu',
                                        children: accents.map(([label, color]) => ({
                                            type: 'radio-menu-item',
                                            label,
                                            group: { id: 'accents' },
                                            active: color === null,
                                            handlers: {
                                                toggle(item) {
                                                    if (item.active) {
                                                        application.accentColor = color;
                                                    }
                                                },
                                            },
                                        })),
                                    },
                                },
                            ],
                        },
                    },
                    {
                        type: 'menu-item',
                        label: '_Help',
                        submenu: {
                            type: 'menu',
                            children: [
                                {
                                    type: 'menu-item',
                                    label: '_Keyboard Shortcuts',
                                    accelerator: 'F1',
                                    handlers: { activate: showShortcuts },
                                },
                                {
                                    type: 'menu-item',
                                    label: '_About Widgetry',
                                    icon: 'help-about',
                                    handlers: { activate: showAbout },
                                },
                            ],
                        },
                    },
                ],
            },
            { type: 'button-group', id: 'themes' },
            { type: 'button-group', id: 'accents' },
        ]);

        return { menuBar, builder };
    }

    function makeToolBar() {
        const toolBar = new w.ToolBar({ style: 'both' });

        const add = (item) => {
            toolBar.addChild(item);

            return item;
        };

        add(
            new w.ToolItem({
                label: 'New Window',
                icon: 'window-new',
                tooltipLabel: 'Open a floating window',
            })
        ).connect('activate', openToolWindow);
        add(
            new w.ToolItem({ label: 'Open', icon: 'document-open', tooltipLabel: 'Open a file' })
        ).connect('activate', openFile);
        add(
            new w.ToolItem({ label: 'Save', icon: 'document-save', tooltipLabel: 'Save the file' })
        ).connect('activate', () => say('Saved (not really).'));

        add(new w.SeparatorToolItem());

        add(new w.ToolItem({ label: 'Message', icon: 'dialog-information' })).connect(
            'activate',
            () =>
                w.alert('This is a message dialog.', {
                    secondaryText: 'It closes with OK or Escape.',
                })
        );
        add(new w.ToolItem({ label: 'Question', icon: 'dialog-question' })).connect(
            'activate',
            async () => {
                const yes = await w.confirm('Do you like classic desktop widgets?');
                say(yes ? 'Great, so do we.' : 'Maybe the dark theme helps.');
            }
        );

        const busy = add(
            new w.CheckToolItem({
                label: 'Busy',
                icon: 'view-refresh',
                tooltipLabel: 'Show activity',
            })
        );
        busy.connect('toggle', () => setBusy(busy.active));

        // An expanding separator pushes the theme items to the end.
        add(new w.SeparatorToolItem({ draw: false, expand: true }));

        const group = new w.ButtonGroup();
        const light = add(
            new w.RadioToolItem({ label: 'Light', icon: 'weather-clear', group, active: true })
        );
        const dark = add(
            new w.RadioToolItem({ label: 'Dark', icon: 'weather-clear-night', group })
        );

        light.connect('toggle', () => light.active && (application.theme = 'light'));
        dark.connect('toggle', () => dark.active && (application.theme = 'dark'));

        // Follow theme changes made elsewhere, like in the View menu.
        application.connect('theme-change', () => {
            light.active = application.theme === 'light';
            dark.active = application.theme === 'dark';
        });

        return toolBar;
    }

    let throbber = null;
    let pulsingBar = null;
    let pulseTimer = 0;

    function setBusy(busy) {
        throbber.active = busy;

        clearInterval(pulseTimer);
        if (busy) {
            pulseTimer = setInterval(() => pulsingBar.pulse(), 100);
        } else {
            pulsingBar.fraction = 0;
        }

        say(busy ? 'Working…' : 'Done.');
    }

    function makeControlsPage() {
        const page = new w.Box({ spacing: 12, margin: 12 });
        const left = new w.Box({ orientation: 'vertical', spacing: 12, hExpand: true });
        const right = new w.Box({ orientation: 'vertical', spacing: 12, hExpand: true });

        page.addChild(left);
        page.addChild(right);

        const buttons = framed(left, 'Buttons');

        const hello = new w.Button({ label: '_Hello', useUnderline: true });
        hello.connect('activate', () => say('Hello!'));

        const open = new w.Button({ label: 'Open', icon: 'document-open' });
        open.connect('activate', openFile);

        const flat = new w.Button({ label: 'Flat', relief: 'none' });
        const insensitive = new w.Button({ label: 'Insensitive', sensitive: false });
        buttons.addChild(row(hello, open, flat, insensitive));

        const toggle = new w.ToggleButton({ label: 'Toggle me' });
        toggle.connect('toggle', () =>
            say(`The toggle button is ${toggle.active ? 'on' : 'off'}.`)
        );

        const menu = new w.Menu();
        for (const label of ['Copy', 'Paste', 'Rename']) {
            const item = new w.MenuItem({ label });
            item.connect('activate', () => say(`${label} chosen.`));
            menu.addChild(item);
        }

        const menuButton = new w.MenuButton({ label: 'Actions', menu });
        const link = new w.LinkButton({
            uri: 'https://github.com/gerbenvv/widgetry',
            label: 'Widgetry on GitHub',
        });
        buttons.addChild(row(toggle, menuButton, link));

        const checks = framed(left, 'Check boxes and radio buttons');
        checks.addChild(new w.CheckBox({ label: 'Remember me', active: true }));
        checks.addChild(new w.CheckBox({ label: 'Partly selected', inconsistent: true }));
        checks.addChild(new w.CheckBox({ label: 'Not available', sensitive: false }));

        const sizes = new w.ButtonGroup();
        const radios = new w.Box({ spacing: 12 });
        for (const [index, label] of ['Small', 'Medium', 'Large'].entries()) {
            const radio = new w.RadioButton({ label, group: sizes, active: index === 1 });
            radio.connect('toggle', () => radio.active && say(`Size: ${label}.`));
            radios.addChild(radio);
        }

        checks.addChild(radios);

        const labels = framed(right, 'Labels');
        labels.addChild(
            new w.Label({
                useMarkup: true,
                text: 'Labels can have <b>bold</b>, <i>italic</i>, <u>underlined</u> and <s>struck</s> text, <small>small</small> and <tt>code</tt>.',
                wrap: true,
            })
        );
        labels.addChild(
            new w.Label({
                text: 'A long label that is ellipsized in the middle when there is not enough room for it',
                ellipsize: 'middle',
                hAlign: 'fill',
            })
        );
        labels.addChild(
            new w.Label({ text: 'This label is selectable: try selecting it.', selectable: true })
        );

        const dim = new w.Label({ text: 'A dimmed, secondary label.' });
        dim.addStyleClass('dim-label');
        labels.addChild(dim);

        const status = framed(right, 'Activity');

        throbber = new w.Throbber({ pixelSize: 24 });
        pulsingBar = new w.ProgressBar({ text: 'Activity', showText: true, hExpand: true });

        const busy = new w.ToggleButton({ label: 'Busy' });
        busy.connect('toggle', () => setBusy(busy.active));

        status.addChild(row(throbber, pulsingBar, busy));

        return page;
    }

    function makeTextPage() {
        const page = new w.Box({ spacing: 12, margin: 12 });

        const form = new w.Grid({
            rowSpacing: 6,
            columnSpacing: 8,
            hExpand: true,
            vAlign: 'start',
        });
        page.addChild(form);

        let rowIndex = 0;
        const field = (label, widget) => {
            const caption = new w.Label({
                text: label,
                useUnderline: true,
                hAlign: 'end',
                mnemonicWidget: widget,
            });

            form.addChild(caption, rowIndex, 0);
            form.addChild(widget, rowIndex, 1);
            widget.hExpand = true;

            rowIndex += 1;

            return widget;
        };

        const name = field('_Name:', new w.LineEdit({ placeholder: 'Your name' }));
        const email = field(
            '_Email:',
            new w.LineEdit({
                placeholder: 'name@example.com',
                validator: new w.RegexpValidator({
                    regexp: '[^@\\s]+@[^@\\s]+\\.[^@\\s]+',
                    allowEmpty: true,
                }),
            })
        );
        const password = field('_Password:', new w.LineEdit({ visibility: false }));

        const search = field(
            'Searc_h:',
            new w.LineEdit({
                placeholder: 'Search…',
                primaryIcon: 'edit-find',
                secondaryIcon: 'edit-clear',
            })
        );
        search.connect('icon-press', (_edit, position) => {
            if (position === 'secondary') {
                search.text = '';
            }
        });

        const age = field('_Age:', new w.SpinButton({ lower: 0, upper: 120, value: 30 }));
        const amount = field(
            'A_mount:',
            new w.LineEdit({ text: '1,234.50', validator: new w.DoubleValidator({ decimals: 2 }) })
        );

        const country = field(
            '_Country:',
            new w.ComboBox({
                items: ['Belgium', 'Canada', 'Germany', 'Japan', 'Netherlands', 'United States'],
                active: 4,
            })
        );

        const date = field('_Date:', new w.DateEdit({ date: new Date() }));

        const notes = field(
            'N_otes:',
            new w.TextView({ text: 'A multi-line text view.\nIt wraps long lines.', height: 90 })
        );

        const submit = new w.Button({ label: '_Submit', useUnderline: true, hAlign: 'end' });
        form.addChild(submit, rowIndex, 1);

        submit.connect('activate', () => {
            const summary = [
                `Name: ${name.text || '(none)'}`,
                `Email: ${email.text || '(none)'}${email.isValid ? '' : ' (invalid)'}`,
                `Password: ${'•'.repeat(password.text.length) || '(none)'}`,
                `Age: ${age.value}`,
                `Amount: ${amount.text}`,
                `Country: ${country.text}`,
                `Date: ${date.date ? date.date.toDateString() : '(none)'}`,
                `Notes: ${notes.text.length} characters`,
            ].join('\n');

            w.alert('Form submitted', { secondaryText: summary });
        });

        const calendarBox = new w.Box({ orientation: 'vertical', spacing: 6, vAlign: 'start' });
        const calendar = new w.Calendar({ showWeekNumbers: true });
        const picked = new w.Label({ text: 'Pick a day.' });

        calendar.connect(
            'day-selected',
            () => (picked.text = `Selected: ${calendar.date.toDateString()}`)
        );
        calendar.connect('day-activate', () => {
            date.date = calendar.date;
            say('Copied the day to the date field.');
        });

        calendarBox.addChild(calendar);
        calendarBox.addChild(picked);
        calendarBox.addChild(
            new w.Label({ text: 'Double-click a day to use it in the form.', wrap: true })
        );
        page.addChild(calendarBox);

        return page;
    }

    function makeRangesPage() {
        const page = new w.Box({ orientation: 'vertical', spacing: 12, margin: 12 });

        // One adjustment shared by a slider, a spin button, a progress bar and a scroll bar.
        const adjustment = new w.Adjustment({
            lower: 0,
            upper: 100,
            value: 40,
            stepIncrement: 1,
            pageIncrement: 10,
        });

        const shared = framed(page, 'One adjustment, four views');

        const slider = new w.Slider({ adjustment, digits: 0, hExpand: true });
        slider.addMark(0, 'bottom', '0');
        slider.addMark(50, 'bottom', '50');
        slider.addMark(100, 'bottom', '100');

        const spin = new w.SpinButton({ adjustment, widthChars: 5 });
        shared.addChild(row(slider, spin));

        const progress = new w.ProgressBar({ showText: true });
        const updateProgress = () => (progress.fraction = adjustment.fraction);
        adjustment.connect('value-change', updateProgress);
        updateProgress();
        shared.addChild(progress);

        const scrollBar = new w.ScrollBar({
            adjustment: new w.Adjustment({
                lower: 0,
                upper: 1000,
                pageSize: 200,
                value: 300,
                stepIncrement: 20,
            }),
        });
        shared.addChild(scrollBar);

        const vertical = framed(page, 'Vertical', { vExpand: true });
        const sliders = new w.Box({ spacing: 24, vExpand: true, hAlign: 'start' });

        for (const value of [20, 50, 80]) {
            sliders.addChild(
                new w.Slider({
                    orientation: 'vertical',
                    value,
                    upper: 100,
                    inverted: true,
                    digits: 0,
                })
            );
        }

        sliders.addChild(
            new w.ProgressBar({
                orientation: 'vertical',
                fraction: 0.7,
                inverted: true,
                showText: true,
            })
        );
        sliders.addChild(
            new w.ScrollBar({
                orientation: 'vertical',
                adjustment: new w.Adjustment({ upper: 100, pageSize: 25, value: 10 }),
            })
        );

        vertical.addChild(sliders);

        return page;
    }

    function formatSize(bytes) {
        if (bytes === null || bytes === undefined) {
            return '';
        }

        const units = ['bytes', 'kB', 'MB', 'GB'];
        let unit = 0;
        let value = bytes;
        while (value >= 1000 && unit < units.length - 1) {
            value /= 1000;
            unit += 1;
        }

        return unit === 0 ? `${value} bytes` : `${value.toFixed(1)} ${units[unit]}`;
    }

    function makeTablePage() {
        const page = new w.Box({ orientation: 'vertical', spacing: 6, margin: 12 });

        const model = new w.ListModel({
            rows: demoData.makeFiles(FILE_COUNT),
            idColumn: 'id',
            sortColumn: 'name',
        });
        const filter = new w.SearchFilter({ columns: ['name', 'type', 'owner'] });
        const filtered = new w.FilteredListModel(model, filter);

        const search = new w.LineEdit({
            placeholder: `Search ${FILE_COUNT.toLocaleString()} files…`,
            primaryIcon: 'edit-find',
            secondaryIcon: 'edit-clear',
            hExpand: true,
        });
        const count = new w.Label({ text: '' });

        const updateCount = () => (count.text = `${filtered.rowsCount.toLocaleString()} shown`);

        search.connect('text-change', () => {
            filter.query = search.text;
            updateCount();
        });
        search.connect(
            'icon-press',
            (_edit, position) => position === 'secondary' && (search.text = '')
        );

        page.addChild(row(new w.Label({ text: 'Filter:' }), search, count));

        const table = new w.Table({
            model: filtered,
            selectionModes: w.SelectionModes.MULTI,
            vExpand: true,
            placeholderText: 'No matching files.',
        });
        table.addColumn(new w.IndexColumn());
        table.addColumn(new w.TextColumn({ name: 'name', label: 'Name', expand: true }));
        table.addColumn(new w.TextColumn({ name: 'type', label: 'Type' }));
        table.addColumn(new w.NumberColumn({ name: 'size', label: 'Size', formatter: formatSize }));
        table.addColumn(new w.DateColumn({ name: 'modified', label: 'Modified', format: 'date' }));
        table.addColumn(new w.TextColumn({ name: 'owner', label: 'Owner' }));
        table.addColumn(
            new w.CheckBoxColumn({ name: 'starred', label: 'Starred', editable: true })
        );

        table.connect('row-activate', (_table, index) => {
            const file = filtered.getRow(index);

            w.alert(file.name, {
                secondaryText: `${file.type}, ${formatSize(file.size) || 'no size'}, owned by ${file.owner}.`,
            });
        });

        w.attachContextMenu(table, () => {
            const menu = new w.Menu();
            const selected = table.selection.selectedRowIds;

            const star = new w.MenuItem({
                label: '_Star',
                icon: 'starred',
                sensitive: selected.length > 0,
            });
            star.connect('activate', () => {
                selected.forEach((id) => model.updateRowById(id, { starred: true }));
                say(`Starred ${selected.length} file(s).`);
            });

            const remove = new w.MenuItem({
                label: '_Delete',
                icon: 'edit-delete',
                sensitive: selected.length > 0,
            });
            remove.connect('activate', () => {
                selected.forEach((id) => model.removeRow(model.getRowIndexById(id)));
                updateCount();
                say(`Deleted ${selected.length} file(s).`);
            });

            menu.addChild(star);
            menu.addChild(new w.SeparatorMenuItem());
            menu.addChild(remove);

            return menu;
        });

        page.addChild(table);
        page.addChild(
            new w.Label({
                text: 'Click a header to sort, drag its edge to resize, double-click or press Enter to open a file, and right-click for a menu.',
                wrap: true,
            })
        );

        updateCount();

        return page;
    }

    function makeLayoutPage() {
        const paned = new w.Paned({ position: 380, margin: 12 });

        const left = new w.Box({ orientation: 'vertical', spacing: 12, margin: { right: 6 } });
        const right = new w.Box({ orientation: 'vertical', spacing: 12, margin: { left: 6 } });

        paned.addChild(
            new w.ScrollArea({ child: left, hPolicy: 'never', shadowType: 'none' }),
            true
        );
        paned.addChild(
            new w.ScrollArea({ child: right, hPolicy: 'never', shadowType: 'none' }),
            true
        );

        // Alignment in a vertical box.
        const alignment = framed(left, 'Alignment');
        for (const align of ['start', 'center', 'end', 'fill']) {
            alignment.addChild(new w.Button({ label: `hAlign: ${align}`, hAlign: align }));
        }

        // Expanding children in a horizontal box.
        const expanding = framed(left, 'Expanding');
        expanding.addChild(
            row(
                new w.Button({ label: 'Natural' }),
                new w.Button({ label: 'Expands', hExpand: true }),
                new w.Button({ label: 'Natural' })
            )
        );

        const homogeneous = new w.Box({ homogeneous: true, spacing: 6 });
        ['A', 'Homogeneous', 'Box'].forEach((label) =>
            homogeneous.addChild(new w.Button({ label }))
        );
        expanding.addChild(homogeneous);

        // A grid with spans.
        const gridBox = framed(left, 'Grid');
        const grid = new w.Grid({ rowSpacing: 4, columnSpacing: 4 });
        grid.addChild(new w.Button({ label: 'Two columns', hExpand: true }), 0, 0, 1, 2);
        grid.addChild(new w.Button({ label: 'Two rows', vExpand: true }), 0, 2, 2, 1);
        grid.addChild(new w.Button({ label: 'One' }), 1, 0);
        grid.addChild(new w.Button({ label: 'Two' }), 1, 1);
        gridBox.addChild(grid);

        // Button boxes with their layout styles.
        const boxes = framed(right, 'Button boxes');
        for (const style of ['start', 'center', 'end', 'edge', 'spread']) {
            const buttonBox = new w.ButtonBox({ layoutStyle: style, spacing: 6 });
            buttonBox.addChild(new w.Button({ label: 'OK' }));
            buttonBox.addChild(new w.Button({ label: 'Cancel' }));

            boxes.addChild(new w.Label({ text: style, hAlign: 'start' }));
            boxes.addChild(buttonBox);
        }

        // Expanders, and a resizer inside one.
        const expanders = framed(right, 'Expanders');

        const details = new w.Expander({ label: 'Details', expanded: true });
        details.addChild(
            new w.Label({
                text: 'Expanders hide content until it is needed. The one below holds a resizer.',
                wrap: true,
            })
        );
        expanders.addChild(details);

        const more = new w.Expander({ label: 'Resizable area' });
        const resizer = new w.Resizer({ size: { width: 240, height: 90 } });
        resizer.addChild(new w.Label({ text: 'Drag the grip to resize me.' }));
        more.addChild(resizer);
        expanders.addChild(more);

        return paned;
    }

    function makeCanvasPage() {
        const page = new w.Box({ orientation: 'vertical', spacing: 6, margin: 12 });

        page.addChild(
            new w.Label({
                text: 'A small diagram on the vector canvas: drag the boxes to move them.',
                hAlign: 'start',
            })
        );

        const frame = new w.Frame({ shadowType: 'in', vExpand: true });
        const canvas = new w.VectorCanvas({ label: 'A diagram', vExpand: true, hExpand: true });
        frame.addChild(canvas);
        page.addChild(frame);

        const nodes = [
            { name: 'Input', x: 40, y: 60, fill: '#d6e6f7' },
            { name: 'Parse', x: 240, y: 30, fill: '#e3f1d4' },
            { name: 'Validate', x: 240, y: 150, fill: '#e3f1d4' },
            { name: 'Store', x: 450, y: 90, fill: '#fbe6cf' },
            { name: 'Report', x: 450, y: 220, fill: '#f0dcef' },
        ];
        const links = [
            ['Input', 'Parse'],
            ['Input', 'Validate'],
            ['Parse', 'Store'],
            ['Validate', 'Store'],
            ['Validate', 'Report'],
        ];

        const NODE_WIDTH = 120;
        const NODE_HEIGHT = 44;

        const byName = new Map();
        const paths = links.map(([from, to]) => {
            const path = new w.Path({ strokeColor: '#8d8577', strokeWidth: 2, fill: 'none' });
            canvas.addSprite(path);

            return { from, to, path };
        });

        function updateLinks() {
            for (const { from, to, path } of paths) {
                const a = byName.get(from).position;
                const b = byName.get(to).position;

                const x1 = a.x + NODE_WIDTH;
                const y1 = a.y + NODE_HEIGHT / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_HEIGHT / 2;
                const middle = (x1 + x2) / 2;

                path.path = `M ${x1} ${y1} C ${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`;
            }
        }

        for (const node of nodes) {
            const box = new w.Rectangle({
                name: node.name,
                position: { x: node.x, y: node.y },
                size: { width: NODE_WIDTH, height: NODE_HEIGHT },
                fill: node.fill,
                strokeColor: '#8d8577',
                cornerRadius: 4,
                events: w.Events.BUTTON_PRESS | w.Events.MOTION | w.Events.BUTTON_RELEASE,
            });

            const label = new w.LabelSprite({
                text: node.name,
                position: { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 },
                anchor: w.LabelAnchor.MIDDLE,
                baseline: 'middle',
                fill: '#15130f',
            });
            label.addStyleClass('demo-node-label');

            let offset = null;
            box.connect('button-press-event', (_sprite, event) => {
                const point = canvas.getCanvasPoint(event.x, event.y);
                offset = { x: point.x - box.position.x, y: point.y - box.position.y };
                canvas.raiseSprite(box);
                canvas.raiseSprite(label);

                return true;
            });
            box.connect('motion-event', (_sprite, event) => {
                if (!offset) {
                    return false;
                }

                const point = canvas.getCanvasPoint(event.x, event.y);
                const position = { x: point.x - offset.x, y: point.y - offset.y };

                box.position = position;
                label.position = {
                    x: position.x + NODE_WIDTH / 2,
                    y: position.y + NODE_HEIGHT / 2,
                };
                updateLinks();

                return true;
            });
            box.connect('button-release-event', () => {
                offset = null;
                say(`Moved ${node.name}.`);

                return true;
            });

            canvas.addSprite(box);
            canvas.addSprite(label);
            byName.set(node.name, box);
        }

        updateLinks();

        return page;
    }

    function makeDragPage() {
        const page = new w.Box({ spacing: 12, margin: 12, homogeneous: true });

        const lists = [];

        function makeList(title, items) {
            const frame = new w.Frame({
                label: title,
                droppable: true,
                events: w.Events.DRAG_DROP | w.Events.DRAG_MOTION,
            });
            const list = new w.Box({
                orientation: 'vertical',
                spacing: 4,
                margin: 8,
                vAlign: 'start',
            });

            frame.addChild(list);
            page.addChild(frame);

            frame.connect('drag-drop-event', (_frame, event) => {
                const item = event.context.getData('application/x-demo-item');
                if (!item || item.parent === list) {
                    return false;
                }

                item.parent.removeChild(item);
                list.addChild(item);
                say(`Moved “${item.text}” to ${title}.`);

                return true;
            });

            for (const text of items) {
                list.addChild(makeItem(text));
            }

            lists.push(list);
        }

        function makeItem(text) {
            const item = new w.Label({
                text,
                hAlign: 'fill',
                draggable: true,
                events: w.Events.DRAG_START,
            });

            item.addStyleClass('demo-drag-item');
            item.connect('drag-start-event', (_item, event) => {
                event.context.setData('application/x-demo-item', item);
                event.context.icon = text;

                return true;
            });

            return item;
        }

        makeList('To do', [
            'Write the documentation',
            'Fix the flaky test',
            'Review the pull request',
        ]);
        makeList('Doing', ['Port the widgets']);
        makeList('Done', ['Find the old library']);

        return page;
    }

    let toolWindowCount = 0;

    function openToolWindow() {
        toolWindowCount += 1;

        const window = new w.Window({
            title: `Window ${toolWindowCount}`,
            width: 320,
            height: 220,
            x: 120 + toolWindowCount * 30,
            y: 120 + toolWindowCount * 30,
        });

        const box = new w.Box({ orientation: 'vertical', spacing: 8, margin: 12 });
        box.addChild(
            new w.Label({
                text: 'Floating windows can be moved by their title bar, resized at the edges, maximized with a double click and closed.',
                wrap: true,
            })
        );

        const opacity = new w.Slider({
            lower: 0.3,
            upper: 1,
            value: 1,
            digits: 2,
            stepIncrement: 0.05,
        });
        opacity.connect('value-change', () => (window.opacity = opacity.value));
        box.addChild(row(new w.Label({ text: 'Opacity:' }), opacity));
        opacity.hExpand = true;

        const close = new w.Button({ label: 'Close', hAlign: 'end', vAlign: 'end', vExpand: true });
        close.connect('activate', () => window.close());
        box.addChild(close);

        window.addChild(box);
        window.present();
    }

    async function openFile() {
        const name = await w.prompt('Open a file', {
            secondaryText: 'Type a file name:',
            text: 'notes.txt',
        });
        if (name) {
            say(`Opened ${name} (not really).`);
        }
    }

    function openPreferences() {
        const dialog = new w.Dialog({
            title: 'Preferences',
            transientFor: mainWindow,
            modal: true,
        });

        const grid = new w.Grid({ rowSpacing: 6, columnSpacing: 8, margin: 12 });

        const theme = new w.ComboBox({
            items: [
                { id: 'light', label: 'Light' },
                { id: 'dark', label: 'Dark' },
                { id: 'auto', label: 'Automatic' },
            ],
            activeId: application.theme,
        });
        const delay = new w.SpinButton({
            lower: 0,
            upper: 2000,
            stepIncrement: 50,
            value: application.tooltipAppearDelay,
        });

        grid.addChild(
            new w.Label({
                text: '_Theme:',
                useUnderline: true,
                mnemonicWidget: theme,
                hAlign: 'end',
            }),
            0,
            0
        );
        grid.addChild(theme, 0, 1);
        grid.addChild(
            new w.Label({
                text: 'Tooltip _delay (ms):',
                useUnderline: true,
                mnemonicWidget: delay,
                hAlign: 'end',
            }),
            1,
            0
        );
        grid.addChild(delay, 1, 1);

        dialog.addChild(grid);
        dialog.addButton(w.Response.CANCEL);
        dialog.addButton(w.Response.OK);
        dialog.defaultResponse = w.Response.OK;

        dialog.run().then((response) => {
            if (response === w.Response.OK) {
                application.theme = theme.activeId;
                application.tooltipAppearDelay = delay.value;
                say('Preferences applied.');
            }
        });
    }

    function showShortcuts() {
        w.alert('Keyboard shortcuts', {
            secondaryText: [
                'F10: open the menu bar',
                'Alt+letter: open a menu or use a mnemonic',
                'Tab / Shift+Tab: move the focus',
                'Ctrl+Page Up / Page Down: switch notebook pages',
                'F8: focus a pane splitter',
                'Shift+F10: open a context menu',
                'Ctrl+Alt+N: new window, Ctrl+O: open, Ctrl+Q: quit',
            ].join('\n'),
        });
    }

    function showAbout() {
        const dialog = new w.MessageDialog({
            title: 'About Widgetry',
            messageType: 'info',
            buttonsType: 'close',
            text: 'Widgetry 1.0',
            secondaryText:
                'A desktop-style widget toolkit for the browser, in the spirit of GTK and the Clearlooks theme.\n\nMIT licensed.',
            transientFor: mainWindow,
        });

        dialog.run();
    }

    async function quit() {
        if (await w.confirm('Quit the demo?', { secondaryText: 'This just reloads the page.' })) {
            location.reload();
        }
    }

    function build() {
        mainWindow = new w.MainWindow({ title: 'Widgetry demo' });

        const layout = new w.Box({ orientation: 'vertical' });

        const { menuBar, builder } = makeMenuBar();
        const toolBar = makeToolBar();

        const notebook = new w.Notebook({ vExpand: true, margin: 6 });
        notebook.appendPage(makeControlsPage(), 'Controls');
        notebook.appendPage(makeTextPage(), 'Text and dates');
        notebook.appendPage(makeRangesPage(), 'Ranges');
        notebook.appendPage(makeTablePage(), 'Table');
        notebook.appendPage(makeLayoutPage(), 'Layout');
        notebook.appendPage(makeCanvasPage(), 'Canvas');
        notebook.appendPage(makeDragPage(), 'Drag and drop');

        statusBar = new w.StatusBar();
        statusContext = statusBar.getContextId('demo');
        statusBar.addChild(new w.Label({ text: `Widgetry ${w.VERSION || '1.0'}` }));
        statusBar.push(statusContext, 'Ready.');

        layout.addChild(menuBar);
        layout.addChild(toolBar);
        layout.addChild(notebook);
        layout.addChild(statusBar);

        mainWindow.addChild(layout);
        mainWindow.show();

        // The theme items of the View menu follow theme changes made elsewhere.
        application.connect('theme-change', () => {
            builder.getObjectById(`theme-${application.theme}`).active = true;
        });

        // The View menu toggles the tool bar and the status bar.
        const showToolBar = builder.getObjectById('show-tool-bar');
        const showStatusBar = builder.getObjectById('show-status-bar');

        showToolBar.connect('toggle', () => (toolBar.visible = showToolBar.active));
        showStatusBar.connect('toggle', () => (statusBar.visible = showStatusBar.active));

        notebook.connect('switch-page', () =>
            say(`Showing “${notebook.getTabLabelText(notebook.getPage(notebook.currentPage))}”.`)
        );
    }

    application.ready(build);
})();
