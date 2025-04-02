import Err from '@openaddresses/batch-error';
import Config from '../config.js';
import { Type, Static } from '@sinclair/typebox';
import { VideoLeaseResponse } from '../types.js';
import { VideoLease_SourceType } from '../enums.js';
import fetch from '../fetch.js';
import TAKAPI, { APIAuthCertificate } from '../tak-api.js';

export enum ProtocolPopulation {
    TEMPLATE,
    WRITE,
    READ
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

export const AuthInternalUser = Type.Object({
    user: Type.String(),
    pass: Type.Optional(Type.String()),
    ips: Type.Optional(Type.Array(Type.String())),
    permissions: Type.Array(Type.Object({
        action: Type.String(),
        path: Type.Optional(Type.String())
    }))
})

export const VideoConfigUpdate = Type.Object({
    api: Type.Optional(Type.Boolean()),
    metrics: Type.Optional(Type.Boolean()),
    pprof: Type.Optional(Type.Boolean()),
    playback: Type.Optional(Type.Boolean()),
    rtsp: Type.Optional(Type.Boolean()),
    rtmp: Type.Optional(Type.Boolean()),
    hls: Type.Optional(Type.Boolean()),
    webrtc: Type.Optional(Type.Boolean()),
    srt: Type.Optional(Type.Boolean()),

    authInternalUsers: Type.Optional(Type.Array(AuthInternalUser)),
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

    authInternalUsers: Type.Array(AuthInternalUser)
})

export const PathConfig = Type.Object({
    name: Type.String(),
    source: Type.String(),
    sourceFingerprint: Type.String(),
    sourceOnDemand: Type.Boolean(),
    sourceOnDemandStartTimeout: Type.String(),
    sourceOnDemandCloseAfter: Type.String(),
    maxReaders: Type.Integer(),

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
    config: Type.Optional(VideoConfig),
    paths: Type.Optional(Type.Array(PathListItem))
});

export default class VideoServiceControl {
    config: Config;
    recording: Record<string, string>;

    constructor(config: Config) {
        this.config = config;

        this.recording = {
            recordPath: '/opt/mediamtx/recordings/%path/%Y-%m-%d_%H-%M-%S-%f',
            recordFormat: 'fmp4',
            recordPartDuration: '1s',
            recordSegmentDuration: '1h',
            recordDeleteAfter: '7d'
        }
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
        username?: string;
        password?: string;
    }> {
        let video, user, pass;

        try {
            video = await this.config.models.Setting.from('media::url');
            user = await this.config.models.Setting.from('media::username');
            pass = await this.config.models.Setting.from('media::password');
        } catch (err) {
            if (err instanceof Error && err.message.includes('Not Found')) {
                return {
                    configured: false
                }
            } else {
                throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Media Service Configuration Error');
            }
        }

        return {
            configured: true,
            url: typeof video.value === 'string' ? video.value : '',
            username: typeof user.value === 'string' ? user.value : '',
            password: typeof pass.value === 'string' ? pass.value : ''
        }
    }

    headers(username?: string, password?: string): Headers {
        const headers = new Headers();
        if (username && password) {
            headers.append('Authorization', `Basic ${Buffer.from(username + ':' + password).toString('base64')}`);
        }

        return headers;
    }

    async configure(
        config: Static<typeof VideoConfigUpdate>
    ): Promise<Static<typeof Configuration>> {
        const video = await this.settings();
        if (!video.configured) return video;

        const headers = this.headers(video.username, video.password);
        headers.append('Content-Type', 'application/json');

        const url = new URL('/v3/config/global/patch', video.url);
        url.port = '9997';

        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(config)
        });

        if (!res.ok) throw new Err(500, null, await res.text())

        return this.configuration();
    }

    async configuration(): Promise<Static<typeof Configuration>> {
        const video = await this.settings();

        if (!video.configured) return video;

        const headers = this.headers(video.username, video.password);

        const url = new URL('/v3/config/global/get', video.url);
        url.port = '9997';

        const res = await fetch(url, { headers })
        if (!res.ok) throw new Err(500, null, await res.text())
        const body = await res.typed(VideoConfig);

        const urlPaths = new URL('/v3/paths/list', video.url);
        urlPaths.port = '9997';

        const resPaths = await fetch(urlPaths, { headers })
        if (!resPaths.ok) throw new Err(500, null, await resPaths.text())

        const paths = await resPaths.typed(PathsList);

        return {
            configured: video.configured,
            url: video.url,
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

        if (!c.configured || !c.url) return protocols;

        if (c.config && c.config.rtsp) {
            // Format: rtsp://localhost:8554/mystream
            const url = new URL(`/${lease.path}`, c.url.replace(/^http(s)?:/, 'rtsp:'))
            url.port = c.config.rtspAddress.replace(':', '');

            protocols.rtsp = {
                name: 'Real-Time Streaming Protocol (RTSP)',
                url: String(url)
            }
        }

        if (c.config && c.config.rtmp) {
            // Format: rtmp://localhost/mystream
            const url = new URL(`/${lease.path}`, c.url.replace(/^http(s)?:/, 'rtmp:'))
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
            const url = new URL(c.url.replace(/^http(s)?:/, 'srt:'))
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
            // Format: http://localhost:8888/mystream/index.m3u8
            const url = new URL(`/${lease.path}/index.m3u8`, c.url);
            url.port = c.config.hlsAddress.replace(':', '');

            protocols.hls = {
                name: 'HTTP Live Streaming (HLS)',
                url: String(url)
            }
        }

        if (c.config && c.config.webrtc) {
            // Format: http://localhost:8889/mystream
            const url = new URL(`/${lease.path}`, c.url);
            url.port = c.config.webrtcAddress.replace(':', '');

            protocols.webrtc = {
                name: 'Web Real-Time Communication (WebRTC)',
                url: String(url)
            }
        }

        return protocols;
    }

    async updateSecure(lease: Static<typeof VideoLeaseResponse>, secure: boolean): Promise<void> {
        const video = await this.settings();
        if (!video.configured || !video.username) return;

        if (secure && (!lease.stream_user || !lease.stream_pass || !lease.read_user || !lease.read_pass)) {
            await this.config.models.VideoLease.commit(lease.id, {
                stream_user: `write${lease.id}`,
                stream_pass: Math.random().toString(20).substr(2, 6),
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

        const defaultUser: Static<typeof AuthInternalUser> = {
            user: 'any',
            pass: '',
            permissions: []
        };

        const authInternalUsers: Array<Static<typeof AuthInternalUser>> = [];
        for await (const lease of this.config.models.VideoLease.iter()) {
            if (lease.stream_user && lease.stream_pass && lease.read_user && lease.read_pass) {
                authInternalUsers.push({
                    user: lease.stream_user,
                    pass: lease.stream_pass,
                    permissions: [{ action: 'publish', path: lease.path }]
                });

                authInternalUsers.push({
                    user: lease.read_user,
                    pass: lease.read_pass,
                    permissions: [{ action: 'read', path: lease.path }]
                })
            } else {
                defaultUser.permissions.push({ action: 'read', path: lease.path });
                defaultUser.permissions.push({ action: 'publish', path: lease.path });
            }
        }

        authInternalUsers.push(defaultUser);

        authInternalUsers.push({
            user: video.username,
            pass: video.password,
            permissions: [
                { action: 'publish' },
                { action: 'read' },
                { action: 'playback' },
                { action: 'api' },
                { action: 'metrics' },
                { action: 'pprof' }
            ]
        })

        await this.configure({ authInternalUsers })
    }

    async generate(opts: {
        name: string;
        ephemeral: boolean;
        expiration: string | null;
        source_type?: VideoLease_SourceType;
        source_model?: string;
        path: string;
        username?: string;
        connection?: number;
        recording: boolean;
        publish: boolean;
        secure: boolean;
        channel?: string | null;
        proxy?: string | null;
    }): Promise<Static<typeof VideoLeaseResponse>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.username, video.password);

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
            source_type: opts.source_type,
            source_model: opts.source_model,
            username: opts.username,
            channel: opts.channel,
            proxy: opts.proxy
        });

        await this.updateSecure(lease, opts.secure);

        const url = new URL(`/v3/config/paths/add/${lease.path}`, video.url);
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
                        throw new Err(res.status, null, `External Video Server failed stream video - HTTP Error ${res.status}`);
                    }
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

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: lease.path,
                    source: lease.proxy,
                    sourceOnDemand: true,
                    record: lease.recording,
                })
            })

            if (!res.ok) throw new Err(500, null, await res.text())
        } else {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: lease.path,
                    record: lease.recording,
                    ...this.recording
                }),
            })

            if (!res.ok) throw new Err(500, null, await res.text())
        }

        return lease;
    }

    async from(
        leaseid: string,
        opts: {
            connection?: number
            username?: string
            admin: boolean
        }
    ): Promise<Static<typeof VideoLeaseResponse>> {
        const lease = await this.config.models.VideoLease.from(leaseid);

        if (opts.admin) return lease;

        if (lease.connection && !opts.connection) {
            throw new Err(400, null, 'Lease must be edited in the context of a Connection');
        } else if (lease.username && !opts.username) {
            throw new Err(400, null, 'Lease must be edited in the context of the CloudTAK Map');
        }

        if (lease.username) {
            const profile = await this.config.models.Profile.from(opts.username);
            const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            const groups = (await api.Group.list({ useCache: true }))
                .data.map((group) => group.name);

            if (lease.username !== opts.username && (!lease.channel || !groups.includes(lease.channel))) {
                throw new Err(400, null, 'You can only access a lease you created or that is assigned to a channel you are in');
            }
        } else if (lease.connection !== opts.connection) {
            throw new Err(400, null, 'Connections can only access leases created in the context of the connection');
        }

        return lease;
    }

    async commit(
        leaseid: string,
        body: {
            name?: string,
            channel?: string | null,
            secure?: boolean,
            expiration: string | null,
            recording: boolean,
            publish: boolean,
            source_type?: VideoLease_SourceType,
            source_model?: string
        },
        opts: {
            connection?: number;
            username?: string;
            admin: boolean;
        }
    ): Promise<Static<typeof VideoLeaseResponse>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        // Performs Permission Check
        await this.from(leaseid, opts);

        const lease = await this.config.models.VideoLease.commit(leaseid, body);

        if (body.secure !== undefined) {
            await this.updateSecure(lease, body.secure);
        }

        try {
            await this.path(lease.path);

            const url = new URL(`/v3/config/paths/add/${lease.path}`, video.url);
            url.port = '9997';

            const headers = this.headers(video.username, video.password);
            headers.append('Content-Type', 'application/json');

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: lease.path,
                    record: lease.recording,
                    ...this.recording
                }),
            })

            if (!res.ok) throw new Err(500, null, await res.text())
        } catch (err) {
            if (err instanceof Err && err.status === 404) {
                const url = new URL(`/v3/config/paths/add/${lease.path}`, video.url);
                url.port = '9997';

                const headers = this.headers(video.username, video.password);
                headers.append('Content-Type', 'application/json');

                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: lease.path,
                        record: lease.recording,
                        ...this.recording
                    }),
                })

                if (!res.ok) throw new Err(500, null, await res.text())
            } else {
                throw err;
            }
        }
        return lease;
    }

    async path(pathid: string): Promise<Static<typeof PathListItem>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.username, video.password);

        const url = new URL(`/v3/paths/get/${pathid}`, video.url);
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

    async recordings(config: Static<typeof PathConfig>): Promise<Static<typeof Recording>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.username, video.password);

        const url = new URL(`/v3/recordings/get/${config.name}`, video.url);
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

    async pathConfig(pathid: string): Promise<Static<typeof PathConfig>> {
        const video = await this.settings();
        if (!video.configured) throw new Err(400, null, 'Media Integration is not configured');

        const headers = this.headers(video.username, video.password);

        const url = new URL(`/v3/config/paths/get/${pathid}`, video.url);
        url.port = '9997';

        const res = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (res.ok) {
            return await res.typed(PathConfig);
        } else {
            throw new Err(res.status, new Error(await res.text()), 'Media Server Error');
        }
    }

    async delete(
        leaseid: string,
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

        const headers = this.headers(video.username, video.password);

        const lease = await this.from(leaseid, opts);

        if (opts.connection && lease.connection !== opts.connection) {
            throw new Err(400, null, `Lease does not belong to connection ${opts.connection}`);
        } else if (opts.username && lease.username !== opts.username) {
            throw new Err(400, null, `Lease does not belong to user ${opts.username}`);
        }

        await this.config.models.VideoLease.delete(leaseid);

        const url = new URL(`/v3/config/paths/delete/${lease.path}`, video.url);
        url.port = '9997';

        await fetch(url, {
            method: 'DELETE',
            headers,
        })

        return;
    }
}
