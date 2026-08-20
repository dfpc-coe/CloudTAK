import { Type, Static } from '@sinclair/typebox';
import {
    StandardResponse,
    CoreFormResponse as CoreFormResponseType,
    CoreFormResponseResponse,
    CoreEventFormResponse,
} from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser } from '../../common/auth.js';
import { CoreFormResponse, CoreEventResponse } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import FormControl from '../lib/control/form.js';
import { userChannels } from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const formControl = new FormControl(config);

    /**
     * An Event's Responses are visible under the same rule as the Event
     * itself - its creator, System Admins, and any user with an active
     * channel the Event has been shared with
     */
    async function ensureEventAccess(user: AuthUser, event: { username: string | null; channels: number[] }): Promise<void> {
        if (user.is_admin() || event.username === user.email) return;

        const shared = (event.channels || []).map(c => Number(c));
        if (shared.length) {
            const active = await userChannels(config, user.email);
            if (shared.some(c => active.has(c))) return;
        }

        throw new Err(403, null, 'You do not have permission to access this Event');
    }

    /**
     * Refuse Event links pointing at Events that don't exist or that the
     * caller cannot access - linking surfaces the Response to the Event's
     * viewers, so it requires the same access as reading the Event
     */
    async function ensureEvents(user: AuthUser, events: string[]): Promise<void> {
        for (const event of events) {
            const augmented = await config.models.CoreEvent.augmented_from(event);
            await ensureEventAccess(user, augmented);
        }
    }

    /** Replace the Core Events a Response is linked to */
    async function commitEvents(response: string, events: string[]): Promise<void> {
        await config.pg.delete(CoreEventResponse)
            .where(eq(CoreEventResponse.response, response));

        if (events.length > 0) {
            await config.pg.insert(CoreEventResponse)
                .values(events.map(event => ({ event, response })));
        }
    }

    await schema.get('/core/event/:event/response', {
        name: 'List Event Responses',
        group: 'CoreFormResponse',
        description: 'List the Form Responses linked to a Core Event, along with the Form each was submitted against',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreFormResponse),
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventFormResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            await ensureEventAccess(user, event);

            const list = await config.models.CoreFormResponse.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    EXISTS (
                        SELECT 1
                        FROM core_event_response
                        WHERE core_event_response.response = core_form_response.id
                        AND core_event_response.event = ${event.id}
                    )
                `,
            });

            const forms = new Map<string, Static<typeof CoreFormResponseType>>();
            if (list.items.length) {
                const formList = await config.models.CoreForm.augmented_list({
                    limit: list.items.length,
                    where: sql`id IN ${[...new Set(list.items.map(r => r.form))]}`,
                });

                for (const form of formList.items) {
                    forms.set(form.id, form);
                }
            }

            const items: Array<Static<typeof CoreEventFormResponse>> = [];
            for (const response of list.items) {
                const form = forms.get(response.form);

                // A deleted Form cascades its Responses away - a missing Form
                // here would be a torn read, not a real Response
                if (!form) continue;

                items.push({
                    id: response.id,
                    created: response.created,
                    updated: response.updated,
                    username: response.username,
                    response: response.response,
                    form,
                });
            }

            res.json({
                total: items.length,
                items,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/form/:form/response', {
        name: 'List Responses',
        group: 'CoreFormResponse',
        description: 'List the Responses submitted against a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreFormResponse),
            }),
            event: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Only return Responses linked to the given Core Event',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreFormResponseResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await formControl.formAccess(user, req.params.form);

            const list = await config.models.CoreFormResponse.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: req.query.event === undefined
                    ? sql`form = ${form.id}`
                    : sql`
                        form = ${form.id}
                        AND EXISTS (
                            SELECT 1
                            FROM core_event_response
                            WHERE core_event_response.response = core_form_response.id
                            AND core_event_response.event = ${req.query.event}
                        )
                    `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/form/:form/response', {
        name: 'Submit Response',
        group: 'CoreFormResponse',
        description: 'Submit a Response against a Core Form - the Response data is validated against the Form schema',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            response: Type.Record(Type.String(), Type.Unknown(), {
                description: 'Submitted data - validated against the Form schema',
            }),
            events: Type.Array(Type.String({ format: 'uuid' }), {
                uniqueItems: true,
                default: [],
                description: 'Core Events to link the Response to',
            }),
        }),
        res: CoreFormResponseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await formControl.formAccess(user, req.params.form);

            formControl.validateResponse(form, req.body.response);

            await ensureEvents(user, req.body.events);

            const response = await config.models.CoreFormResponse.generate({
                form: form.id,
                username: user.email,
                response: req.body.response,
            });

            await commitEvents(response.id, req.body.events);

            res.json(await config.models.CoreFormResponse.augmented_from(response.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/form/:form/response/:response', {
        name: 'Get Response',
        group: 'CoreFormResponse',
        description: 'Get a single Response submitted against a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
            response: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreFormResponseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { response } = await formControl.responseAccess(user, req.params.form, req.params.response);

            res.json(response);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/form/:form/response/:response', {
        name: 'Update Response',
        group: 'CoreFormResponse',
        description: 'Update a Response submitted against a Core Form - updated Response data is validated against the Form schema',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
            response: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            response: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'Submitted data - validated against the Form schema and replaces the existing Response data',
            })),
            events: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
                uniqueItems: true,
                description: 'Core Events to link the Response to - replaces the existing links',
            })),
        }),
        res: CoreFormResponseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { form, response } = await formControl.responseAccess(user, req.params.form, req.params.response);

            if (!formControl.canEditResponse(user, form, response)) {
                throw new Err(403, null, 'Only the Response submitter or the Form author can update this Response');
            }

            if (req.body.events !== undefined) {
                await ensureEvents(user, req.body.events);
            }

            if (req.body.response !== undefined) {
                formControl.validateResponse(form, req.body.response);

                await config.models.CoreFormResponse.commit(response.id, {
                    response: req.body.response,
                    updated: sql`Now()`,
                });
            }

            if (req.body.events !== undefined) {
                await commitEvents(response.id, req.body.events);
            }

            res.json(await config.models.CoreFormResponse.augmented_from(response.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/form/:form/response/:response', {
        name: 'Delete Response',
        group: 'CoreFormResponse',
        description: 'Delete a Response submitted against a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
            response: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { form, response } = await formControl.responseAccess(user, req.params.form, req.params.response);

            if (!formControl.canEditResponse(user, form, response)) {
                throw new Err(403, null, 'Only the Response submitter or the Form author can delete this Response');
            }

            await config.models.CoreFormResponse.delete(response.id);

            res.json({ status: 200, message: 'Form Response Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
