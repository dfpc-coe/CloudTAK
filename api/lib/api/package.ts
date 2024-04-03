import TAKAPI from '../tak-api.js';
import TAK from '@tak-ps/node-tak';
import { CoT } from '@tak-ps/node-tak';
import { Type, Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream'
import { Feature } from 'geojson';

export const Package = Type.Object({
    EXPIRATION: Type.String(),
    UID: Type.String(),
    SubmissionDateTime: Type.String(),
    Keywords: Type.Array(Type.String()),
    MIMEType: Type.String(),
    Size: Type.String(),
    SubmissionUser: Type.String(),
    PrimaryKey: Type.String(),
    Hash: Type.String(),
    CreatorUid: Type.String(),
    Name: Type.String(),
    Tool: Type.String()
});

/**
 * @class
 */
export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(): Promise<{
        resultCount: numbers;
        results: Array<typeof Package>
    }> {
        const url = new URL(`/Marti/sync/search?tool=public`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return JSON.parse(res);
    }
}
