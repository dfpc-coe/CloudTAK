import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import Retention from '../lib/retention.js';

const RetentionTaskResult = Type.Object({
    name: Type.String(),
    status: Type.Union([
        Type.Literal('success'),
        Type.Literal('error'),
    ]),
    deleted: Type.Integer(),
    duration: Type.Integer(),
    message: Type.Optional(Type.String()),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    const retention = await Retention.load(config);

    await schema.post('/retention', {
        name: 'Run Retention Action',
        group: 'Retention',
        description: 'Run a retention action',
        body: Type.Object({
            action: Type.String(),
        }),
        res: RetentionTaskResult,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            res.json(await retention.run({
                name: req.body.action,
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
