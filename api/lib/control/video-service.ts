import Err from '@openaddresses/batch-error';
import Config from '../config.js';
import { Type, Static } from '@sinclair/typebox';
import fetch from '../fetch.js';

export const VideoConfig = Type.Object({
    api: Type.Boolean(),
    metrics: Type.Boolean(),
    pprof: Type.Boolean(),
    playback: Type.Boolean(),
    rtsp: Type.Boolean(),
    rtmp: Type.Boolean(),
    hls: Type.Boolean(),
    webrtc: Type.Boolean(),
    srt: Type.Boolean()
})

export const PathConfig = Type.Object({
    name: Type.String(),
    confName: Type.String(),
    source: Type.Object({
        id: Type.String(),
        type: Type.String(),
    }),
    ready: Type.Boolean(),
    readyTime: Type.String(),
    tracks: Type.Array(Type.String()),
    bytesReceived: Type.Integer(),
    bytesSent: Type.Integer(),
    readers: Type.Array(Type.Object({
        type: Type.String(),
        id: Type.String()
    }))
})

export const PathsConfig = Type.Object({
    pageCount: Type.Integer(),
    itemCount: Type.Integer(),
    items: Type.Array(PathConfig)
})

export const Configuration = Type.Object({
    configured: Type.Boolean(),
    url: Type.Optional(Type.String()),
    config: Type.Optional(VideoConfig),
    paths: Type.Optional(Type.Array(PathConfig))
});

export default class VideoServiceControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async configuration(): Promise<Static<typeof Configuration>> {
        let video;

        const headers = new Headers();

        try {
            video = await this.config.models.Setting.from('media::url');
            const user = await this.config.models.Setting.from('media::username');
            const pass = await this.config.models.Setting.from('media::password');

            headers.append('Authorization', `Basic ${Buffer.from(user.value + ':' + pass.value).toString('base64')}`);
        } catch (err) {
            if (err.message.includes('Not Found')) {
                return {
                    configured: false
                }
            } else {
                throw new Err(500, err, 'Media Service Configuration Error');
            }
        }

        const url = new URL('/v3/config/global/get', video.value);
        url.port = '9997';

        const res = await fetch(url, { headers })
        const body = await res.typed(VideoConfig);

        const urlPaths = new URL('/v3/paths/list', video.value);
        urlPaths.port = '9997';

        const resPaths = await fetch(urlPaths, { headers })
        const paths = await resPaths.typed(PathsConfig);

        return {
            configured: true,
            url: video.value,
            config: body,
            paths: paths.items,
        };
    }
}
