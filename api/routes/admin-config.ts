import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/admin/config', {
        name: 'Get Admin Config',
        group: 'Admin',
        description: 'Get Admin-only Configuration (Admin Only)',
        res: Type.Record(Type.String(), Type.Any())
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const sensitiveKeys = [
                'agol::auth_method',
                'agol::client_id', 
                'agol::client_secret',
                'agol::token',
                'provider::secret',
                'provider::client',
                'oidc::secret'
            ];

            const final: Record<string, any> = {};
            
            (await Promise.allSettled(sensitiveKeys.map((key) => {
                return config.models.Setting.from(key);
            }))).forEach((k) => {
                if (k.status === 'rejected') return;
                
                // For secrets, return boolean indicating if they exist
                if (k.value.key.includes('secret') || k.value.key.includes('token')) {
                    final[k.value.key] = k.value.value ? '***' : '';
                } else {
                    final[k.value.key] = String(k.value.value);
                }
            });

            res.json(final);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/admin/config', {
        name: 'Update Admin Config',
        group: 'Admin', 
        description: 'Update Admin-only Configuration (Admin Only)',
        body: Type.Object({
            'agol::auth_method': Type.Optional(Type.String()),
            'agol::client_id': Type.Optional(Type.String()),
            'agol::client_secret': Type.Optional(Type.String()),
            'agol::token': Type.Optional(Type.String()),
            'provider::secret': Type.Optional(Type.String()),
            'provider::client': Type.Optional(Type.String()),
            'oidc::secret': Type.Optional(Type.String())
        }),
        res: Type.Record(Type.String(), Type.Any())
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const final: Record<string, string> = {};
            
            const updates = Object.keys(req.body)
                .filter(key => req.body[key] !== '***')
                .map(key => config.models.Setting.generate({
                    key: key,
                    // @ts-expect-error Index issue
                    value: req.body[key]
                }, { upsert: GenerateUpsert.UPDATE }));
            
            (await Promise.allSettled(updates)).forEach((k) => {
                if (k.status === 'rejected') return;
                return final[k.value.key] = String(k.value.value);
            });

            res.json(final);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}