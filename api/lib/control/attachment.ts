import os from 'node:os';
import { DataPackage } from '@tak-ps/node-cot';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import S3 from '../aws/s3.js';
import Config from '../config.js';

export default class AttachmentControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async upload(name: string, body: Readable): Promise<{
        hash: string
    }> {
        const tmp = os.tmpdir() + '/' + randomUUID();

        try {
            fs.mkdirSync(tmp)
            await pipeline(
                body,
                fs.createWriteStream(tmp + '/' + name)
            );

            const hash = await DataPackage.hash(tmp + '/' + name);

            await S3.put(
                `attachment/${hash}/${name}`,
                fs.createReadStream(tmp + '/' + name)
            );

            return { hash };
        } catch (err) {
            fs.unlinkSync(tmp + '/' + name);
            throw err;
        }
    }
}
