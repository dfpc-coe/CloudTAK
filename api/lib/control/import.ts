import Config from '../config.js';
import S3 from '../aws/s3.js'
import { Static } from '@sinclair/typebox';
import type { ImportResponse } from '../types.js';
import crypto from 'node:crypto';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export enum ImportSourceEnum {
    UPLOAD = 'Upload',
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
        source?: ImportSourceEnum;
        source_id?: string;
        config?: any;
    }): Promise<Static<typeof ImportResponse>> {
        const imp = await this.config.models.Import.generate({
            id: crypto.randomUUID(),
            name: body.name,
            username: body.username,
            status: 'Empty',
            source: body.source || ImportSourceEnum.UPLOAD,
            source_id: body.source_id,
            config: body.config
        });

        // Both Package and Mission Imports fetch from the File API
        if (body.source === ImportSourceEnum.PACKAGE || body.source === ImportSourceEnum.MISSION) {
            const profile = await this.config.models.Profile.from(body.username);
            const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            if (!body.source_id) throw new Error('Source ID Must be set for Package Import Source');
            const file = await api.Files.download(body.source_id);

            await S3.put(`import/${imp.id}.zip`, file)

            await this.config.models.Import.commit(imp.id, {
                status: 'Pending'
            });
        }

        return imp;
    }
}
