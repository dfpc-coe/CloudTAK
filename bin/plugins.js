import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../app/plugins/', import.meta.url));
const allowed = new Set(['README.md', 'example.ts']);

const custom = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((entry) => !allowed.has(entry.name))
    .filter((entry) => entry.isDirectory() || entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();

if (custom.length) {
    console.error('not ok - custom plugins present in app/plugins/, remove them before building the app:');
    for (const name of custom) console.error(`  - ${name}`);
    process.exitCode = 1;
} else {
    console.error('ok - no custom plugins');
}
