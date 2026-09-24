import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreEventAssignmentResponse } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEventAssignment } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import EventControl from '../lib/control/event.js';
import { uniqueViolation } from '../lib/pg-error.js';
import * as Default from '../lib/limits.js';

/**
 * People assigned to manage a Core Event - a token needs both the Event scope
 * and the Assignment scope for an operation
 */
export default async function router(schema: Schema, config: ConfigStateless) {
    const eventControl = new EventControl(config);

    const resources = [
        { access: AuthResourceAccess.CONNECTION },
        { access: AuthResourceAccess.LAYER },
    ];

    const EventParam = Type.Object({
        event: Type.String({ format: 'uuid' }),
    });

    const AssignmentParam = Type.Object({
        event: Type.String({ format: 'uuid' }),
        assignment: Type.String({ format: 'uuid' }),
    });

    /** Load an Assignment, ensuring it belongs to the Event in the URL */
    async function loadAssignment(event: string, assignment: string) {
        const loaded = await config.models.CoreEventAssignment.from(assignment);
        if (loaded.event !== event) throw new Err(404, null, 'Assignment does not belong to this Event');
        return loaded;
    }

    await schema.get('/core/event/:event/assignment', {
        name: 'List Assignments',
        group: 'CoreEventAssignment',
        security: Auth.security(['event:read', 'assignment:read'], { connection: true }),
        description: 'List the people assigned to a Core Event',
        params: EventParam,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreEventAssignment),
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventAssignmentResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:read', 'assignment:read'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventAccess(auth, event, connection);

            const list = await config.models.CoreEventAssignment.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    event = ${req.params.event}
                    AND name ~* ${req.query.filter}
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/event/:event/assignment/:assignment', {
        name: 'Get Assignment',
        group: 'CoreEventAssignment',
        security: Auth.security(['event:read', 'assignment:read'], { connection: true }),
        description: 'Get a person assigned to a Core Event',
        params: AssignmentParam,
        res: CoreEventAssignmentResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:read', 'assignment:read'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventAccess(auth, event, connection);

            res.json(await loadAssignment(req.params.event, req.params.assignment));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/event/:event/assignment', {
        name: 'Create Assignment',
        group: 'CoreEventAssignment',
        security: Auth.security(['event:update', 'assignment:create'], { connection: true }),
        description: 'Assign a person to a Core Event',
        params: EventParam,
        body: Type.Object({
            name: Default.NameField,
            uid: Type.Optional(Type.Union([Type.Null(), Type.String({
                description: 'Username of the assigned Profile if they have one',
            })])),
            role: Type.String({
                default: '',
                description: 'Capacity the person manages the Event in - ie: IC, JAG',
            }),
            remarks: Type.String({
                default: '',
            }),
        }),
        res: CoreEventAssignmentResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'assignment:create'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            if (req.body.uid) await config.models.Profile.from(req.body.uid);

            const assignment = await config.models.CoreEventAssignment.generate({
                ...req.body,
                event: req.params.event,
            }).catch(uniqueViolation('Profile is already assigned to this Event'));

            res.json(assignment);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/event/:event/assignment/:assignment', {
        name: 'Update Assignment',
        group: 'CoreEventAssignment',
        security: Auth.security(['event:update', 'assignment:update'], { connection: true }),
        description: 'Update a person assigned to a Core Event',
        params: AssignmentParam,
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            uid: Type.Optional(Type.Union([Type.Null(), Type.String()], {
                description: 'Username of the assigned Profile - null removes the Profile link',
            })),
            role: Type.Optional(Type.String()),
            remarks: Type.Optional(Type.String()),
        }),
        res: CoreEventAssignmentResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'assignment:update'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            await loadAssignment(req.params.event, req.params.assignment);

            if (req.body.uid) await config.models.Profile.from(req.body.uid);

            const assignment = await config.models.CoreEventAssignment.commit(req.params.assignment, {
                ...req.body,
                updated: sql`Now()`,
            }).catch(uniqueViolation('Profile is already assigned to this Event'));

            res.json(assignment);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/event/:event/assignment/:assignment', {
        name: 'Delete Assignment',
        group: 'CoreEventAssignment',
        security: Auth.security(['event:update', 'assignment:delete'], { connection: true }),
        description: 'Remove a person assigned to a Core Event',
        params: AssignmentParam,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'assignment:delete'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            await loadAssignment(req.params.event, req.params.assignment);

            await config.models.CoreEventAssignment.delete(req.params.assignment);

            res.json({ status: 200, message: 'Assignment Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
