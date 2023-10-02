import fs from 'fs/promises';
import path from 'path';
import Auth from '../lib/auth.js';
import Err from '@openaddresses/batch-error';
import xmljs from 'xml-js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema) {
    const iconset = new Array();
    const iconmap = new Map();
    for (const icon of xmljs.xml2js(String(await fs.readFile(new URL('../icons/icons.xml', import.meta.url))), {
        compact: true
    // @ts-ignore
    }).icons.icon) {
        if (!icon.filePath || !icon.filePath._text) continue;

        const item = {
            id: icon.id._text,
            name: icon.displayName._text,
            file: path.parse(icon.filePath._text).base,
            parent: icon.parentID._text,
            children: (icon.childrenIDs && Array.isArray(icon.childrenIDs.id)) ? icon.childrenIDs.id.map((id) => {
                return id._text;
            }) : []
        };

        iconmap.set(item.id, item);
        iconmap.set(item.file, item);
        iconset.push(item);
    }

    await schema.get('/icon', {
        name: 'List Icons',
        group: 'Icons',
        auth: 'user',
        description: 'List Icons',
        query: 'req.query.ListIcons.json',
        res: 'res.ListIcons.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            req.query.filter = String(req.query.filter).toLowerCase();

            let icons = iconset;
            if (req.query.filter) {
                icons = iconset.filter((icon) => {
                    if (icon.id.toLowerCase().startsWith(req.query.filter)) return true;
                    if (icon.name.toLowerCase().match(req.query.filter)) return true;
                    return false;
                });
            }

            return res.json({
                total: icons.length,
                icons: icons.slice(parseInt(String(req.query.page)) * parseInt(String(req.query.limit)), parseInt(String(req.query.page)) * parseInt(String(req.query.limit)) + parseInt(String(req.query.limit)))
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/icon/:icon', {
        name: 'Get Icon',
        group: 'Icons',
        auth: 'user',
        ':icon': 'string',
        description: 'Icon Metadata',
        res: 'res.Icon.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (iconmap.has(req.params.icon)) {
                return res.json(iconmap.get(req.params.icon));
            } else {
                throw new Err(400, null, 'Icon Not Found');
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
