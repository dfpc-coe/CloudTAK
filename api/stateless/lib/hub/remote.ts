import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import { CoTParser } from '@tak-ps/node-cot';
import type { GeofenceStatus } from '../../../stateful/lib/connection-geofence.js';
import type { HubClient, ConnStatus, PoolSummary, PresenceMap, SubmitCotsRequest } from '../../../common/hub/index.js';
import type Config from '../../../common/config.js';

const DEFAULT_TIMEOUT_MS = 10 * 1000;

const CONNECT_TIMEOUT_MS = 30 * 1000;

const TOKEN_TTL_MS = 15 * 60 * 1000;
const TOKEN_REMINT_MS = 5 * 60 * 1000;

type WireError = {
    status: number;
    message: string;
    messages: unknown[];
};

// batch-error's Err.respond always includes a `messages` array alongside
// status/message; hub route success responses never do. Its presence is what
// marks an application error - even on HTTP 200, which carries soft errors
// like Err(200, 'Received but Connection Paused') across the wire
function isWireError(body: unknown): body is WireError {
    return !!body && typeof body === 'object'
        && typeof (body as WireError).status === 'number'
        && typeof (body as WireError).message === 'string'
        && Array.isArray((body as WireError).messages);
}

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

        let parsed: unknown;
        try {
            parsed = await res.json();
        } catch (err) {
            throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'CloudTAK Hub returned an invalid response');
        }

        if (isWireError(parsed)) {
            throw new Err(parsed.status, null, parsed.message);
        }

        // Non-200 without a batch-error body: the auth gate or something in
        // front of the hub responded, not a route handler
        if (res.status !== 200) {
            throw new Err(502, null, `CloudTAK Hub Error: HTTP ${res.status}`);
        }

        return parsed as T;
    }

    async connectionSync(id: number, opts: { force?: boolean; deleted?: boolean } = {}): Promise<ConnStatus> {
        const res = await this.#call<{ status: ConnStatus }>('/connection/sync', {
            id,
            force: opts.force || false,
            deleted: opts.deleted || false,
        }, {
            timeout: CONNECT_TIMEOUT_MS,
        });

        return res.status;
    }

    async connectionStatus(ids: Array<number | string>): Promise<Record<string, ConnStatus>> {
        return await this.#call('/connection/status', { ids });
    }

    async connectionSummary(): Promise<PoolSummary> {
        return await this.#call('/connection/summary', {});
    }

    async serverRefresh(opts: { refreshAll?: boolean } = {}): Promise<ConnStatus> {
        const res = await this.#call<{ status: ConnStatus }>('/server/refresh', {
            refreshAll: opts.refreshAll || false,
        }, {
            timeout: CONNECT_TIMEOUT_MS,
        });

        return res.status;
    }

    async submitCots(req: SubmitCotsRequest): Promise<void> {
        const res = await this.#call<{ submitted: boolean; message: string }>('/cots', {
            ...req,
            cots: req.cots.map(cot => ({
                xml: CoTParser.to_xml(cot),
                path: cot.path,
                metadata: cot.metadata,
            })),
        }, {
            timeout: req.ensureProfile ? CONNECT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
        });

        // Re-throw the hub's soft-failure acknowledgment exactly as LocalHub
        // raises it in-process, so both hub client implementations agree
        if (!res.submitted) throw new Err(200, null, res.message);
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
