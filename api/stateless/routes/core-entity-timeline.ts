import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { StandardResponse, CoreEntityTimelineResponse, CoreEntityTimelineInput, CoreEntityTimelinePatch } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser, AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEntityTimeline } from '../../common/schema.js';
import { CoreEntityTimeline_Type, LayerMapping_Destination } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import EntityControl from '../lib/control/entity.js';
import { uniqueViolation } from '../lib/pg-error.js';
import * as Default from '../lib/limits.js';

/**
 * Timeline entries of a Core Entity - a dated narrative of comments, CAD unit
 * updates, status changes, etc. on an Event or Device
 */
export default async function router(schema: Schema, config: ConfigStateless) {
    const eventControl = new EntityControl(config, 'Event');
    const deviceControl = new EntityControl(config, 'Device');

    const resources = [
        { access: AuthResourceAccess.CONNECTION },
        { access: AuthResourceAccess.LAYER },
    ];

    const EntityParam = Type.Object({
        entity: Type.String({ format: 'uuid' }),
    });

    const EntryParam = Type.Object({
        entity: Type.String({ format: 'uuid' }),
        entry: Type.String({ format: 'uuid' }),
    });

    /** Load the Entity's sharing columns and the access rules of its kind */
    async function loadEntity(id: string) {
        const entity = await config.models.CoreEntity.shared_from(id);
        const control = entity.kind === LayerMapping_Destination.COREDEVICE ? deviceControl : eventControl;
        return { entity, control };
    }

    /** Load an entry, ensuring it belongs to the Entity in the URL */
    async function loadEntry(entity: string, entry: string) {
        const loaded = await config.models.CoreEntityTimeline.from(entry);
        if (loaded.entity !== entity) throw new Err(404, null, 'Entry does not belong to this Entity');
        return loaded;
    }

    /** Users may only change their own entries unless they are an admin */
    function ensureAuthor(auth: AuthUser | AuthResource, entry: { username: string | null }) {
        if (auth instanceof AuthUser && !auth.is_admin() && entry.username !== auth.email) {
            throw new Err(403, null, 'Only the author of a Timeline entry may change it');
        }
    }

    /** Users are recorded by username, tokens only by the display name they supply */
    function attribution(auth: AuthUser | AuthResource, author: string) {
        if (auth instanceof AuthUser) {
            return { username: auth.email, author: author || auth.email };
        } else {
            return { username: null, author };
        }
    }

    await schema.get('/core/entity/:entity/timeline', {
        name: 'List Timeline',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:read', { connection: true }),
        description: 'List the Timeline entries of a Core Entity',
        params: EntityParam,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'occurred',
                enum: Object.keys(CoreEntityTimeline),
            }),
            filter: Default.Filter,
            type: Type.Optional(Type.Enum(CoreEntityTimeline_Type, {
                description: 'Only return entries of the given type',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEntityTimelineResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:read',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureAccess(auth, entity, connection);

            const type = req.query.type === undefined ? sql`True` : sql`type = ${req.query.type}`;

            const list = await config.models.CoreEntityTimeline.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    entity = ${req.params.entity}
                    AND (body ~* ${req.query.filter} OR author ~* ${req.query.filter})
                    AND ${type}
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/entity/:entity/timeline/:entry', {
        name: 'Get Timeline Entry',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:read', { connection: true }),
        description: 'Get a Timeline entry of a Core Entity',
        params: EntryParam,
        res: CoreEntityTimelineResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:read',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureAccess(auth, entity, connection);

            res.json(await loadEntry(req.params.entity, req.params.entry));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/entity/:entity/timeline', {
        name: 'Create Timeline Entry',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:create', { connection: true }),
        description: 'Add a Timeline entry to a Core Entity',
        params: EntityParam,
        body: CoreEntityTimelineInput,
        res: CoreEntityTimelineResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:create',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureEditable(auth, entity, connection);

            const entry = await config.models.CoreEntityTimeline.generate({
                ...req.body,
                ...attribution(auth, req.body.author),
                entity: req.params.entity,
            }).catch(uniqueViolation('external_id is already used by another entry of this Entity'));

            res.json(entry);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/core/entity/:entity/timeline', {
        name: 'Upsert Timeline Entries',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:create', { connection: true }),
        description: 'Add many Timeline entries to a Core Entity in one call - entries with an external_id already present on the Entity are updated in place',
        params: EntityParam,
        body: Type.Object({
            entries: Type.Array(CoreEntityTimelineInput, { minItems: 1, maxItems: 1000 }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEntityTimelineResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:create',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureEditable(auth, entity, connection);

            const values = req.body.entries.map(entry => ({
                ...entry,
                ...attribution(auth, entry.author),
                entity: req.params.entity,
            }));

            const items = await config.pg.transaction(async (tx) => {
                const written: Array<Static<typeof CoreEntityTimelineResponse>> = [];

                const keyed = values.filter(v => v.external_id);
                if (keyed.length) {
                    written.push(...await tx.insert(CoreEntityTimeline)
                        .values(keyed)
                        .onConflictDoUpdate({
                            target: [CoreEntityTimeline.entity, CoreEntityTimeline.external_id],
                            targetWhere: sql`external_id IS NOT NULL`,
                            set: {
                                updated: sql`Now()`,
                                occurred: sql`excluded.occurred`,
                                type: sql`excluded.type`,
                                username: sql`excluded.username`,
                                author: sql`excluded.author`,
                                body: sql`excluded.body`,
                                metadata: sql`excluded.metadata`,
                            },
                        })
                        .returning());
                }

                const unkeyed = values.filter(v => !v.external_id);
                if (unkeyed.length) {
                    written.push(...await tx.insert(CoreEntityTimeline).values(unkeyed).returning());
                }

                return written;
            });

            res.json({ total: items.length, items });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/entity/:entity/timeline/:entry', {
        name: 'Update Timeline Entry',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:update', { connection: true }),
        description: 'Update a Timeline entry of a Core Entity',
        params: EntryParam,
        body: CoreEntityTimelinePatch,
        res: CoreEntityTimelineResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:update',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureEditable(auth, entity, connection);

            ensureAuthor(auth, await loadEntry(req.params.entity, req.params.entry));

            const entry = await config.models.CoreEntityTimeline.commit(req.params.entry, {
                ...req.body,
                updated: sql`Now()`,
            }).catch(uniqueViolation('external_id is already used by another entry of this Entity'));

            res.json(entry);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/entity/:entity/timeline/:entry', {
        name: 'Delete Timeline Entry',
        group: 'CoreEntityTimeline',
        security: Auth.security('timeline:delete', { connection: true }),
        description: 'Remove a Timeline entry from a Core Entity',
        params: EntryParam,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'timeline:delete',
                resources,
            });

            const { entity, control } = await loadEntity(req.params.entity);
            const connection = auth instanceof AuthResource ? await control.resourceConnection(auth) : null;
            await control.ensureEditable(auth, entity, connection);

            ensureAuthor(auth, await loadEntry(req.params.entity, req.params.entry));

            await config.models.CoreEntityTimeline.delete(req.params.entry);

            res.json({ status: 200, message: 'Timeline Entry Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
