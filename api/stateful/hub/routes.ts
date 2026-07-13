import express from 'express';
import jwt from 'jsonwebtoken';
import { CoTParser } from '@tak-ps/node-cot';
import type Config from '../../common/config.js';

export default function hubRouter(config: Config): express.Router {
    const router = express.Router();

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

    router.use(express.json({ limit: '250mb' }));

    const handle = (fn: (body: Record<string, any>) => Promise<unknown>): express.RequestHandler => {
        return async (req: express.Request, res: express.Response) => {
            try {
                const result = await fn(req.body);
                res.json({ ok: true, result: result === undefined ? null : result });
            } catch (err) {
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
        return config.hub.connectionSync(body.id, { force: body.force, deleted: body.deleted });
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
            cots: (body.cots as Array<{ xml: string; path: string; metadata: Record<string, unknown> }>).map((c) => {
                const cot = CoTParser.from_xml(c.xml);
                cot.path = c.path;
                cot.metadata = c.metadata;
                return cot;
            }),
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
