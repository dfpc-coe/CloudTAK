/*
* Plugin bundles kept on the device so a plugin that has been loaded once
* can be loaded again without a connection: the app's data directory on iOS
* and Android, the Origin Private File System in a browser
*/

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { stdurl, getRuntimeToken } from '../std.ts';
import type { Plugin } from '../types.ts';

const PLUGINS_DIR = 'Plugins';
const MANIFEST = 'plugin.json';

/**
 * One directory per plugin id holding its bundle and manifest.
 * Every method rejects when what it is asked for is not stored
 */
interface PluginFiles {
    ids(): Promise<string[]>;
    read(id: string, name: string): Promise<string>;
    write(id: string, name: string, data: string): Promise<void>;
    /** URL the file can be imported from */
    url(id: string, name: string): Promise<string>;
    remove(id: string): Promise<void>;
}

function nativePath(...parts: string[]) {
    return {
        directory: Directory.Data,
        path: [PLUGINS_DIR, ...parts].join('/')
    };
}

const native: PluginFiles = {
    async ids() {
        const { files } = await Filesystem.readdir(nativePath());
        return files.filter((file) => file.type === 'directory').map((file) => file.name);
    },

    async read(id, name) {
        const { data } = await Filesystem.readFile({ ...nativePath(id, name), encoding: Encoding.UTF8 });
        return String(data);
    },

    async write(id, name, data) {
        await Filesystem.writeFile({ ...nativePath(id, name), data, encoding: Encoding.UTF8, recursive: true });
    },

    async url(id, name) {
        const { uri } = await Filesystem.stat(nativePath(id, name));
        return Capacitor.convertFileSrc(uri);
    },

    async remove(id) {
        await Filesystem.rmdir({ ...nativePath(id), recursive: true });
    }
};

async function opfsDir(id?: string, create = false): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    const plugins = await root.getDirectoryHandle(PLUGINS_DIR, { create });

    return id ? plugins.getDirectoryHandle(id, { create }) : plugins;
}

async function opfsFile(id: string, name: string): Promise<File> {
    const dir = await opfsDir(id);
    return (await dir.getFileHandle(name)).getFile();
}

const opfs: PluginFiles = {
    async ids() {
        const ids: string[] = [];
        for await (const entry of (await opfsDir()).values()) {
            if (entry.kind === 'directory') ids.push(entry.name);
        }

        return ids;
    },

    async read(id, name) {
        return (await opfsFile(id, name)).text();
    },

    async write(id, name, data) {
        const dir = await opfsDir(id, true);
        const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();

        try {
            await writable.write(data);
        } finally {
            await writable.close();
        }
    },

    async url(id, name) {
        return URL.createObjectURL(new Blob([await opfsFile(id, name)], { type: 'text/javascript' }));
    },

    async remove(id) {
        await (await opfsDir()).removeEntry(id, { recursive: true });
    }
};

function supportsOpfs(): boolean {
    return typeof navigator !== 'undefined'
        && typeof navigator.storage?.getDirectory === 'function'
        && typeof FileSystemFileHandle !== 'undefined'
        && 'createWritable' in FileSystemFileHandle.prototype;
}

function store(): PluginFiles | undefined {
    if (Capacitor.isNativePlatform()) return native;
    if (supportsOpfs()) return opfs;
    return undefined;
}

const missing = () => undefined;

function bundleUrl(plugin: Plugin): URL {
    const url = stdurl(`/api/plugin/${plugin.id}/bundle`);
    url.searchParams.set('sha256', String(plugin.sha256));
    return url;
}

async function sha256(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function download(plugin: Plugin): Promise<string> {
    const token = await getRuntimeToken();
    const res = await fetch(bundleUrl(plugin), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!res.ok) throw new Error(`Failed to download ${plugin.name}: ${res.status}`);

    const source = await res.text();
    if (await sha256(source) !== plugin.sha256) {
        throw new Error(`${plugin.name} bundle does not match its sha256`);
    }

    return source;
}

/**
 * URL the plugin's bundle can be imported from. The bundle is downloaded
 * and stored on first use, then served from the device. A platform with
 * nowhere to store bundles imports straight from the server
 */
export async function pluginUrl(plugin: Plugin): Promise<string> {
    const files = store();

    if (!files) {
        const url = bundleUrl(plugin);
        const token = await getRuntimeToken();
        if (token) url.searchParams.set('token', token);
        return url.href;
    }

    const name = `${plugin.sha256}.js`;

    const stored = await files.url(plugin.id, name).catch(missing);
    if (stored) return stored;

    const source = await download(plugin);

    await files.remove(plugin.id).catch(missing);
    await files.write(plugin.id, name, source);
    await files.write(plugin.id, MANIFEST, JSON.stringify(plugin));

    return files.url(plugin.id, name);
}

/**
 * Plugins whose bundle is stored on the device
 */
export async function listStoredPlugins(): Promise<Plugin[]> {
    const files = store();
    if (!files) return [];

    const plugins: Plugin[] = [];
    for (const id of await files.ids().catch(() => [])) {
        try {
            plugins.push(JSON.parse(await files.read(id, MANIFEST)) as Plugin);
        } catch {
            // No readable manifest means the download was interrupted
        }
    }

    return plugins.sort((a, b) => a.name.localeCompare(b.name));
}

export async function removeStoredPlugin(id: string): Promise<void> {
    await store()?.remove(id).catch(missing);
}
