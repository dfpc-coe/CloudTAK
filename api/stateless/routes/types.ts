import Err from '@openaddresses/batch-error';
import Type2525 from '@tak-ps/node-cot/2525';
import { ms2525e } from 'milstandard-e';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { CoTTypes } from '@tak-ps/node-cot';
import { MilSymType } from '@tak-ps/node-cot';
import { Package } from '@tak-ps/node-tak/lib/api/package';
import * as Default from '../lib/limits.js';

// 2525E Numeric SIDCs used here are 20 digits.
// Positions used by this router:
// - standard identity: sidc.substring(2, 4)
// - symbol set:        sidc.substring(4, 6)
// - entity code:       sidc.substring(10, 16)

const symbolsets: Array<{
    id: string;
    name: string;
}> = [];

const symbols: Array<{
    id: string;
    name: string;
    title: string;
    remarks: string;
    symbolset: string;
    children: number;
}> = [];

for (const symbolset of Object.keys(ms2525e)) {
    if (!/^\d{2}$/.test(symbolset)) continue;

    symbolsets.push({
        id: symbolset,
        name: ms2525e[symbolset].name,
    });

    for (const mainIcon of ms2525e[symbolset].mainIcon) {
        let name = mainIcon.Entity;

        if (mainIcon['Entity Type']) {
            name += ` - ${mainIcon['Entity Type']}`;
        }

        if (mainIcon['Entity Subtype']) {
            name += ` - ${mainIcon['Entity Subtype']}`;
        }

        symbols.push({
            id: mainIcon.Code,
            name,
            title: mainIcon['Entity Subtype'] || mainIcon['Entity Type'] || mainIcon.Entity,
            remarks: mainIcon.Remarks || '',
            symbolset,
            children: 0,
        });
    }
}

symbolsets.sort((a, b) => a.id.localeCompare(b.id));
symbols.sort((a, b) => a.symbolset.localeCompare(b.symbolset) || a.id.localeCompare(b.id));

const childCounts = new Map<string, number>();

for (const symbol of symbols) {
    const parent = parentOf(symbol.id);
    if (!parent) continue;

    const key = `${symbol.symbolset}:${parent}`;
    childCounts.set(key, (childCounts.get(key) || 0) + 1);
}

for (const symbol of symbols) {
    symbol.children = childCounts.get(`${symbol.symbolset}:${symbol.id}`) || 0;
}

/**
 * Entity Codes are hierarchical: <2: entity><2: entity type><2: entity subtype>
 * with `00` padding - ie `110000` (entity) > `110100` (entity type) > `110114` (entity subtype)
 */
function parentOf(id: string): string | null {
    if (id.endsWith('0000')) return null;
    if (id.endsWith('00')) return `${id.substring(0, 2)}0000`;
    return `${id.substring(0, 4)}00`;
}

function isChildOf(parent: string, child: string): boolean {
    if (child === parent) return false;

    if (parent.endsWith('0000')) {
        return child.startsWith(parent.substring(0, 2))
            && child.endsWith('00')
            && child.substring(2, 4) !== '00';
    } else if (parent.endsWith('00')) {
        return child.startsWith(parent.substring(0, 4))
            && !child.endsWith('00');
    }

    return false;
}

function sidc(
    symbol: { id: string; symbolset: string },
    identity: MilSymType.StandardIdentity,
): string {
    const sid = MilSymType.SID_MAP[identity.toUpperCase()] || '01';

    return `13${sid}${symbol.symbolset}0000${symbol.id}0000`;
}

export const PackageResponse = Type.Object({
    uid: Type.String({
        description: 'UID of the package',
    }),
    name: Type.String({
        description: 'Name of the latest package version',
    }),
    hash: Type.String({
        description: 'Hash of the latest package version',
    }),
    size: Type.Integer({
        description: 'Size of the latest package version in bytes',
    }),
    username: Type.Optional(Type.String({
        description: 'Submission User of the latest package version',
    })),
    created: Type.String({
        format: 'date-time',
        description: 'Submission DateTime of the latest package version',
    }),
    keywords: Type.Array(Type.String({
        description: 'Keywords of the latest package version',
    })),
    expiration: Type.Union([Type.Null(), Type.Integer(), Type.String()], {
        description: 'Expiration value of the latest package version',
    }),
    channels: Type.Array(Type.String({
        description: 'Channels assigned to the latest package version',
    })),
    items: Type.Array(Package),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    const types = await CoTTypes.default.load();

    await schema.get('/type/cot', {
        name: 'List 2525B / CoT Types',
        group: 'Symbology',
        description: 'Get Type',
        query: Type.Object({
            filter: Type.String({
                default: '',
            }),
            domain: Type.Optional(Type.Enum(MilSymType.Domain)),
            identity: Type.Enum(MilSymType.StandardIdentity),
            limit: Default.Limit,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoTTypes.TypeFormat_COT),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const items = Array.from(types.types(req.query.identity, {
                domain: req.query.domain,
            })).filter((type) => {
                return type.full && type.full.toLowerCase().includes(req.query.filter.toLowerCase());
            });

            res.json({
                total: items.length,
                items: items.slice(0, req.query.limit),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/type/2525e', {
        name: 'List 2525E Types',
        group: 'Symbology',
        description: `
            List 2525E Symbol Sets & Symbols - returned SIDCs can be used on the Feature \`type\` property

            Symbols are hierarchical: Symbol Set => Entity => Entity Type => Entity Subtype
            When no filter is provided and a symbolset is given, only top-level Entities are returned -
            pass an Entity Code as \`parent\` to descend into its Entity Types / Subtypes.
            When a filter is provided a flat search across all Symbols is performed.
        `,
        query: Type.Object({
            filter: Type.String({
                default: '',
            }),
            identity: Type.Enum(MilSymType.StandardIdentity, {
                default: MilSymType.StandardIdentity.FRIEND,
            }),
            symbolset: Type.Optional(Type.String()),
            parent: Type.Optional(Type.String({
                description: '6 digit Entity Code to list the children of - requires symbolset',
            })),
            limit: Default.Limit,
        }),
        res: Type.Object({
            total: Type.Integer(),
            symbolsets: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
            })),
            items: Type.Array(Type.Object({
                sidc: Type.String(),
                name: Type.String(),
                title: Type.String({
                    description: 'The most specific level of the Symbol name - ie the Entity Subtype name',
                }),
                remarks: Type.String(),
                symbolset: Type.String(),
                children: Type.Integer(),
            })),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            if (req.query.parent && !req.query.symbolset) {
                throw new Err(400, null, 'parent requires symbolset to be set');
            }

            const items = symbols.filter((symbol) => {
                if (req.query.symbolset && symbol.symbolset !== req.query.symbolset) {
                    return false;
                }

                if (req.query.filter) {
                    return symbol.name.toLowerCase().includes(req.query.filter.toLowerCase());
                } else if (req.query.symbolset && req.query.parent) {
                    return isChildOf(req.query.parent, symbol.id);
                } else if (req.query.symbolset) {
                    return symbol.id.endsWith('0000');
                }

                return true;
            });

            res.json({
                total: items.length,
                symbolsets,
                items: items.slice(0, req.query.limit).map((symbol) => {
                    return {
                        sidc: sidc(symbol, req.query.identity),
                        name: symbol.name,
                        title: symbol.title,
                        remarks: symbol.remarks,
                        symbolset: symbol.symbolset,
                        children: symbol.children,
                    };
                }),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/type/2525e/:sidc', {
        name: 'Get 2525E Type',
        group: 'Symbology',
        description: 'Get metadata for a given 2525D/2525E Numeric SIDC',
        params: Type.Object({
            sidc: Type.String(),
        }),
        res: Type.Object({
            sidc: Type.String(),
            name: Type.String(),
            remarks: Type.String(),
            symbolset: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            if (!Type2525.isNumericSIDCConvertable(req.params.sidc)) {
                throw new Err(400, null, 'Invalid 2525D/2525E Numeric SIDC');
            }

            const symbolset = req.params.sidc.substring(4, 6);
            const entity = req.params.sidc.substring(10, 16);

            const symbol = symbols.find((symbol) => {
                return symbol.symbolset === symbolset && symbol.id === entity;
            });

            if (!symbol) {
                res.json({
                    sidc: req.params.sidc,
                    name: 'Unknown 2525 Symbol',
                    remarks: '',
                    symbolset,
                });
            } else {
                res.json({
                    sidc: req.params.sidc,
                    name: symbol.name,
                    remarks: symbol.remarks,
                    symbolset,
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/type/cot/:type', {
        name: 'Get 2525B / CoT Type',
        group: 'Symbology',
        description: 'Get Type',
        params: Type.Object({
            type: Type.String(),
        }),
        res: CoTTypes.TypeFormat_COT,
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
                        desc: 'Unknown CoT Type',
                    });
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
                        desc: 'Unknown CoT Type',
                    });
                } else {
                    res.json(info);
                }
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
