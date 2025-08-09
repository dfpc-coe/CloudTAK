import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';

interface MockVideoServerOptions {
    url?: string;
    configured?: boolean;
    defaultResponses?: boolean;
}

interface PathConfigData {
    name: string;
    runOnDemand?: string;
    runOnDemandStartTimeout?: string;
    runOnDemandCloseAfter?: string;
    maxReaders: number;
    record: boolean;
}

interface PathListItemData {
    name: string;
    confName: string;
    source: { id: string; type: string } | null;
    ready: boolean;
    readyTime: string | null;
    tracks: string[];
    bytesReceived: number;
    bytesSent: number;
    readers: Array<{ type: string; id: string }>;
}

interface VideoConfigData {
    api: boolean;
    apiAddress: string;
    metrics: boolean;
    metricsAddress: string;
    pprof: boolean;
    pprofAddress: string;
    playback: boolean;
    playbackAddress: string;
    rtsp: boolean;
    rtspAddress: string;
    rtspsAddress: string;
    rtspAuthMethods: string[];
    rtmp: boolean;
    rtmpAddress: string;
    rtmpsAddress: string;
    hls: boolean;
    hlsAddress: string;
    webrtc: boolean;
    webrtcAddress: string;
    srt: boolean;
    srtAddress: string;
}

export default class MockVideoServer {
    private mockAgent: MockAgent;
    private originalDispatcher: Dispatcher;
    private mediaServerUrl: string;
    private configured: boolean;
    private paths: Map<string, PathListItemData>;
    private pathConfigs: Map<string, PathConfigData>;

    constructor(options: MockVideoServerOptions = {}) {
        this.mediaServerUrl = options.url || 'http://media:8080';
        this.configured = options.configured !== false;
        this.paths = new Map();
        this.pathConfigs = new Map();

        // Store the original dispatcher to restore later
        this.originalDispatcher = getGlobalDispatcher();
        
        // Create a new MockAgent
        this.mockAgent = new MockAgent();
        
        // Enable mocking
        this.mockAgent.disableNetConnect();
        
        // Set as global dispatcher
        setGlobalDispatcher(this.mockAgent);

        if (options.defaultResponses !== false) {
            this.setupDefaultMockResponses();
        }
    }

    private setupDefaultMockResponses(): void {
        // Get pool for the media server
        const pool = this.mockAgent.get(this.mediaServerUrl);

        // Mock global config endpoint
        pool.intercept({
            path: '/v3/config/global/get',
            method: 'GET'
        }).reply(() => {
            return {
                statusCode: 200,
                data: JSON.stringify(this.getDefaultVideoConfig())
            };
        }).persist();

        // Mock paths list endpoint
        pool.intercept({
            path: '/v3/paths/list',
            method: 'GET'
        }).reply(() => {
            return {
                statusCode: 200,
                data: JSON.stringify({
                    pageCount: 1,
                    itemCount: this.paths.size,
                    items: Array.from(this.paths.values())
                })
            };
        }).persist();

        // Mock add path endpoint (dynamic path)
        pool.intercept({
            path: (path) => path.startsWith('/v3/config/paths/add/'),
            method: 'POST'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/config/paths/add/')[1];
            
            // Store the path configuration
            const body = JSON.parse(opts.body as string) as PathConfigData;
            this.pathConfigs.set(pathId, {
                name: body.name || pathId,
                runOnDemand: body.runOnDemand,
                runOnDemandStartTimeout: body.runOnDemandStartTimeout || '10s',
                runOnDemandCloseAfter: body.runOnDemandCloseAfter || '10s',
                maxReaders: body.maxReaders || 10,
                record: body.record || false
            });

            // Create corresponding path item
            this.paths.set(pathId, {
                name: pathId,
                confName: body.name || pathId,
                source: null,
                ready: false,
                readyTime: null,
                tracks: [],
                bytesReceived: 0,
                bytesSent: 0,
                readers: []
            });

            return {
                statusCode: 200,
                data: JSON.stringify({})
            };
        }).persist();

        // Mock get path endpoint
        pool.intercept({
            path: (path) => path.startsWith('/v3/paths/get/'),
            method: 'GET'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/paths/get/')[1];
            const pathData = this.paths.get(pathId);
            
            if (!pathData) {
                return {
                    statusCode: 404,
                    data: JSON.stringify({ error: 'Path not found' })
                };
            }

            return {
                statusCode: 200,
                data: JSON.stringify(pathData)
            };
        }).persist();

        // Mock get path config endpoint
        pool.intercept({
            path: (path) => path.startsWith('/v3/config/paths/get/'),
            method: 'GET'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/config/paths/get/')[1];
            const pathConfig = this.pathConfigs.get(pathId);
            
            if (!pathConfig) {
                return {
                    statusCode: 404,
                    data: JSON.stringify({ error: 'Path config not found' })
                };
            }

            return {
                statusCode: 200,
                data: JSON.stringify(pathConfig)
            };
        }).persist();

        // Mock patch path endpoint
        pool.intercept({
            path: (path) => path.startsWith('/v3/config/paths/patch/'),
            method: 'PATCH'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/config/paths/patch/')[1];
            const body = JSON.parse(opts.body as string) as Partial<PathConfigData>;
            
            const existing = this.pathConfigs.get(pathId);
            if (!existing) {
                return {
                    statusCode: 404,
                    data: JSON.stringify({ error: 'Path not found' })
                };
            }

            // Update the configuration
            this.pathConfigs.set(pathId, { ...existing, ...body });

            return {
                statusCode: 200,
                data: JSON.stringify({})
            };
        }).persist();

        // Mock delete path endpoint
        pool.intercept({
            path: (path) => path.startsWith('/v3/config/paths/delete/'),
            method: 'DELETE'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/config/paths/delete/')[1];
            
            this.paths.delete(pathId);
            this.pathConfigs.delete(pathId);

            return {
                statusCode: 200,
                data: JSON.stringify({})
            };
        }).persist();

        // Mock recordings endpoint
        pool.intercept({
            path: (path) => path.startsWith('/v3/recordings/get/'),
            method: 'GET'
        }).reply((opts) => {
            const pathId = opts.path.split('/v3/recordings/get/')[1];
            
            return {
                statusCode: 200,
                data: JSON.stringify({
                    name: pathId,
                    segments: []
                })
            };
        }).persist();
    }

    private getDefaultVideoConfig(): VideoConfigData {
        return {
            api: true,
            apiAddress: ':9997',
            metrics: true,
            metricsAddress: ':9998',
            pprof: true,
            pprofAddress: ':9999',
            playback: true,
            playbackAddress: ':8888',
            rtsp: true,
            rtspAddress: ':8554',
            rtspsAddress: ':8555',
            rtspAuthMethods: ['basic'],
            rtmp: true,
            rtmpAddress: ':1935',
            rtmpsAddress: ':1936',
            hls: true,
            hlsAddress: ':8888',
            webrtc: true,
            webrtcAddress: ':8889',
            srt: true,
            srtAddress: ':8890'
        };
    }

    // Helper methods for tests to manipulate mock state
    public addPath(pathId: string, pathData: Partial<PathListItemData> = {}): void {
        this.paths.set(pathId, {
            name: pathId,
            confName: pathId,
            source: null,
            ready: false,
            readyTime: null,
            tracks: [],
            bytesReceived: 0,
            bytesSent: 0,
            readers: [],
            ...pathData
        });
    }

    public setPathReady(pathId: string, ready: boolean = true): void {
        const path = this.paths.get(pathId);
        if (path) {
            path.ready = ready;
            path.readyTime = ready ? new Date().toISOString() : null;
        }
    }

    public addPathReader(pathId: string, reader: { type: string; id: string }): void {
        const path = this.paths.get(pathId);
        if (path) {
            path.readers.push(reader);
        }
    }

    public setConfigured(configured: boolean): void {
        this.configured = configured;
        
        if (!configured) {
            // If not configured, intercept config requests to return error
            const pool = this.mockAgent.get(this.mediaServerUrl);
            pool.intercept({
                path: '/v3/config/global/get',
                method: 'GET'
            }).reply(500, { error: 'Media server not configured' });
        }
    }

    public getPool() {
        return this.mockAgent.get(this.mediaServerUrl);
    }

    public simulateError(endpoint: string, statusCode: number = 500, message: string = 'Server Error'): void {
        const pool = this.mockAgent.get(this.mediaServerUrl);
        
        pool.intercept({
            path: endpoint,
            method: 'GET'
        }).reply(statusCode, { error: message });
    }

    public reset(): void {
        this.paths.clear();
        this.pathConfigs.clear();
        
        // Close the existing mock agent
        this.mockAgent.close();
        
        // Recreate the mock agent and setup default responses
        this.mockAgent = new MockAgent();
        this.mockAgent.disableNetConnect();
        setGlobalDispatcher(this.mockAgent);
        this.setupDefaultMockResponses();
    }

    public close(): void {
        // Restore the original dispatcher
        setGlobalDispatcher(this.originalDispatcher);
        
        // Close the mock agent
        this.mockAgent.close();
    }
}