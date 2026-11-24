import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { StandardResponse, ChatMember, ChatMessageMetadata } from '../../common/types.js';
import { ChatroomType, ChatMemberRole, ChatMessageStatus } from '../../common/enums.js';
import ChatControl from '../../common/control/chat.js';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';

const ChatroomResponse = Type.Object({
    id: Type.String(),
    type: Type.Enum(ChatroomType),
    name: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    role: Type.Enum(ChatMemberRole),
    muted: Type.Boolean(),
    unread: Type.Integer(),
    last_read: Type.Union([Type.Null(), Type.String()]),
    members: Type.Array(Type.Object({
        uid: Type.String(),
        callsign: Type.String(),
        role: Type.Enum(ChatMemberRole),
        local: Type.Boolean({ description: 'The Member is a user of this CloudTAK Server' }),
    })),
});

const ChatMessageResponse = Type.Object({
    id: Type.String(),
    chatroom: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    sender_uid: Type.String(),
    sender_callsign: Type.String(),
    body: Type.String(),
    reply_to: Type.Union([Type.Null(), Type.String()]),
    metadata: ChatMessageMetadata,
    edited: Type.Union([Type.Null(), Type.String()]),
    deleted: Type.Union([Type.Null(), Type.String()]),
    status: Type.Union([Type.Null(), Type.Enum(ChatMessageStatus)]),
    reactions: Type.Array(Type.Object({
        emoji: Type.String(),
        uids: Type.Array(Type.String()),
    })),
});

const ChatroomParams = Type.Object({
    chatroom: Type.String({ format: 'uuid' }),
});

const ChatMessageParams = Type.Object({
    chatroom: Type.String({ format: 'uuid' }),
    message: Type.String({ format: 'uuid' }),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    const chat = new ChatControl(config);

    await schema.get('/chatroom', {
        name: 'List Chatrooms',
        group: 'Chat',
        description: 'List the Chatrooms the user is a Member of',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ChatroomResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const items = await chat.list(user.email);

            res.json({ total: items.length, items });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/chatroom', {
        name: 'Create Chatroom',
        group: 'Chat',
        description: 'Open the Direct Chatroom with another Member, or create a Group the user owns',
        body: Type.Object({
            type: Type.Union([Type.Literal(ChatroomType.DIRECT), Type.Literal(ChatroomType.GROUP)]),
            member: Type.Optional(ChatMember),
            name: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: 'Name of a Group' })),
            members: Type.Optional(Type.Array(ChatMember, { description: 'Other Members of a Group' })),
        }),
        res: ChatroomResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (req.body.type === ChatroomType.GROUP) {
                if (!req.body.name || !req.body.members?.length) throw new Err(400, null, 'A Group needs a name and Members');

                res.json(await chat.group(user.email, { name: req.body.name, members: req.body.members }));
            } else {
                if (!req.body.member) throw new Err(400, null, 'A Direct Chatroom needs a Member');

                const room = await chat.direct(await chat.identity(user.email), req.body.member);
                res.json(await chat.view(user.email, room.id));
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/chatroom/:chatroom', {
        name: 'Get Chatroom',
        group: 'Chat',
        description: 'Get a Chatroom the user is a Member of',
        params: ChatroomParams,
        res: ChatroomResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.view(user.email, req.params.chatroom));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/chatroom/:chatroom', {
        name: 'Update Chatroom',
        group: 'Chat',
        description: 'Update a Chatroom - advancing last_read marks earlier Messages as read and tells their senders',
        params: ChatroomParams,
        body: Type.Object({
            name: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: 'Only the owner of a Group can rename it' })),
            muted: Type.Optional(Type.Boolean()),
            last_read: Type.Optional(Type.String({ format: 'uuid', description: 'ID of the newest Message the user has seen' })),
        }),
        res: ChatroomResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.update(user.email, req.params.chatroom, req.body));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/chatroom/:chatroom', {
        name: 'Leave Chatroom',
        group: 'Chat',
        description: 'Leave a Chatroom - the owner of a Group deletes it for every Member, a Direct Chatroom is cleared for the user only',
        params: ChatroomParams,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            await chat.leave(user.email, req.params.chatroom);

            res.json({ status: 200, message: 'Left Chatroom' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/chatroom/:chatroom/member', {
        name: 'Set Members',
        group: 'Chat',
        description: 'Replace the Members of a Group the user owns',
        params: ChatroomParams,
        body: Type.Object({
            members: Type.Array(ChatMember),
        }),
        res: ChatroomResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.roster(user.email, req.params.chatroom, req.body.members));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/chatroom/:chatroom/message', {
        name: 'List Messages',
        group: 'Chat',
        description: 'List the Messages of a Chatroom, newest first',
        params: ChatroomParams,
        query: Type.Object({
            limit: Type.Integer({ default: 50, minimum: 1, maximum: 200 }),
            before: Type.Optional(Type.String({ format: 'uuid', description: 'Only Messages older than this Message' })),
            since: Type.Optional(Type.String({ description: 'Only Messages created or changed after this ISO 8601 time' })),
            filter: Type.Optional(Type.String({ description: 'Only Messages containing this text' })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ChatMessageResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.messages(user.email, req.params.chatroom, req.query));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/chatroom/:chatroom/message', {
        name: 'Send Message',
        group: 'Chat',
        description: 'Send a Message to every Member of a Chatroom - repeating a request with the same ID never sends twice',
        params: ChatroomParams,
        body: Type.Object({
            id: Type.Optional(Type.String({ format: 'uuid', description: 'Client generated ID' })),
            body: Type.String({ minLength: 1, maxLength: 8192 }),
            reply_to: Type.Optional(Type.String({ format: 'uuid' })),
            metadata: Type.Optional(ChatMessageMetadata),
        }),
        res: ChatMessageResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.send(user.email, req.params.chatroom, req.body));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/chatroom/:chatroom/message/:message', {
        name: 'Edit Message',
        group: 'Chat',
        description: 'Edit a Message the user sent - the change is not sent to TAK clients',
        params: ChatMessageParams,
        body: Type.Object({
            body: Type.String({ minLength: 1, maxLength: 8192 }),
        }),
        res: ChatMessageResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.edit(user.email, req.params.chatroom, req.params.message, req.body.body));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/chatroom/:chatroom/message/:message', {
        name: 'Delete Message',
        group: 'Chat',
        description: 'Delete a Message the user sent for every Member - TAK clients keep their copy',
        params: ChatMessageParams,
        res: ChatMessageResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.remove(user.email, req.params.chatroom, req.params.message));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/chatroom/:chatroom/message/:message/reaction', {
        name: 'React to Message',
        group: 'Chat',
        description: 'Add or remove the user\'s reaction to a Message',
        params: ChatMessageParams,
        body: Type.Object({
            emoji: Type.String({ minLength: 1, maxLength: 16 }),
            active: Type.Boolean({ default: true }),
        }),
        res: ChatMessageResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await chat.react(user.email, req.params.chatroom, req.params.message, req.body.emoji, req.body.active));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
