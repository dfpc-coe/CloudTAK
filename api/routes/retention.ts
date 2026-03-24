import { Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import Retention from '../lib/retention.js';

const RetentionConfigValue = Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null()
]);

const RetentionTaskResult = Type.Object({
    name: Type.String(),
    status: Type.Union([
        Type.Literal('success'),
        Type.Literal('error')
    ]),
    scanned: Type.Integer(),
    deleted: Type.Integer(),
    duration: Type.Integer(),
    message: Type.Optional(Type.String())
});

export default async function router(schema: Schema, config: Config) {
    const retention = await Retention.load(config);

    await schema.post('/retention', {
        name: 'Run Retention Action',
        group: 'Retention',
        description: 'Run a retention action',
        body: Type.Object({
            action: Type.String(),
            config: Type.Optional(Type.Record(Type.String(), RetentionConfigValue))
        }),
        res: RetentionTaskResult
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            res.json(await retention.run({
                name: req.body.action,
                config: req.body.config || {}
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}