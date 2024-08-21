import Err from '@openaddresses/batch-error';
import Config from '../config.js';
import { Type, Static } from '@sinclair/typebox';
import fetch from '../fetch.js';

export const VideoConfig = Type.Object({
    api: Type.Boolean(),
    metrics: Type.Boolean()
})

export const Configuration = Type.Object({
    configured: Type.Boolean(),
    url: Type.Optional(Type.String()),
    config: Type.Optional(VideoConfig)
});

export default class VideoServiceControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async configuration(): Promise<Static<typeof Configuration>> {
        let video;
        try {
            video = await this.config.models.Setting.from('media::url');
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

        const res = await fetch(url)

        const body = await res.typed(VideoConfig);

        return {
            configured: true,
            url: video.value,
            config: body
        };
    }
}
