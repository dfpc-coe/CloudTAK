import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = new URL('../../app/', import.meta.url);
const PLUGINS_DIR = new URL('plugins/', WEB_ROOT);
const PUBLIC_DIR = new URL('public/', WEB_ROOT);

function pluginURLs(): string[] {
    const raw = [
        ...process.argv.slice(2),
        ...(process.env.WEB_PLUGINS ? [process.env.WEB_PLUGINS] : [])
    ];

    return raw
        .flatMap((entry) => entry.split(/[\s,]+/))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function parsePlugin(entry: string): { url: string, rev?: string } {
    const idx = entry.lastIndexOf('#');
    if (idx === -1) return { url: entry };
    return { url: entry.slice(0, idx), rev: entry.slice(idx + 1) };
}

function pluginName(url: string): string {
    return path.basename(url, '.git');
}

async function exists(target: URL): Promise<boolean> {
    try {
        await fs.stat(target);
        return true;
    } catch {
        return false;
    }
}

async function removeDanglingLink(name: string): Promise<void> {
    const link = fileURLToPath(new URL(name, PLUGINS_DIR));

    const entry = await fs.lstat(link).catch(() => null);
    if (!entry || !entry.isSymbolicLink()) return;
    if (await exists(new URL(name + '/', PLUGINS_DIR))) return;

    console.error(`ok - removing dangling plugin link '${name}'`);
    await fs.unlink(link);
}

async function listFiles(root: URL, prefix = ''): Promise<string[]> {
    const entries = await fs.readdir(new URL(prefix, root), { withFileTypes: true });

    const files: string[] = [];
    for (const entry of entries) {
        const rel = prefix + entry.name;

        if (entry.isDirectory()) {
            files.push(...await listFiles(root, rel + '/'));
        } else {
            files.push(rel);
        }
    }

    return files;
}

/**
 * Copy a plugin's `public/` directory into the CloudTAK Vite public directory.
 * Refuses to overwrite any pre-existing (core CloudTAK) asset.
 */
async function installPublicAssets(name: string, pluginDir: URL): Promise<void> {
    const pluginPublic = new URL('public/', pluginDir);

    if (!await exists(pluginPublic)) return;

    const files = await listFiles(pluginPublic);

    // Detect collisions up-front so a plugin can never partially overwrite core assets
    const collisions: string[] = [];
    for (const file of files) {
        if (await exists(new URL(file, PUBLIC_DIR))) {
            collisions.push(file);
        }
    }

    if (collisions.length) {
        throw new Error(
            `Plugin '${name}' public assets would overwrite core CloudTAK assets:\n`
            + collisions.map((file) => `  - ${file}`).join('\n')
        );
    }

    for (const file of files) {
        const dest = new URL(file, PUBLIC_DIR);
        await fs.mkdir(new URL('.', dest), { recursive: true });
        await fs.copyFile(new URL(file, pluginPublic), dest);
    }

    console.error(`ok - installed ${files.length} public asset(s) from plugin '${name}'`);
}

async function main(): Promise<void> {
    const urls = pluginURLs();

    if (!urls.length) {
        console.error('ok - no plugins to install');
        return;
    }

    await fs.mkdir(PLUGINS_DIR, { recursive: true });

    for (const entry of urls) {
        const { url, rev } = parsePlugin(entry);
        const name = pluginName(url);
        const pluginDir = new URL(name + '/', PLUGINS_DIR);
        const dir = fileURLToPath(pluginDir);

        await removeDanglingLink(name);

        if (await exists(pluginDir)) {
            console.error(`ok - plugin '${name}' already present, skipping clone`);
        } else {
            console.error(`ok - cloning plugin '${name}' from ${url}`);
            execFileSync('git', ['clone', '--depth', '1', url, dir], { stdio: 'inherit' });

            if (rev) {
                console.error(`ok - pinning plugin '${name}' to ${rev}`);
                execFileSync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', rev], { stdio: 'inherit' });
                execFileSync('git', ['-C', dir, 'checkout', '--quiet', rev], { stdio: 'inherit' });
            }
        }

        await installPublicAssets(name, pluginDir);
    }

    console.error(`ok - installed ${urls.length} plugin(s)`);
}

await main();
