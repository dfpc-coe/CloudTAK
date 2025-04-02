import fs from 'node:fs/promises';
import CP from 'child_process';


const pkg_root = JSON.parse(String(await fs.readFile(new URL('../package.json', import.meta.url))));
const pkg_api = JSON.parse(String(await fs.readFile(new URL('../api/package.json', import.meta.url))));
const pkg_web = JSON.parse(String(await fs.readFile(new URL('../api/web/package.json', import.meta.url))));

pkg_api.version = pkg_root.version;
pkg_web.version = pkg_root.version;

await fs.writeFile(new URL('../api/package.json', import.meta.url), JSON.stringify(pkg_api, null, 4));
await fs.writeFile(new URL('../api/web/package.json', import.meta.url), JSON.stringify(pkg_web, null, 4));

console.log(String(CP.execSync(`
    git commit -am "Update Version" && git push
`)))

