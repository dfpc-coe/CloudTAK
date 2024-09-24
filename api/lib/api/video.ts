import { Static, Type } from '@sinclair/typebox';
import TAKAPI from '../tak-api.js';

export const Feed = Type.Object({
    uuid: Type.String(),
    active: Type.Boolean(),
    alias: Type.String(),
    url: Type.String(),

    order: Type.Union([Type.Integer(), Type.Null()]),
    macAddress: Type.String(),
    roverPort: Type.String(),
    ignoreEmbeddedKLV: Type.String(),
    source: Type.Union([Type.String(), Type.Null()]),
    networkTimeout: Type.String(),
    bufferTime: Type.String(),
    rtspReliable: Type.String(),
    thumbnail: Type.Union([Type.String(), Type.Null()]),
    classification: Type.Union([Type.String(), Type.Null()]),
    latitude: Type.Union([Type.String(), Type.Null()]),
    longitude: Type.Union([Type.String(), Type.Null()]),
    fov: Type.Union([Type.String(), Type.Null()]),
    heading: Type.Union([Type.String(), Type.Null()]),
    range: Type.Union([Type.String(), Type.Null()]),
    width: Type.Union([Type.Integer(), Type.Null()]),
    height: Type.Union([Type.Integer(), Type.Null()]),
    bitrate: Type.Union([Type.Integer(), Type.Null()]),
});

export const Video = Type.Object({
    uuid: Type.String(),
    active: Type.Boolean(),
    alias: Type.String(),
    thumbnail: Type.Union([Type.String(), Type.Null()]),
    classification: Type.Union([Type.String(), Type.Null()]),
    feeds: Type.Array(Feed)
})

export const VideoList = Type.Object({
    videoConnections: Type.Array(Video)
});

export const VideoListInput = Type.Object({
    protocol: Type.Optional(Type.String())
})

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(
        query: Static<typeof VideoListInput> = {}
    ): Promise<Static<typeof VideoList>> {
        const url = new URL(`/Marti/api/video`, this.api.url);

        let q: keyof Static<typeof VideoListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return await res.typed(VideoList);
    }
}
