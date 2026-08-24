import type { Response } from 'express';
import Err from '@openaddresses/batch-error';

// Pass `details` (ie: TAKServerError) through to the client - Err.respond only serializes status/message
const respond = Err.respond.bind(Err);

Err.respond = function (err: unknown, res: Response, messages: object[] = []) {
    if (
        err && typeof err === 'object'
        && 'details' in err && typeof err.details === 'string' && err.details.length
        && !res.headersSent
    ) {
        const rawStatus = 'status' in err ? Number(err.status) : NaN;
        const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 500;

        if (status === 500) console.error(err);

        return res.status(status).send({
            status,
            message: 'safe' in err && typeof err.safe === 'string' ? err.safe : 'Internal Server Error',
            messages,
            details: err.details,
        });
    }

    return respond(err, res, messages);
};

export default Err;
