import Config from '../config.js';
import Err from '@openaddresses/batch-error';
import path from 'node:path';
import S3 from '../aws/s3.js'
import { Static } from '@sinclair/typebox';
import type { ImportResponse } from '../types.js';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Import_Status } from '../enums.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export enum ImportSourceEnum {
    UPLOAD = 'Upload',
    MISSION = 'Mission',
    PACKAGE = 'Package'
}

export enum ImportResultTypeEnum {
    FEATURE = 'Feature',
    ASSET = 'Asset',
    ICONSET = 'Iconset',
    BASEMAP = 'Basemap'
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

            const { ext } = path.parse(body.name);

            // The ext in the name is currently used to obtain the file, assume a data package if not set
            if (path.parse(imp.name).ext === '') {
                imp.name = `${imp.name}${ext}`;
            }

            await S3.put(`import/${imp.id}${ext}`, file)

            await this.config.models.Import.commit(imp.id, {
                name: imp.name,
                status: 'Pending'
            });
        }

        return {
            ...imp,
            results: []
        };
    }

    async update(
        id: string,
        body: {
            status?: Import_Status;
            error?: string;
        }
    ): Promise<Static<typeof ImportResponse>> {
        const imported = await this.config.models.Import.augmented_from(id);

        if (body.status && [Import_Status.EMPTY, Import_Status.PENDING].includes(body.status)) {
            throw new Err(400, null, `Cannot set status to ${body.status}`);
        } else if (body.status === Import_Status.RUNNING && imported.status === Import_Status.RUNNING) {
            throw new Err(400, null, `Cannot set status to running on an import that is already running`);
        }

        const new_import = await this.config.models.Import.commit(id, {
            ...body,
            updated: sql`Now()`
        });

        const response = {
            ...new_import,
            results: imported.results
        };

        if (body.status === Import_Status.FAIL || body.status === Import_Status.SUCCESS) {
            for (const client of this.config.wsClients.get(imported.username) || []) {
                client.ws.send(JSON.stringify({
                    type: 'import',
                    properties: response
                }))
            }
        }

        return response;
    }

    async retry(id: string): Promise<Static<typeof ImportResponse>> {
        const imported = await this.config.models.Import.augmented_from(id);

        if (imported.status !== Import_Status.FAIL) {
            throw new Err(400, null, 'Only failed imports can be retried');
        }

        await this.config.models.ImportResult.delete(sql`import = ${id}`);

        const new_import = await this.config.models.Import.commit(id, {
            status: Import_Status.PENDING,
            error: null,
            updated: sql`Now()`
        });

        return {
            ...new_import,
            results: []
        };
    }

    async delete(id: string): Promise<void> {
        const imported = await this.config.models.Import.from(id);

        const ext = path.parse(imported.name).ext;
        await S3.del(`import/${imported.id}${ext}`);

        await this.config.models.Import.delete(id);
    }
}
