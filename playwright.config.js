import { defineConfig } from '@playwright/test';

// Browser tests live next to the widgets they test, in `tests/` directories; `tests/` at the root
// holds the harness and tests of the README examples.
export default defineConfig({
    testDir: '.',
    testMatch: [
        'src/widgets/tests/*_test.js',
        'src/columns/tests/*_test.js',
        'src/sprites/tests/*_test.js',
        'src/events/tests/*_test.js',
        'tests/*_test.js',
    ],
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 1280, height: 800 },
    },
    projects: [
        {
            name: 'chromium',
            // Set PLAYWRIGHT_CHANNEL=chrome to use an installed Google Chrome instead.
            use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
        },
        {
            name: 'firefox',
            // Set PLAYWRIGHT_FIREFOX_CHANNEL=moz-firefox to use an installed Firefox instead.
            use: {
                browserName: 'firefox',
                channel: process.env.PLAYWRIGHT_FIREFOX_CHANNEL || undefined,
            },
        },
    ],
    webServer: {
        command: 'node scripts/serve.js --port 4173',
        url: 'http://127.0.0.1:4173/tests/harness.html',
        reuseExistingServer: !process.env.CI,
    },
});
