import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { OpenAPIV3 as Doc } from 'openapi-types';

export default async function router(schema: Schema) {
    await schema.get('/schema', {
        security: [],
        name: 'List Schemas',
        group: 'Swagger',
        description: `
            List all JSON Schemas in use
            With no parameters this API will return a list of all the endpoints that have a form of schema validation
            If the url/method params are used, the schemas themselves are returned

            Note: If url or method params are used, they must be used together
        `,
        query: Type.Object({
            method: Type.Optional(Type.Uppercase(Type.Enum(Doc.HttpMethods))),
            url: Type.Optional(Type.String()),
        }),
        res: Type.Any(),
    }, async (req, res) => {
        try {
            if (req.query.url && req.query.method) {
                res.json(schema.query(req.query.method, req.query.url));
            } else if (req.query.url || req.query.method) {
                throw new Err(400, null, 'url & method params must be used together');
            } else {
                res.json(schema.list());
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/openapi', {
        security: [],
        name: 'Get OpenAPI',
        group: 'Swagger',
        description: 'Return a OpenAPI Schema for the API',
        res: Type.Any(),
    }, async (req, res) => {
        try {
            res.json(schema.docs.base);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/swagger', {
        security: [],
        name: 'Get Swagger',
        group: 'Swagger',
        description: 'Return Swagger Doc in JSON',
        res: Type.Any(),
    }, async (req, res) => {
        try {
            res.json(schema.docs.base);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
