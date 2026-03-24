import fs from 'node:fs/promises';
import Err from '@openaddresses/batch-error';

import Config from './config.js';

export interface RetentionInvocation {
    name: string;
}

export interface RetentionTaskResult {
    name: string;
    status: 'success' | 'error';
    deleted: number;
    duration: number;
    message?: string;
}

export interface RetentionTask {
    name: string;
    run: (config: Config, retention: RetentionInvocation) => Promise<RetentionTaskResult>;
}

export default class Retention {
    config: Config;
    tasks: Map<string, RetentionTask>;

    constructor(config: Config) {
        this.config = config;
        this.tasks = new Map();
    }

    static async load(config: Config): Promise<Retention> {
        const retention = new Retention(config);
        await retention.init();

        return retention;
    }

    async init(): Promise<void> {
        const folder = new URL('./retention/', import.meta.url);

        for (const file of await fs.readdir(folder)) {
            if (file.startsWith('.')) continue;
            if (file === 'index.ts' || file === 'index.js') continue;
            if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

            const mod = await import(new URL(`./retention/${file}`, import.meta.url).href);
            const task = mod.default as RetentionTask | undefined;

            if (!task || typeof task.name !== 'string' || typeof task.run !== 'function') {
                throw new Error(`Invalid retention task module: ${file}`);
            }

            if (this.tasks.has(task.name)) {
                throw new Error(`Duplicate retention task: ${task.name}`);
            }

            this.tasks.set(task.name, task);
        }
    }

    async run(retention: RetentionInvocation): Promise<RetentionTaskResult> {
        const task = this.tasks.get(retention.name);

        if (!task) throw new Err(400, null, `Unknown retention action: ${retention.name}`);

        return await task.run(this.config, retention);
    }
}
