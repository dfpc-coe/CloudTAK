import express from 'express';
import jwt from 'jsonwebtoken';
import { CoTParser } from '@tak-ps/node-cot';
import type Config from '../config.js';

/**
 * Internal RPC surface exposed by the stateful (hub) server for the
 * stateless API instances - a thin HTTP wrapper over the hub-side
 * LocalHub so both call paths share one implementation.
 *
 * Responses are enveloped: `{ok: true, result}` on success or
 * `{ok: false, status, message}` carrying a thrown Err across the wire
 * (see RemoteHub). Authentication is a SigningSecret-signed JWT with an
 * `internal` claim - the port this router listens on is additionally
 * never registered with the public load balancer.
 */
export default function hubRouter(config: Config): express.Router {
    const router = express.Router();

    router.use(express.json({ limit: '50mb' }));

    router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
            const header = req.headers.authorization;
            if (!header || !header.startsWith('Bearer ')) throw new Error('No Token Provided');

            const decoded = jwt.verify(header.slice('Bearer '.length), config.SigningSecret) as {
                svc?: string;
                internal?: boolean;
            };

            if (decoded.svc !== 'cloudtak-api' || decoded.internal !== true) {
                throw new Error('Invalid Token Claims');
            }

            next();
        } catch (err) {
            console.error('Hub RPC Auth Error:', err instanceof Error ? err.message : String(err));
            res.status(401).json({ ok: false, status: 401, message: 'Unauthorized' });
        }
    });

    const handle = (fn: (body: Record<string, any>) => Promise<unknown>): express.RequestHandler => {
        return async (req: express.Request, res: express.Response) => {
            try {
                const result = await fn(req.body);
                res.json({ ok: true, result: result === undefined ? null : result });
            } catch (err) {
                // Structural check rather than instanceof - model errors are
                // thrown by a different copy of batch-error than the one
                // imported here
                if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
                    res.json({ ok: false, status: err.status, message: err.message });
                } else {
                    console.error('Hub RPC Error:', err);
                    res.json({ ok: false, status: 500, message: 'Internal Hub Error' });
                }
            }
        };
    };

    router.post('/connection/sync', handle((body) => {
        return config.hub.connectionSync(body.id, { force: body.force });
    }));

    router.post('/connection/status', handle((body) => {
        return config.hub.connectionStatus(body.ids);
    }));

    router.post('/connection/summary', handle(() => {
        return config.hub.connectionSummary();
    }));

    router.post('/server/refresh', handle((body) => {
        return config.hub.serverRefresh({ refreshAll: body.refreshAll });
    }));

    router.post('/cots', handle((body) => {
        return config.hub.submitCots({
            connection: body.connection,
            write: body.write,
            broadcast: body.broadcast,
            ensureProfile: body.ensureProfile,
            ifPooled: body.ifPooled,
            cots: (body.cots as string[]).map(xml => CoTParser.from_xml(xml)),
        });
    }));

    router.post('/ws/notify', handle((body) => {
        return config.hub.wsNotify(body.key, body.payload, body.excludeSession);
    }));

    router.post('/ws/presence', handle((body) => {
        return config.hub.wsPresence(body.keys);
    }));

    router.post('/event/set', handle((body) => {
        return config.hub.eventSet(body.layerid, body.cron ?? null);
    }));

    router.post('/geofence/refresh', handle(() => {
        return config.hub.geofenceRefresh();
    }));

    router.post('/geofence/status', handle(() => {
        return config.hub.geofenceStatus();
    }));

    return router;
}
