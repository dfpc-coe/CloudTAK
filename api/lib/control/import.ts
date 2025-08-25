import Config from '../config.js';
import S3 from '../aws/s3.js'
import { Static } from '@sinclair/typebox';
import type { ImportResponse } from '../types.js';
import crypto from 'node:crypto';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

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


            if (!body.mode_id) throw new Error('ModeID Must be set for Package Type');
            const file = await api.Files.download(body.mode_id);

            await S3.put(`import/${imp.id}.zip`, file)

            await this.config.models.Import.commit(imp.id, {
                status: 'Pending'
            });
        }

        return imp;
    }
}
