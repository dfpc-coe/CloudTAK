import { Type } from '@sinclair/typebox';
import { sql, eq, and } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import ECR from '../lib/aws/ecr.js';
import type ConfigStateless from '../config.js';
import { Integration, Layer as LayerSchema } from '../../common/schema.js';
import { StandardResponse, IntegrationResponse } from '../../common/types.js';
import * as Default from '../lib/limits.js';
import { isSafeUrl } from '@tak-ps/node-safeurl';
import { StaticCapabilitiesSchema } from '@tak-ps/etl';

export enum IntegrationSchemaEnum {
    OUTPUT = 'schema:output',
    INPUT = 'schema:input',
}

export default async function router(schema: Schema, config: ConfigStateless) {
    /** Whether any Layer runs the given version of a registered Integration */
    async function deployed(prefix: string, version: string): Promise<boolean> {
        const integrations = await config.models.Integration.list({
            limit: 1,
            where: eq(Integration.prefix, prefix),
        });

        if (!integrations.items.length) return false;

        const layers = await config.models.Layer.count({
            where: and(
                eq(LayerSchema.task, integrations.items[0].id),
                eq(LayerSchema.version, version),
            ),
        });

        return layers !== 0;
    }

    await schema.get('/integration', {
        name: 'List Integrations',
        group: 'Integration',
        description: 'List registered Integrations',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Integration),
            }),
            filter: Default.Filter,
            prefix: Type.Optional(Type.String({
                description: 'Only return the Integration with this exact prefix',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(IntegrationResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.Integration.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${req.query.prefix ?? null}::TEXT IS NULL OR prefix = ${req.query.prefix ?? null}::TEXT)
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/integration', {
        name: 'Create Integration',
        group: 'Integration',
        description: 'Register a new Integration',
        body: Type.Object({
            name: Type.String(),
            prefix: Type.String(),
            favorite: Type.Boolean({
                default: false,
                description: 'Displayed first in the Integration List',
            }),
            logo: Type.Optional(Type.String()),
            repo: Type.Optional(Type.String()),
            readme: Type.Optional(Type.String()),
        }),
        res: IntegrationResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const integration = await config.models.Integration.generate(req.body);

            res.json(integration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/integration/:integrationid', {
        name: 'Delete Integration',
        group: 'Integration',
        description: 'Delete a registered Integration - fails if any Layer still uses it',
        params: Type.Object({
            integrationid: Type.Integer(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const layers = await config.models.Layer.count({
                where: eq(LayerSchema.task, req.params.integrationid),
            });

            if (layers) throw new Err(400, null, 'Cannot delete an Integration with an active Layer');

            await config.models.Integration.delete(req.params.integrationid);

            res.json({
                status: 200,
                message: 'Integration Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/integration/raw', {
        name: 'List Raw Integrations',
        group: 'RawIntegration',
        description: 'List container images & versions in the Registry',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Record(
                Type.String(),
                Type.Array(Type.String()),
            ),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const { total, tasks } = await ECR.versions();

            res.json({
                total,
                items: Object.fromEntries(tasks),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/integration/raw/:prefix', {
        name: 'Get Raw Integration',
        group: 'RawIntegration',
        params: Type.Object({
            prefix: Type.String(),
        }),
        description: 'List Versions for a specific container image prefix',
        res: Type.Object({
            total: Type.Integer(),
            versions: Type.Array(Type.Object({
                version: Type.String(),
                deployed: Type.Boolean(),
            })),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const { tasks } = await ECR.versions();

            const list = tasks.get(req.params.prefix) || [];

            const deployedVersions = new Set<string>();
            if (list.length) {
                for await (const layer of config.models.Layer.iter({
                    where: sql`task IN (SELECT id FROM integrations WHERE prefix = ${req.params.prefix}::TEXT)`,
                })) {
                    deployedVersions.add(layer.version);
                }
            }

            res.json({
                total: list.length,
                versions: list.map(version => ({
                    version,
                    deployed: deployedVersions.has(version),
                })),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/integration/raw/:prefix/version/:version', {
        name: 'Get Version',
        group: 'RawIntegration',
        params: Type.Object({
            prefix: Type.String(),
            version: Type.String(),
        }),
        description: 'Get a single Integration Version, including the Capabilities document embedded in the OCI Image Manifest at build time',
        res: Type.Object({
            version: Type.String(),
            deployed: Type.Boolean(),
            capabilities: Type.Union([StaticCapabilitiesSchema, Type.Null()]),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const { tasks } = await ECR.versions();

            const versions = tasks.get(req.params.prefix);
            if (!versions) throw new Err(404, null, 'Integration does not exist');
            if (!versions.includes(req.params.version)) throw new Err(404, null, 'Integration Version does not exist');

            const capabilities = await ECR.capabilities(req.params.prefix, req.params.version);

            res.json({
                version: req.params.version,
                deployed: await deployed(req.params.prefix, req.params.version),
                capabilities,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/integration/raw/:prefix/version/:version', {
        name: 'Delete Version',
        group: 'RawIntegration',
        params: Type.Object({
            prefix: Type.String(),
            version: Type.String(),
        }),
        description: 'Delete a given Integration version from the Registry',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const { tasks } = await ECR.versions();

            const versions = tasks.get(req.params.prefix);
            if (!versions) throw new Err(400, null, 'Integration does not exist');
            if (!versions.includes(req.params.version)) throw new Err(400, null, 'Integration Version does not exist');

            if (await deployed(req.params.prefix, req.params.version)) {
                throw new Err(400, null, 'Cannot delete an Integration version with an active Layer');
            }

            await ECR.delete(req.params.prefix, req.params.version);

            res.json({
                status: 200,
                message: 'Deleted Integration Version',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/integration/:integrationid', {
        name: 'Get Integration',
        group: 'Integration',
        description: 'Return a single registered Integration',
        params: Type.Object({
            integrationid: Type.Integer(),
        }),
        res: IntegrationResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const integration = await config.models.Integration.from(req.params.integrationid);

            res.json(integration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/integration/:integrationid', {
        name: 'Update Integration',
        group: 'Integration',
        description: 'Update a registered Integration',
        params: Type.Object({
            integrationid: Type.Integer(),
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            repo: Type.Optional(Type.String()),
            logo: Type.Optional(Type.String()),
            readme: Type.Optional(Type.String()),
            favorite: Type.Optional(Type.Boolean({
                description: 'Displayed first in the Integration List',
            })),
        }),
        res: IntegrationResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const integration = await config.models.Integration.commit(req.params.integrationid, req.body);

            res.json(integration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/integration/:integrationid/readme', {
        name: 'Integration README',
        group: 'Integration',
        description: 'Return README Contents',
        params: Type.Object({
            integrationid: Type.Integer(),
        }),
        res: Type.Object({
            body: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const integration = await config.models.Integration.from(req.params.integrationid);

            if (integration.readme) {
                // Skip isSafeUrl check when StackName=test (test mode)
                if (process.env.StackName !== 'test') {
                    const { safe, reason } = await isSafeUrl(integration.readme);
                    if (!safe) throw new Err(400, null, `Blocked URL: ${reason}`);
                }
                const readmeres = await fetch(integration.readme);
                res.json({
                    body: await readmeres.text(),
                });
            } else {
                res.json({ body: '' });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
