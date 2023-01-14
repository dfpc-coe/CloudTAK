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
        if (!icon.filePath) continue;

        iconset.push({
            id: icon.id._text,
            name: icon.displayName._text,
            parent: icon.parentID._text,
            children: (icon.childrenIDs && Array.isArray(icon.childrenIDs.id)) ? icon.childrenIDs.id.map((id) => {
                return id._text
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
            await Auth.is_auth(req);

            return res.json({
                total: iconset.length,
                icons: iconset.slice(0, 20)
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
