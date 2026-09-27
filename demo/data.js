// Sample data for the demo: a large, deterministic list of files.
(function () {
    'use strict';

    // Word lists to make up file names from.
    const ADJECTIVES = [
        'annual',
        'draft',
        'final',
        'quarterly',
        'shared',
        'old',
        'new',
        'weekly',
        'team',
        'project',
        'backup',
        'summer',
    ];
    const NOUNS = [
        'report',
        'budget',
        'notes',
        'photos',
        'slides',
        'invoice',
        'plan',
        'letter',
        'recipes',
        'schedule',
        'music',
        'contacts',
    ];
    const KINDS = [
        { type: 'Document', extension: 'odt', icon: 'text-x-generic' },
        { type: 'Spreadsheet', extension: 'ods', icon: 'x-office-spreadsheet' },
        { type: 'Presentation', extension: 'odp', icon: 'x-office-presentation' },
        { type: 'Plain text', extension: 'txt', icon: 'text-x-generic' },
        { type: 'Chart', extension: 'svg', icon: 'office-chart-line' },
        { type: 'Folder', extension: '', icon: 'folder' },
    ];
    const OWNERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];

    // A small deterministic pseudo-random number generator (mulberry32).
    function createRandom(seed) {
        return function () {
            seed = (seed + 0x6d2b79f5) | 0;

            let t = seed;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pick(random, items) {
        return items[Math.floor(random() * items.length)];
    }

    /**
     * Makes `count` file rows with id, name, type, size, modified date, owner and a starred flag.
     */
    function makeFiles(count) {
        const random = createRandom(2013);
        const now = Date.UTC(2026, 8, 27);
        const rows = [];

        for (let id = 1; id <= count; ++id) {
            const kind = pick(random, KINDS);
            const base = `${pick(random, ADJECTIVES)}-${pick(random, NOUNS)}-${id}`;
            const name = kind.extension ? `${base}.${kind.extension}` : base;

            rows.push({
                id,
                name,
                icon: kind.icon,
                type: kind.type,
                size: kind.extension ? Math.round(Math.pow(random(), 3) * 50_000_000) : null,
                modified: new Date(now - Math.floor(random() * 3 * 365 * 86_400_000)),
                owner: pick(random, OWNERS),
                starred: random() < 0.15,
            });
        }

        return rows;
    }

    window.demoData = { makeFiles };
})();
