import path from 'node:path';
import fs from 'node:fs/promises';

const pkg_root = JSON.parse(String(await fs.readFile(path.resolve('../package.json'))));
const pkg_api = JSON.parse(String(await fs.readFile(path.resolve('../api/package.json'))));
const pkg_web = JSON.parse(String(await fs.readFile(path.resolve('../api/web/package.json'))));

pkg_api.version = pkg_root;
pkg_web.version = pkg_root;

await fs.writeFile(path.resolve('../api/package.json'), JSON.stringify(pkg_api, null, 4));
await fs.writeFile(path.resolve('../api/web/package.json'), JSON.stringify(pkg_web, null, 4));
