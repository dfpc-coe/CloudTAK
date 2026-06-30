import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const stage = process.argv.includes('--stage');

const pkg_root = JSON.parse(String(await fs.readFile(new URL('../package.json', import.meta.url))));
const pkg_api = JSON.parse(String(await fs.readFile(new URL('../api/package.json', import.meta.url))));
const pkg_web = JSON.parse(String(await fs.readFile(new URL('../api/web/package.json', import.meta.url))));
const capacitor = JSON.parse(String(await fs.readFile(new URL('../capacitor.config.json', import.meta.url))));

console.error('ok version - ' + pkg_root.version);

pkg_api.version = pkg_root.version;
pkg_web.version = pkg_root.version;
capacitor.plugins.CapacitorUpdater.version = pkg_root.version;

const updated = [
    new URL('../api/package.json', import.meta.url),
    new URL('../api/web/package.json', import.meta.url),
    new URL('../capacitor.config.json', import.meta.url)
];

await fs.writeFile(updated[0], JSON.stringify(pkg_api, null, 4));
await fs.writeFile(updated[1], JSON.stringify(pkg_web, null, 4));
await fs.writeFile(updated[2], JSON.stringify(capacitor, null, 4));

console.error('ok saved');

if (stage) {
    const root = fileURLToPath(new URL('../', import.meta.url));
    execFileSync('git', ['add', ...updated.map(fileURLToPath)], { cwd: root, stdio: 'inherit' });
    console.error('ok staged');
}
