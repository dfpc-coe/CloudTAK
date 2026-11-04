import os from 'node:os';
import { DataPackage } from '@tak-ps/node-cot';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import { rm } from 'node:fs/promises';
import S3 from '../../../common/aws/s3.js';
import Config from '../../../common/config.js';

export default class AttachmentControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Write an upload to a temp file so the size is known before forwarding it
     * @returns the staged file - call cleanup() once finished with it
     */
    async stage(name: string, body: Readable): Promise<{
        path: string;
        size: number;
        cleanup: () => Promise<void>;
    }> {
        const dir = os.tmpdir() + '/' + randomUUID();
        const file = dir + '/' + name;
        const cleanup = () => rm(dir, { recursive: true, force: true });

        try {
            fs.mkdirSync(dir);
            await pipeline(body, fs.createWriteStream(file));

            const { size } = fs.statSync(file);

            return { path: file, size, cleanup };
        } catch (err) {
            await cleanup();
            throw err;
        }
    }

    async upload(name: string, body: Readable): Promise<{
        hash: string;
    }> {
        const tmp = os.tmpdir() + '/' + randomUUID();

        try {
            fs.mkdirSync(tmp);
            await pipeline(
                body,
                fs.createWriteStream(tmp + '/' + name),
            );

            const hash = await DataPackage.hash(tmp + '/' + name);

            await S3.put(
                `attachment/${hash}/${name}`,
                fs.createReadStream(tmp + '/' + name),
            );

            return { hash };
        } catch (err) {
            fs.unlinkSync(tmp + '/' + name);
            throw err;
        }
    }
}
