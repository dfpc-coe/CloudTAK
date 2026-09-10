import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import type ConfigStateless from '../config.js';
import ScimControl, {
    ScimErr,
    ScimUser,
    ScimUserList,
    ScimUserBody,
    ScimPatchBody,
    ScimGroupResource,
    ScimGroupList,
    ScimGroupBody,
    scimRespond,
    SCIM_USER_SCHEMA,
    SCIM_GROUP_SCHEMA,
    SCIM_LIST_SCHEMA,
    SCIM_CONTENT_TYPE,
} from '../lib/control/scim.js';

const ScimDiscoveryList = Type.Object({
    schemas: Type.Array(Type.String()),
    totalResults: Type.Integer(),
    startIndex: Type.Integer(),
    itemsPerPage: Type.Integer(),
    Resources: Type.Array(Type.Unknown()),
});

const security = [{ scimAuth: [] }];

export default async function router(schema: Schema, config: ConfigStateless) {
    const scim = new ScimControl(config);

    await schema.get('/scim/v2/ServiceProviderConfig', {
        name: 'SCIM Service Provider Config',
        group: 'SCIM',
        security,
        description: 'SCIM 2.0 Service Provider capabilities - authenticated with the admin configured SCIM token',
        res: Type.Object({
            schemas: Type.Array(Type.String()),
            patch: Type.Object({ supported: Type.Boolean() }),
            bulk: Type.Object({ supported: Type.Boolean(), maxOperations: Type.Integer(), maxPayloadSize: Type.Integer() }),
            filter: Type.Object({ supported: Type.Boolean(), maxResults: Type.Integer() }),
            changePassword: Type.Object({ supported: Type.Boolean() }),
            sort: Type.Object({ supported: Type.Boolean() }),
            etag: Type.Object({ supported: Type.Boolean() }),
            authenticationSchemes: Type.Array(Type.Object({
                type: Type.String(),
                name: Type.String(),
                description: Type.String(),
            })),
        }),
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.type(SCIM_CONTENT_TYPE).json({
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
                patch: { supported: true },
                bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
                filter: { supported: true, maxResults: 1000 },
                changePassword: { supported: false },
                sort: { supported: false },
                etag: { supported: false },
                authenticationSchemes: [{
                    type: 'oauthbearertoken',
                    name: 'OAuth Bearer Token',
                    description: 'Authentication scheme using the SCIM token configured by a CloudTAK administrator',
                }],
            });
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/ResourceTypes', {
        name: 'SCIM Resource Types',
        group: 'SCIM',
        security,
        description: 'SCIM 2.0 Resource Types supported by CloudTAK',
        res: ScimDiscoveryList,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.type(SCIM_CONTENT_TYPE).json({
                schemas: [SCIM_LIST_SCHEMA],
                totalResults: 2,
                startIndex: 1,
                itemsPerPage: 2,
                Resources: [{
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    id: 'User',
                    name: 'User',
                    endpoint: '/Users',
                    schema: SCIM_USER_SCHEMA,
                    meta: {
                        resourceType: 'ResourceType',
                        location: `${config.API_URL}/api/scim/v2/ResourceTypes/User`,
                    },
                }, {
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    id: 'Group',
                    name: 'Group',
                    endpoint: '/Groups',
                    schema: SCIM_GROUP_SCHEMA,
                    meta: {
                        resourceType: 'ResourceType',
                        location: `${config.API_URL}/api/scim/v2/ResourceTypes/Group`,
                    },
                }],
            });
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/Schemas', {
        name: 'SCIM Schemas',
        group: 'SCIM',
        security,
        description: 'SCIM 2.0 Schemas supported by CloudTAK',
        res: ScimDiscoveryList,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.type(SCIM_CONTENT_TYPE).json({
                schemas: [SCIM_LIST_SCHEMA],
                totalResults: 2,
                startIndex: 1,
                itemsPerPage: 2,
                Resources: [{
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                    id: SCIM_USER_SCHEMA,
                    name: 'User',
                    description: 'CloudTAK User',
                    attributes: [
                        { name: 'userName', type: 'string', multiValued: false, required: true, mutability: 'immutable', returned: 'default', uniqueness: 'server', caseExact: false },
                        { name: 'name', type: 'complex', multiValued: false, required: false, mutability: 'readWrite', returned: 'default', subAttributes: [
                            { name: 'formatted', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                            { name: 'givenName', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                            { name: 'familyName', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                        ] },
                        { name: 'displayName', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                        { name: 'emails', type: 'complex', multiValued: true, required: false, mutability: 'readOnly', returned: 'default' },
                        { name: 'active', type: 'boolean', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                    ],
                    meta: {
                        resourceType: 'Schema',
                        location: `${config.API_URL}/api/scim/v2/Schemas/${SCIM_USER_SCHEMA}`,
                    },
                }, {
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                    id: SCIM_GROUP_SCHEMA,
                    name: 'Group',
                    description: 'CloudTAK Group - accepted for Identity Provider compatibility, membership is not stored',
                    attributes: [
                        { name: 'displayName', type: 'string', multiValued: false, required: true, mutability: 'readWrite', returned: 'default', uniqueness: 'server', caseExact: true },
                        { name: 'externalId', type: 'string', multiValued: false, required: false, mutability: 'readWrite', returned: 'default' },
                        { name: 'members', type: 'complex', multiValued: true, required: false, mutability: 'readWrite', returned: 'default', subAttributes: [
                            { name: 'value', type: 'string', multiValued: false, required: true, mutability: 'readWrite', returned: 'default' },
                            { name: 'display', type: 'string', multiValued: false, required: false, mutability: 'readOnly', returned: 'default' },
                        ] },
                    ],
                    meta: {
                        resourceType: 'Schema',
                        location: `${config.API_URL}/api/scim/v2/Schemas/${SCIM_GROUP_SCHEMA}`,
                    },
                }],
            });
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/Users', {
        name: 'SCIM List Users',
        group: 'SCIM',
        security,
        description: 'List Users - supports the `userName eq "value"` filter',
        query: Type.Object({
            filter: Type.Optional(Type.String()),
            startIndex: Type.Integer({ default: 1, minimum: 1 }),
            count: Type.Integer({ default: 100, minimum: 0, maximum: 1000 }),
        }),
        res: ScimUserList,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            const list = await scim.list({
                filter: req.query.filter,
                startIndex: req.query.startIndex,
                count: req.query.count,
            });

            res.type(SCIM_CONTENT_TYPE).json(list);
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.post('/scim/v2/Users', {
        name: 'SCIM Create User',
        group: 'SCIM',
        security,
        description: 'Provision a User - the TAK certificate is issued on their first login',
        body: ScimUserBody,
        res: ScimUser,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            const profile = await scim.create(req.body);

            res.status(201).type(SCIM_CONTENT_TYPE).json(await scim.serialize(profile));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/Users/:id', {
        name: 'SCIM Get User',
        group: 'SCIM',
        security,
        description: 'Get a User by ID (username)',
        params: Type.Object({
            id: Type.String(),
        }),
        res: ScimUser,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            const profile = await scim.from(req.params.id);

            res.type(SCIM_CONTENT_TYPE).json(await scim.serialize(profile));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.put('/scim/v2/Users/:id', {
        name: 'SCIM Replace User',
        group: 'SCIM',
        security,
        description: 'Replace a User - the userName is immutable',
        params: Type.Object({
            id: Type.String(),
        }),
        body: ScimUserBody,
        res: ScimUser,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            let profile = await scim.from(req.params.id);

            if (req.body.userName.trim().toLowerCase() !== profile.username) {
                throw new ScimErr(400, 'userName cannot be changed', 'mutability');
            }

            profile = await scim.update(profile, {
                name: req.body.name,
                displayName: req.body.displayName,
                active: req.body.active ?? true,
            });

            res.type(SCIM_CONTENT_TYPE).json(await scim.serialize(profile));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.patch('/scim/v2/Users/:id', {
        name: 'SCIM Patch User',
        group: 'SCIM',
        security,
        description: 'Patch a User - supports add/replace of active, displayName & name',
        params: Type.Object({
            id: Type.String(),
        }),
        body: ScimPatchBody,
        res: ScimUser,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            let profile = await scim.from(req.params.id);

            const input = ScimControl.patchInput(req.body.Operations, profile.username);

            profile = await scim.update(profile, input);

            res.type(SCIM_CONTENT_TYPE).json(await scim.serialize(profile));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/Groups', {
        name: 'SCIM List Groups',
        group: 'SCIM',
        security,
        description: 'List Groups - supports the `displayName eq "value"` and `externalId eq "value"` filters',
        query: Type.Object({
            filter: Type.Optional(Type.String()),
            startIndex: Type.Integer({ default: 1, minimum: 1 }),
            count: Type.Integer({ default: 100, minimum: 0, maximum: 1000 }),
        }),
        res: ScimGroupList,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            const list = scim.groupList({
                filter: req.query.filter,
                startIndex: req.query.startIndex,
                count: req.query.count,
            });

            res.type(SCIM_CONTENT_TYPE).json(list);
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.post('/scim/v2/Groups', {
        name: 'SCIM Create Group',
        group: 'SCIM',
        security,
        description: 'Accept a Group - Groups are not stored, the returned id encodes the displayName so the Group can be addressed on later syncs',
        body: ScimGroupBody,
        res: ScimGroupResource,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.status(201).type(SCIM_CONTENT_TYPE).json(scim.groupCreate(req.body));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.get('/scim/v2/Groups/:id', {
        name: 'SCIM Get Group',
        group: 'SCIM',
        security,
        description: 'Get a Group by ID',
        params: Type.Object({
            id: Type.String(),
        }),
        res: ScimGroupResource,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.type(SCIM_CONTENT_TYPE).json(scim.serializeGroup({
                displayName: ScimControl.groupName(req.params.id),
            }));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.put('/scim/v2/Groups/:id', {
        name: 'SCIM Replace Group',
        group: 'SCIM',
        security,
        description: 'Replace a Group - displayName, externalId & members',
        params: Type.Object({
            id: Type.String(),
        }),
        body: ScimGroupBody,
        res: ScimGroupResource,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            ScimControl.groupName(req.params.id);

            res.type(SCIM_CONTENT_TYPE).json(scim.groupCreate(req.body));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.patch('/scim/v2/Groups/:id', {
        name: 'SCIM Patch Group',
        group: 'SCIM',
        security,
        description: 'Patch a Group - supports add/replace/remove of displayName, externalId & members',
        params: Type.Object({
            id: Type.String(),
        }),
        body: ScimPatchBody,
        res: ScimGroupResource,
    }, async (req, res) => {
        try {
            await scim.auth(req);

            res.type(SCIM_CONTENT_TYPE).json(scim.groupUpdate(req.params.id, ScimControl.groupPatchInput(req.body.Operations)));
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.delete('/scim/v2/Groups/:id', {
        name: 'SCIM Delete Group',
        group: 'SCIM',
        security,
        description: 'Delete a Group',
        params: Type.Object({
            id: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await scim.auth(req);

            ScimControl.groupName(req.params.id);

            res.status(204).end();
        } catch (err) {
            scimRespond(err, res);
        }
    });

    await schema.delete('/scim/v2/Users/:id', {
        name: 'SCIM Delete User',
        group: 'SCIM',
        security,
        description: 'Deprovision a User - the User is disabled, their sessions are revoked and they can no longer log in',
        params: Type.Object({
            id: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await scim.auth(req);

            const profile = await scim.from(req.params.id);

            await scim.deprovision(profile);

            res.status(204).end();
        } catch (err) {
            scimRespond(err, res);
        }
    });
}
