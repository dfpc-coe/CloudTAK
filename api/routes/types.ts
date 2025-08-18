import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { CoTTypes } from '@tak-ps/node-cot';
import { MilSymType } from '@tak-ps/node-cot';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const types = await CoTTypes.default.load();

    await schema.get('/type/cot', {
        name: 'List Types',
        group: 'COTTypes',
        description: 'Get Type',
        query: Type.Object({
            filter: Type.String({
                default: '',
            }),
            domain: Type.Optional(Type.Enum(MilSymType.Domain)),
            identity: Type.Enum(MilSymType.StandardIdentity),
            limit: Default.Limit
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoTTypes.TypeFormat_COT)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const items = Array.from(types.types(req.query.identity, {
                domain: req.query.domain
            })).filter((type) => {
                return type.full && type.full.toLowerCase().includes(req.query.filter.toLowerCase())
            });

            res.json({
                total: items.length,
                items: items.slice(0, req.query.limit)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/type/cot/:type', {
        name: 'Get Type',
        group: 'COTTypes',
        description: 'Get Type',
        params: Type.Object({
            type: Type.String()
        }),
        res: CoTTypes.TypeFormat_COT
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const split = req.params.type.split('-');

            if (split[0] === 'a' && split[1]) {
                const info = types.cots.get(req.params.type.replace(/a-.-/, `a-.-`));

                if (!info) {
                    res.json({
                        cot: req.params.type,
                        full: req.params.type,
                        desc: 'Unknown CoT Type'
                    })
                } else {
                    info.cot = req.params.type.replace('-.-', `-${split[1]}-`);

                    res.json(info);
                }
            } else {
                const info = types.cots.get(req.params.type);

                if (!info) {
                    res.json({
                        cot: req.params.type,
                        full: req.params.type,
                        desc: 'Unknown CoT Type'
                    })
                } else {
                    res.json(info);
                }
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
