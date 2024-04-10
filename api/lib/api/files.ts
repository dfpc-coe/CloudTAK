import TAKAPI from '../tak-api.js';
import { Readable } from 'node:stream';
import mime from 'mime';
import { Type, Static } from '@sinclair/typebox';

export const Content = Type.Object({
  UID: Type.String(),
  SubmissionDateTime: Type.String(),
  Keywords: Type.Array(Type.String()),
  MIMEType: Type.String(),
  SubmissionUser: Type.String(),
  PrimaryKey: Type.String(),
  Hash: Type.String(),
  CreatorUid: Type.String(),
  Name: Type.String()
});

export default class File {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async download(hash: string): Promise<Readable> {
        const url = new URL(`/Marti/sync/content`, this.api.url);
        url.searchParams.append('hash', hash);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        return res.body;
    }

    async delete(hash: string) {
        const url = new URL(`/Marti/sync/delete`, this.api.url);
        url.searchParams.append('hash', hash)

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async upload(opts: {
        name: string;
        contentLength: number;
        contentType?: string;
        keywords: string[];
        creatorUid: string;
        latitude?: string;
        longitude?: string;
        altitude?: string;
    }, body: Readable | Buffer): Promise<Static<typeof Content>> {
        const url = new URL(`/Marti/sync/upload`, this.api.url);
        url.searchParams.append('name', opts.name)
        url.searchParams.append('keywords', opts.keywords.join(','))
        url.searchParams.append('creatorUid', opts.creatorUid)
        if (opts.altitude) url.searchParams.append('altitude', opts.altitude);
        if (opts.longitude) url.searchParams.append('longitude', opts.longitude);
        if (opts.latitude) url.searchParams.append('latitude', opts.latitude);

        if (body instanceof Buffer) {
            body = Readable.from(body as Buffer);
        }
        body as Readable;

        const res = await this.api.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': opts.contentType ? opts.contentType : mime.getType(opts.name),
                'Content-Length': opts.contentLength
            },
            body
        });

        return JSON.parse(res);
    }

    async count() {
        const url = new URL('/Marti/api/files/metadata/count', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async config() {
        const url = new URL('/files/api/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
