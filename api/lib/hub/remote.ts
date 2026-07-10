import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import { CoTParser } from '@tak-ps/node-cot';
import type { GeofenceStatus } from '../connection-geofence.js';
import type { HubClient, ConnStatus, PoolSummary, PresenceMap, SubmitCotsRequest } from './index.js';
import type Config from '../config.js';

const DEFAULT_TIMEOUT_MS = 10 * 1000;

/**
 * Timeout for calls that can open a TAK Server TCP connection and wait for
 * the TLS handshake before returning
 */
const CONNECT_TIMEOUT_MS = 30 * 1000;

const TOKEN_TTL_MS = 15 * 60 * 1000;
const TOKEN_REMINT_MS = 5 * 60 * 1000;

type Envelope<T> = {
    ok: true;
    result: T;
} | {
    ok: false;
    status: number;
    message: string;
};

/**
 * HubClient implementation that forwards to the stateful server's RPC
 * endpoint over HTTP - used by stateless API instances.
 *
 * RPC responses use an envelope rather than the HTTP status so application
 * errors (including sub-400 statuses like the layer CoT "Connection Paused"
 * 200) survive the wire unambiguously; a non-200 transport response always
 * means the hub itself is unhealthy.
 */
export default class RemoteHub implements HubClient {
    config: Config;
    url: string;

    #token?: {
        raw: string;
        expires: number;
    };

    constructor(config: Config, url: string) {
        this.config = config;
        this.url = url.replace(/\/$/, '');
    }

    #auth(): string {
        const now = Date.now();

        if (!this.#token || this.#token.expires - now < TOKEN_REMINT_MS) {
            this.#token = {
                raw: jwt.sign({ svc: 'cloudtak-api', internal: true }, this.config.SigningSecret, { expiresIn: '15m' }),
                expires: now + TOKEN_TTL_MS,
            };
        }

        return this.#token.raw;
    }

    async #call<T>(path: string, body: unknown, opts: {
        timeout?: number;
    } = {}): Promise<T> {
        let res: Response;
        try {
            res = await fetch(new URL(`/hub${path}`, this.url), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.#auth()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(opts.timeout || DEFAULT_TIMEOUT_MS),
            });
        } catch (err) {
            throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'CloudTAK Hub Unreachable');
        }

        if (res.status !== 200) {
            throw new Err(502, null, `CloudTAK Hub Error: HTTP ${res.status}`);
        }

        const envelope = await res.json() as Envelope<T>;

        if (!envelope.ok) {
            throw new Err(envelope.status, null, envelope.message);
        }

        return envelope.result;
    }

    async connectionSync(id: number, opts: { force?: boolean } = {}): Promise<ConnStatus> {
        return await this.#call('/connection/sync', {
            id,
            force: opts.force || false,
        }, {
            timeout: CONNECT_TIMEOUT_MS,
        });
    }

    async connectionStatus(ids: Array<number | string>): Promise<Record<string, ConnStatus>> {
        return await this.#call('/connection/status', { ids });
    }

    async connectionSummary(): Promise<PoolSummary> {
        return await this.#call('/connection/summary', {});
    }

    async serverRefresh(): Promise<ConnStatus> {
        return await this.#call('/server/refresh', {}, {
            timeout: CONNECT_TIMEOUT_MS,
        });
    }

    async submitCots(req: SubmitCotsRequest): Promise<void> {
        await this.#call('/cots', {
            ...req,
            cots: req.cots.map(cot => CoTParser.to_xml(cot)),
        }, {
            timeout: req.ensureProfile ? CONNECT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
        });
    }

    async wsNotify(key: string, payload: unknown, excludeSession?: string): Promise<void> {
        await this.#call('/ws/notify', { key, payload, excludeSession }, {
            timeout: 5 * 1000,
        });
    }

    async wsPresence(keys: string[]): Promise<PresenceMap> {
        return await this.#call('/ws/presence', { keys }, {
            timeout: 5 * 1000,
        });
    }

    async eventSet(layerid: number, cron: string | null): Promise<void> {
        await this.#call('/event/set', { layerid, cron });
    }

    async geofenceRefresh(): Promise<void> {
        await this.#call('/geofence/refresh', {});
    }

    async geofenceStatus(): Promise<GeofenceStatus> {
        return await this.#call('/geofence/status', {});
    }
}
