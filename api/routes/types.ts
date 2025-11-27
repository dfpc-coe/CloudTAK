import Err from '@openaddresses/batch-error';
import { ms2525e } from 'milstandard-e';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { CoTTypes } from '@tak-ps/node-cot';
import { MilSymType } from '@tak-ps/node-cot';
import * as Default from '../lib/limits.js';

// 2525E Symbols
// <version>-<context>-<standard identity>-<symbol set>-<status>-<hq/task force/dummy>-<modifier>-<6: entity>-<2: mod1>-<2: mod2>
// Context:
// 0: Reality
// 1: Exercise
// 2: Simulation

const symbolsets: Array<{
    id: string;
    name: string;
}> = [];

const symbols: Array<{
    id: string,
    name: string,
    remarks: string,
    symbolset: string,
}> = [];


for (const symbolset of Object.keys(ms2525e)) {
    symbolsets.push({
        id: symbolset,
        name: ms2525e[symbolset].name
    });

    for (const mainIcon of ms2525e[symbolset].mainIcon) {
        let name = mainIcon.Entity
        if (mainIcon["Entity Type"]) {
            name += ` - ${mainIcon["Entity Type"]}`;
        }

        if (mainIcon["Entity Subtype"]) {
            name += ` - ${mainIcon["Entity Subtype"]}`;
        }

        symbols.push({
            id: mainIcon.Code,
            name,
            remarks: mainIcon.Remarks || '',
            symbolset
        });
    }
}

export default async function router(schema: Schema, config: Config) {
    const types = await CoTTypes.default.load();

    await schema.get('/type/cot', {
        name: '2525B/ CoT Types',
        group: 'Symbology',
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
        name: '2525B/ CoT Type',
        group: 'Symbology',
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

    await schema.get('/type/2525e', {
        name: '2525E Types',
        group: 'Symbology',
        description: 'Get Type',
        query: Type.Object({
            filter: Type.String({
                default: '',
            }),
        }),
        res: Type.Object({
            symbolsets: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
            })),
            items: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
                remarks: Type.String(),
                symbolset: Type.String(),
            })),
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            res.json({
                symbolsets,
                items: symbols.filter((symbol) => {
                    return symbol.name.toLowerCase().includes(req.query.filter.toLowerCase())
                })
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
