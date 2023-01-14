import fs from 'fs/promises';

export default async function router(schema, config) {
    await fs.readFile(new URL('../icons/icons.xml', import.meta.url));

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

            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
