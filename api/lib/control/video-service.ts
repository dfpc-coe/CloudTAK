import Err from '@openaddresses/batch-error';
import jwt from 'jsonwebtoken';
import Config from '../config.js';
import { eq } from 'drizzle-orm'
import { AuthResourceAccess } from '../auth.js';
import { Type, Static } from '@sinclair/typebox';
import { VideoLease } from '../schema.js';
import { VideoLeaseResponse } from '../types.js';
import { VideoLease_SourceType } from '../enums.js';
import fetch from '../fetch.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export enum ProtocolPopulation {
    TEMPLATE,
    WRITE,
    READ
}

export enum Protocol {
    RTSP = "rtsp",
    RTML = "rtmp",
    HLS = "hls",
    WEBRTC = "webrtc",
    SRT = "srt",
}

export enum Action {
    PUBLISH = "publish",
    READ = "read",
    PLAYBACK = "playback",
    API = "api",
    METRICS = "metrics",
    PPROF = "pprof",
}

export const Protocols = Type.Object({
    rtmp: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    rtsp: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    webrtc: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    hls: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    srt: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    }))
})

export const VideoConfig = Type.Object({
    api: Type.Boolean(),
    apiAddress: Type.String(),

    metrics: Type.Boolean(),
    metricsAddress: Type.String(),

    pprof: Type.Boolean(),
    pprofAddress: Type.String(),

    playback: Type.Boolean(),
    playbackAddress: Type.String(),

    rtsp: Type.Boolean(),
    rtspAddress: Type.String(),
    rtspsAddress: Type.String(),
    rtspAuthMethods: Type.Array(Type.String()),

    rtmp: Type.Boolean(),
    rtmpAddress: Type.String(),
    rtmpsAddress: Type.String(),

    hls: Type.Boolean(),
    hlsAddress: Type.String(),

    webrtc: Type.Boolean(),
    webrtcAddress: Type.String(),

    srt: Type.Boolean(),
    srtAddress: Type.String(),
})

export const PathConfig = Type.Object({
    name: Type.String(),
    source: Type.String(),
    record: Type.Boolean(),
});

export const PathListItem = Type.Object({
    name: Type.String(),
    confName: Type.String(),

    source: Type.Union([
        Type.Object({
            id: Type.String(),
            type: Type.String(),
        }),
        Type.Null()
    ]),

    ready: Type.Boolean(),
    readyTime: Type.Union([Type.String(), Type.Null()]),
    tracks: Type.Array(Type.String()),
    bytesReceived: Type.Integer(),
    bytesSent: Type.Integer(),
    readers: Type.Array(Type.Object({
        type: Type.String(),
        id: Type.String()
    }))
});

export const Recording = Type.Object({
    name: Type.String(),
    segmenets: Type.Array(Type.Object({
        start: Type.String()
    }))
});

export const PathsList = Type.Object({
    pageCount: Type.Integer(),
    itemCount: Type.Integer(),
    items: Type.Array(PathListItem)
})

export const Configuration = Type.Object({
    configured: Type.Boolean(),
    url: Type.Optional(Type.String()),
    external: Type.Optional(Type.String()),
    config: Type.Optional(VideoConfig),
    paths: Type.Optional(Type.Array(PathListItem))
});

export default class VideoServiceControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async url(): Promise<URL | null> {
        try {
            const url = await this.config.models.Setting.from('media::url');
            return new URL(url.value);
        } catch (err) {
            if (err instanceof Error && err.message.includes('Not Found')) {
                return null;
            } else {
                throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Media Service Configuration Error');
            }
        }
    }

    async settings(): Promise<{
        configured: boolean;
        url?: string;
        token?: string;
    }> {
        let video;

        try {
            const kv = await this.config.models.Setting.from('media::url');
            if (kv.value && typeof kv.value === 'string' && new URL(kv.value)) {
                video = kv.value
            } else {
                throw new Err(400, null, 'Media Service URL is not configured');
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes('Not Found')) {
                return {
                    configured: false
                }
            } else if (err instanceof Err) {
                throw err;
            } else {
                throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Media Service Configuration Error');
            }
        }

        return {
            configured: true,
            url: video,
            token: jwt.sign({
                internal: true,
                access: AuthResourceAccess.MEDIA
            }, this.config.SigningSecret)
        }
    }

    headers(token?: string): Headers {
        const headers = new Headers();
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }

        return headers;
    }

    async configuration(): Promise<Static<typeof Configuration>> {
        const video = await this.settings();

        if (!video.configured) return video;

        const headers = this.headers(video.token);

        const url = new URL('/v3/config/global/get', video.url);
        url.port = '9997';

        const res = await fetch(url, { headers })
        if (!res.ok) throw new Err(500, null, await res.text())
        const body = await res.typed(VideoConfig);

        // TODO support paging
        const urlPaths = new URL('/path', video.url);
        urlPaths.port = '9997';

        const resPaths = await fetch(urlPaths, { headers })
        if (!resPaths.ok) throw new Err(500, null, await resPaths.text())

        const paths = await resPaths.typed(PathsList);

        // Special case for supporting internal Docker Compose network
        let external = video.url;
        if (video.url && new URL(video.url).hostname === 'media') {
            external = 'http://localhost'
        }

        return {
            configured: video.configured,
            url: video.url,
            external,
            config: body,
            paths: paths.items,
        };
    }

    async protocols(
        lease: Static<typeof VideoLeaseResponse>,
        populated = ProtocolPopulation.TEMPLATE
    ): Promise<Static<typeof Protocols>> {
        const protocols: Static<typeof Protocols> = {};
        const c = await this.configuration();

        if (!c.configured || !c.external) return protocols;

        if (c.config && c.config.rtsp) {
            // Format: rtsp://localhost:8554/mystream
            const url = new URL(`/${lease.path}`, c.external.replace(/^http(s)?:/, 'rtsp:'))
            url.port = c.config.rtspAddress.replace(':', '');

            if (lease.read_user && lease.stream_user) {
                if (populated === ProtocolPopulation.READ && lease.read_user && lease.read_pass) {
                    url.username = lease.read_user;
                    url.password = lease.read_pass;

                    protocols.rtsp = {
                        name: 'Real-Time Streaming Protocol (RTSP)',
                        url: String(url)
                    }
                } else if (populated === ProtocolPopulation.WRITE && lease.stream_user && lease.stream_pass) {
                    url.username = lease.stream_user;
                    url.password = lease.stream_pass;

                    protocols.rtsp = {
                        name: 'Real-Time Streaming Protocol (RTSP)',
                        url: String(url)
                    }
                } else {
                    const rtspurl = new URL(String(url))
                    rtspurl.username = 'username';
                    rtspurl.password = 'password';

                    protocols.rtsp = {
                        name: 'Real-Time Streaming Protocol (RTSP)',
                        url: String(rtspurl).replace(/username:password/, '{{username}}:{{password}}')
                    }
                }
            } else {
                protocols.rtsp = {
                    name: 'Real-Time Streaming Protocol (RTSP)',
                    url: String(url)
                }
            }
        }

        if (c.config && c.config.rtmp) {
            // Format: rtmp://localhost/mystream
            const url = new URL(`/${lease.path}`, c.external.replace(/^http(s)?:/, 'rtmp:'))
            url.port = c.config.rtmpAddress.replace(':', '');

            protocols.rtmp = {
                name: 'Real-Time Messaging Protocol (RTMP)',
                url: String(url)
            }

            if (lease.stream_user && lease.read_user) {
                if (populated === ProtocolPopulation.TEMPLATE) {
                    protocols.rtmp.url = `${protocols.rtmp.url}?user={{username}}&pass={{password}}`;
                } else if (populated === ProtocolPopulation.READ) {
                    protocols.rtmp.url = `${protocols.rtmp.url}?user=${lease.read_user}&pass=${lease.read_pass}`;
                } else if (populated === ProtocolPopulation.WRITE) {
                    protocols.rtmp.url = `${protocols.rtmp.url}?user=${lease.stream_user}&pass=${lease.stream_pass}`;
                }
            }

        }

        if (c.config && c.config.srt) {
            // Format: srt://localhost:8890?streamid=publish:mystream
            const url = new URL(c.external.replace(/^http(s)?:/, 'srt:'))
            url.port = c.config.srtAddress.replace(':', '');

            if (lease.stream_user && lease.read_user) {
                if (populated === ProtocolPopulation.READ) {
                    protocols.srt = {
                        name: 'Secure Reliable Transport (SRT)',
                        url: String(url) + `?streamid={{mode}}:${lease.path}:${lease.read_user}}:${lease.read_pass}`
                    }
                } else if (populated === ProtocolPopulation.WRITE) {
                    protocols.srt = {
                        name: 'Secure Reliable Transport (SRT)',
                        url: String(url) + `?streamid={{mode}}:${lease.path}:${lease.stream_user}}:${lease.stream_pass}`
                    }
                } else {
                    protocols.srt = {
                        name: 'Secure Reliable Transport (SRT)',
                        url: String(url) + `?streamid={{mode}}:${lease.path}:{{username}}:{{password}}`
                    }
                }
            } else {
                protocols.srt = {
                    name: 'Secure Reliable Transport (SRT)',
                    url: String(url) + `?streamid={{mode}}:${lease.path}`
                }
            }
        }

        if (c.config && c.config.hls) {
            // Format: http://localhost:9997/mystream/index.m3u8 - Proxied
            const url = new URL(`/stream/${lease.path}/index.m3u8`, c.external);
            url.port = '9997'

            if (lease.stream_user && lease.read_user) {
                if (populated === ProtocolPopulation.READ && lease.read_user && lease.read_pass) {
                    const hlsurl = new URL(String(url))
                    hlsurl.username = lease.read_user;
                    hlsurl.password = lease.read_pass;

                    protocols.hls = {
                        name: 'HTTP Live Streaming (HLS)',
                        url: String(hlsurl)
                    }
                } else if (populated === ProtocolPopulation.WRITE && lease.stream_user && lease.stream_pass) {
                    const hlsurl = new URL(String(url))
                    hlsurl.username = lease.stream_user;
                    hlsurl.password = lease.stream_pass;

                    protocols.hls = {
                        name: 'HTTP Live Streaming (HLS)',
                        url: String(hlsurl)
                    }
                } else {
                    const hlsurl = new URL(String(url))
                    hlsurl.username = 'username';
                    hlsurl.password = 'password';

                    protocols.hls = {
                        name: 'HTTP Live Streaming (HLS)',
                        url: String(hlsurl).replace(/username:password/, '{{username}}:{{password}}')
                    }
                }
            } else {
                protocols.hls = {
                    name: 'HTTP Live Streaming (HLS)',
                    url: String(url)
                }
            }
        }

        if (c.config && c.config.webrtc) {
            // Format: http://localhost:8889/mystream
            const url = new URL(`/${lease.path}`, c.external);
            url.port = c.config.webrtcAddress.replace(':', '');

            protocols.webrtc = {
                name: 'Web Real-Time Communication (WebRTC)',
                url: String(url)
            }
        }

        return protocols;
    }

    async updateSecure(
        lease: Static<typeof VideoLeaseResponse>,
        secure: boolean,
        rotate?: boolean
    ): Promise<void> {
        const video = await this.settings();

        if (!video.configured) return;

        if (secure && (!lease.stream_user || !lease.stream_pass || !lease.read_user || !lease.read_pass)) {
            await this.config.models.VideoLease.commit(lease.id, {
                stream_user: `write${lease.id}`,
                stream_pass: Math.random().toString(20).substr(2, 6),
                read_user: `read${lease.id}`,
                read_pass: Math.random().toString(20).substr(2, 6)
            });
        } else if (secure && rotate) {
            await this.config.models.VideoLease.commit(lease.id, {
                read_user: `read${lease.id}`,
                read_pass: Math.random().toString(20).substr(2, 6)
            });
        } else if (!secure && (lease.stream_user || lease.stream_pass || lease.read_user || lease.read_pass)) {
            await this.config.models.VideoLease.commit(lease.id, {
                stream_user: null,
                stream_pass: null,
                read_user: null,
                read_pass: null
            });
        }
    }

    async generate(opts: {
        name: string;
        ephemeral: boolean;
        expiration: string | null;
        source_id: string | null | undefined;
        source_type?: VideoLease_SourceType;
        source_model?: string;
        path: string;
        username?: string;
        connection?: number;
        layer?: number;
        recording: boolean;
        publish: boolean;
        secure: boolean;
        channel?: string | null;
        proxy?: string | null;
    }): Promise<Static<typeof VideoLeaseResponse>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.token);

        if (opts.username && opts.connection) {
            throw new Err(400, null, 'Either username or connection must be set but not both');
        }

        const lease = await this.config.models.VideoLease.generate({
            name: opts.name,
            expiration: opts.expiration,
            ephemeral: opts.ephemeral,
            path: opts.path,
            recording: opts.recording,
            publish: opts.publish,
            source_id: opts.source_id,
            source_type: opts.source_type,
            source_model: opts.source_model,
            username: opts.username,
            connection: opts.connection,
            layer: opts.layer,
            channel: opts.channel,
            proxy: opts.proxy
        });

        await this.updateSecure(lease, opts.secure);

        const url = new URL(`/path`, video.url);
        url.port = '9997';

        headers.append('Content-Type', 'application/json');

        if (lease.proxy) {
            try {
                const proxy = new URL(lease.proxy);

                // Check for HLS Errors
                if (['http:', 'https:'].includes(proxy.protocol)) {
                    const res = await fetch(proxy);

                    if (res.status === 404) {
                        throw new Err(400, null, 'External Video Server reports Video Stream not found');
                    } else if (!res.ok) {
                        throw new Err(res.status, null, `External Video Server failed stream video - HTTP Error ${res.status}, ${await res.text()}`);
                    }
                } else {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            name: lease.path,
                            source: lease.proxy,
                            record: lease.recording,
                        })
                    })

                    if (!res.ok) throw new Err(500, null, await res.text())
                }
            } catch (err) {
                if (err instanceof Err) {
                    throw err;
                // @ts-expect-error code is not defined in type
                } else if (err instanceof TypeError && err.code === 'ERR_INVALID_URL') {
                    throw new Err(400, null, 'Invalid Video Stream URL');
                } else {
                    throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Failed to generate proxy stream');
                }
            }
        } else {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: lease.path,
                    record: lease.recording,
                })
            })

            if (!res.ok) throw new Err(500, null, await res.text())
        }

        return lease;
    }

    /**
     * Fetches a lease and performs permission checks based on the provided options
     *
     * @param leaseid Integer Lease ID or String Lease Path
     *
     * @param opts Options containing connection, username,
     * @param opts.connection Connection ID if accessing via Connection
     * @param opts.username Username if accessing via CloudTAK Map
     * @param opts.admin Boolean indicating if the user is an admin
     */
    async from(
        id: number | string,
        opts: {
            connection?: number
            username?: string
            admin: boolean
        }
    ): Promise<Static<typeof VideoLeaseResponse>> {
        let lease;

        if (typeof id === 'string') {
            lease = await this.config.models.VideoLease.from(eq(VideoLease.path, id));
        } else {
            lease = await this.config.models.VideoLease.from(id);
        }

        if (opts.admin) return lease;

        if (opts.connection) {
            if (lease.connection !== opts.connection) {
                throw new Err(400, null, 'Connections can only access leases created in the context of the connection');
            } else {
                return lease;
            }
        } else if (opts.username) {
            if (opts.username === lease.username) {
                return lease;
            } else {
                const profile = await this.config.models.Profile.from(opts.username);
                const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
                const groups = (await api.Group.list({ useCache: true }))
                    .data.map((group) => group.name);

                if (lease.username !== opts.username && (!lease.channel || !groups.includes(lease.channel))) {
                    throw new Err(400, null, 'You can only access a lease you created or that is assigned to a channel you are in');
                }

                return lease;
            }
        } else {
            return lease;
        }
    }

    async commit(
        leaseid: number,
        body: {
            name?: string,
            channel?: string | null,
            secure?: boolean,
            secure_rotate?: boolean
            expiration?: string | null,
            recording?: boolean,
            publish?: boolean,
            source_id: string | null | undefined;
            source_type?: VideoLease_SourceType,
            source_model?: string,
            proxy?: string | null,
        },
        opts: {
            connection?: number;
            username?: string;
            admin: boolean;
        }
    ): Promise<Static<typeof VideoLeaseResponse>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        let lease = await this.from(leaseid, opts);

        if (lease.connection && !opts.connection) {
            throw new Err(400, null, 'Lease must be edited in the context of a Connection');
        } else if (lease.username && !opts.username) {
            throw new Err(400, null, 'Lease must be edited in the context of the CloudTAK Map');
        }

        if (body.secure !== undefined) {
            // Performs Permission Check
            await this.updateSecure(lease, body.secure, body.secure_rotate);
        }

        lease = await this.config.models.VideoLease.commit(leaseid, body);

        try {
            await this.path(lease.path);

            const url = new URL(`/path/${lease.path}`, video.url);
            url.port = '9997';

            const headers = this.headers(video.token);
            headers.append('Content-Type', 'application/json');

            const res = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    name: lease.path,
                    source: lease.proxy,
                    record: lease.recording,
                }),
            })

            if (!res.ok) throw new Err(500, null, await res.text())
        } catch (err) {
            if (err instanceof Err && err.status === 404) {
                const url = new URL(`/path`, video.url);
                url.port = '9997';

                const headers = this.headers(video.token);
                headers.append('Content-Type', 'application/json');

                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: lease.path,
                        source: lease.proxy,
                        record: lease.recording,
                    }),
                })

                if (!res.ok) throw new Err(500, null, await res.text())
            } else {
                throw err;
            }
        }

        return lease;
    }

    /**
     * Fetch Path Information from Media Server
     */
    async path(pathid: string): Promise<Static<typeof PathListItem>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.token);

        const url = new URL(`/path/${pathid}`, video.url);
        url.port = '9997';

        const res = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (res.ok) {
            return await res.typed(PathListItem);
        } else {
            throw new Err(res.status, new Error(await res.text()), 'Media Server Error');
        }
    }

    async recordings(path: string): Promise<Static<typeof Recording>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.token);

        const url = new URL(`/v3/recordings/get/${path}`, video.url);
        url.port = '9997';

        const res = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (res.ok) {
            return await res.typed(Recording);
        } else {
            throw new Err(res.status, new Error(await res.text()), 'Media Server Error');
        }
    }

    async delete(
        leaseid: number,
        opts: {
            username?: string;
            connection?: number;
            admin: boolean;
        }
    ): Promise<void> {
        const video = await this.settings();

        if (!opts.username && !opts.connection) {
            throw new Err(400, null, 'Either connection or username config must be provided');
        } else if (opts.username && opts.connection)  {
            throw new Err(400, null, 'connection and username cannot both be provided');
        }

        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.token);

        const lease = await this.from(leaseid, opts);

        if (opts.connection && lease.connection !== opts.connection) {
            throw new Err(400, null, `Lease does not belong to connection ${opts.connection}`);
        } else if (opts.username && lease.username !== opts.username) {
            throw new Err(400, null, `Lease does not belong to user ${opts.username}`);
        }

        await this.config.models.VideoLease.delete(leaseid);

        const url = new URL(`/path/${lease.path}`, video.url);
        url.port = '9997';

        await fetch(url, {
            method: 'DELETE',
            headers,
        })

        return;
    }
}
