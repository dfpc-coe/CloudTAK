import fs from 'fs/promises';
import path from 'path';
import Auth from '../lib/auth.js';
import Err from '@openaddresses/batch-error';
import xmljs from 'xml-js';

export default async function router(schema, config) {
    const iconset = new Array();
    for (const icon of xmljs.xml2js(String(await fs.readFile(new URL('../icons/icons.xml', import.meta.url))), {
        compact: true
    }).icons.icon) {
        if (!icon.filePath || !icon.filePath._text) continue;

        iconset.push({
            id: icon.id._text,
            name: icon.displayName._text,
            parent: icon.parentID._text,
            children: (icon.childrenIDs && Array.isArray(icon.childrenIDs.id)) ? icon.childrenIDs.id.map((id) => {
                return id._text;
            }) : []
        });
    }

    await schema.get('/icon', {
        name: 'List Icons',
        group: 'Icons',
        auth: 'user',
        description: 'List Icons',
        query: 'req.query.ListIcons.json',
        res: 'res.ListIcons.json'
    }, async (req, res) => {
        try {
            //await Auth.is_auth(req);

            req.query.filter = req.query.filter.toLowerCase();

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
                icons: icons.slice(req.query.page * req.query.limit, req.query.limit)
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
