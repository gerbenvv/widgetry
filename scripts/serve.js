// Serves the repository over HTTP for the demo and the browser tests. Run with `npm run serve`.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} */
const ROOT_PATH = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.map': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.ico': 'image/x-icon',
};

const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 8080;

const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');

    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch (_error) {
        response.writeHead(400).end('Bad request');

        return;
    }

    // Serve only files in the repository, not in directories next to it with a longer name.
    let filePath = normalize(join(ROOT_PATH, pathname));
    if (filePath !== ROOT_PATH && !filePath.startsWith(ROOT_PATH + sep)) {
        response.writeHead(403).end();

        return;
    }

    try {
        let info = await stat(filePath);
        if (info.isDirectory()) {
            filePath = join(filePath, 'index.html');
            info = await stat(filePath);
        }

        response.writeHead(200, {
            'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });

        createReadStream(filePath).pipe(response);
    } catch (_error) {
        response.writeHead(404).end('Not found');
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Serving ${ROOT_PATH} at http://127.0.0.1:${port}/`);
});
