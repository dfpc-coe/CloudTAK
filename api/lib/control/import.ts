import Config from '../config.js';
import path from 'node:path';
import S3 from '../aws/s3.js'
import { Static } from '@sinclair/typebox';
import Batch from '../aws/batch.js';
import type { ImportResponse } from '../types.js';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from '../tak-api.js';

export enum ImportModeEnum {
    UNKNOWN = 'Unknown',
    MISSION = 'Mission',
    PACKAGE = 'Package'
}

export default class ImportControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async create(body: {
        username: string;
        name: string;
        mode?: ImportModeEnum;
        mode_id?: string;
        config?: any;
    }): Promise<Static<typeof ImportResponse>> {
        const imp = await this.config.models.Import.generate({
            id: crypto.randomUUID(),
            name: body.name,
            username: body.username,
            status: 'Empty',
            mode: body.mode,
            mode_id: body.mode_id,
            config: body.config
        });

        if (body.mode === ImportModeEnum.PACKAGE) {
            const profile = await this.config.models.Profile.from(body.username);
            const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const file = await api.Files.download(body.mode_id);

            await S3.put(`import/${imp.id}.zip`, file)

            await this.config.models.Import.commit(imp.id, {
                status: 'Pending'
            });
        }

        return imp;
    }

    async batch(id: string): Promise<Static<typeof ImportResponse>> {
        let imp = await this.config.models.Import.from(id);

        await Batch.submitImport(this.config, id, `${id}${path.parse(imp.name).ext}`);

        imp = await this.config.models.Import.commit(id, {
            batch: true,
            updated: sql`Now()`
        });

        return imp;
    }
}
