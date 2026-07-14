import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { CoTParser } from '@tak-ps/node-cot';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/cots', {
        name: 'Submit CoTs',
        group: 'HubCoT',
        description: 'Submit CoTs for write to the connection and/or broadcast to WebSocket clients. CoTs cross the wire as XML with the in-memory path/metadata fields carried alongside, as they do not round-trip through XML',
        body: Type.Object({
            connection: Type.Union([Type.Integer(), Type.String()]),
            cots: Type.Array(Type.Object({
                xml: Type.String(),
                path: Type.Optional(Type.String()),
                metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            })),
            write: Type.Optional(Type.Boolean()),
            broadcast: Type.Optional(Type.Boolean()),
            ensureProfile: Type.Optional(Type.Boolean()),
            ifPooled: Type.Optional(Type.Boolean()),
        }),
        // The paused-connection outcome is a first-class response rather than
        // an Err: LocalHub signals it as Err(200) and response validation
        // (removeAdditional) would strip batch-error's `messages` marker from
        // a 200 body, making it indistinguishable from success on the wire
        res: Type.Object({
            submitted: Type.Boolean(),
            message: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await config.hub.submitCots({
                connection: req.body.connection,
                write: req.body.write,
                broadcast: req.body.broadcast,
                ensureProfile: req.body.ensureProfile,
                ifPooled: req.body.ifPooled,
                cots: req.body.cots.map((c) => {
                    const cot = CoTParser.from_xml(c.xml);
                    if (c.path !== undefined) cot.path = c.path;
                    if (c.metadata !== undefined) cot.metadata = c.metadata;
                    return cot;
                }),
            });

            res.json({ submitted: true, message: 'CoTs Submitted' });
        } catch (err) {
            if (err instanceof Error && 'status' in err && err.status === 200) {
                res.json({ submitted: false, message: 'safe' in err ? String(err.safe) : err.message });
            } else {
                Err.respond(err, res);
            }
        }
    });
}
