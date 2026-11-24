import {
    DirectChat, DirectChatReceipt, GroupChat, GroupChatParent,
    chatHierarchyGroup, chatHierarchyContacts,
} from '@tak-ps/node-cot';
import type CoT from '@tak-ps/node-cot';
import type { CoTParser } from '@tak-ps/node-cot';
import type { ChatMember, ChatroomExternalMetadata } from '../types.js';

export const TAKSystem = 'tak';

export const BroadcastChatroom = 'All Chat Rooms';
const LegacyBroadcastChatrooms = ['All Streaming', 'Streaming'];

const GroupParents: Array<string> = [GroupChatParent.user, GroupChatParent.team];

const SourcePrefix = /^BAO\.F\.[^.]+\./;

export type GeoChatFeature = Awaited<ReturnType<typeof CoTParser.to_geojson>>;
export type GeoChat = NonNullable<GeoChatFeature['properties']['chat']>;

export type GeoChatRoom =
    | { type: 'broadcast' }
    | { type: 'direct'; peer: ChatMember }
    | { type: 'group'; id: string; name: string; parent?: string };

function chatgrp(chat: GeoChat): Record<string, unknown> {
    const attrs: unknown = chat.chatgrp?._attributes;
    return typeof attrs === 'object' && attrs !== null ? attrs as Record<string, unknown> : {};
}

/** UIDs listed in the chatgrp of a GeoChat, in order */
export function chatgrpUids(chat: GeoChat): Array<string> {
    return Object.entries(chatgrp(chat))
        .filter(([key]) => /^uid\d+$/.test(key))
        .sort((a, b) => Number(a[0].slice(3)) - Number(b[0].slice(3)))
        .map(([, value]) => String(value));
}

/** ATAK falls back to the last segment of the Event UID (GeoChat.<sender>.<conversation>.<messageId>) */
export function chatMessageId(feat: GeoChatFeature): string {
    return feat.properties.chat?.messageId || feat.id.split('.').pop() || feat.id;
}

/**
 * Who sent a GeoChat, resolved as ATAK does: the remarks source, then the Event UID
 * chatgrp uid0 is only a last resort as some clients list another member first
 */
export function chatSender(feat: GeoChatFeature, source?: string): ChatMember {
    const chat = feat.properties.chat;
    const callsign = chat?.senderCallsign || '';

    let uid = '';

    if (source) {
        uid = source.replace(SourcePrefix, '');
    }

    const conversation = chat?.id || chat?.chatroom || '';
    const messageId = chat?.messageId || '';

    if (!uid && feat.id.startsWith('GeoChat.')) {
        let rest = feat.id.slice('GeoChat.'.length);
        if (messageId && rest.endsWith(`.${messageId}`)) rest = rest.slice(0, -(messageId.length + 1));
        if (conversation && rest.endsWith(`.${conversation}`)) uid = rest.slice(0, -(conversation.length + 1));
    }

    if (!uid && chat) uid = chatgrpUids(chat)[0] ?? '';

    return { uid, callsign: callsign || uid };
}

/** The Chatroom a GeoChat belongs to from the point of view of the user with the given UID */
export function chatRoom(chat: GeoChat, sender: ChatMember, uid: string): GeoChatRoom {
    const rawId = chat.id || chat.chatroom;

    if (
        rawId === BroadcastChatroom
        || LegacyBroadcastChatrooms.includes(rawId)
        || LegacyBroadcastChatrooms.includes(chat.chatroom)
    ) {
        return { type: 'broadcast' };
    }

    const grouped = GroupParents.includes(chat.parent || '');

    // ATAK addresses a 1:1 chat to the recipient's UID, TAK Aware to the sender's own UID
    if (!grouped && sender.uid !== uid && (rawId === uid || rawId === sender.uid)) {
        return { type: 'direct', peer: sender };
    }

    if (!grouped && sender.uid === uid) {
        const peer = chatgrpUids(chat).find((member) => member !== uid) || rawId;
        return { type: 'direct', peer: { uid: peer, callsign: chat.chatroom || peer } };
    }

    return { type: 'group', id: rawId, name: chat.chatroom || rawId, parent: chat.parent };
}

/**
 * Everyone a Group GeoChat names as a member
 * `listed` is set when the hierarchy named the members, as the owner of a Group does
 */
export function chatMembers(chat: GeoChat, sender: ChatMember): { members: Array<ChatMember>; listed: boolean } {
    const id = chat.id || chat.chatroom;
    const members = new Map<string, ChatMember>();

    for (const uid of chatgrpUids(chat)) members.set(uid, { uid, callsign: uid });

    const group = chat.hierarchy ? chatHierarchyGroup(chat.hierarchy, id) : undefined;
    const listed = group ? chatHierarchyContacts(group) : [];
    for (const contact of listed) members.set(contact.uid, contact);

    if (sender.uid) members.set(sender.uid, sender);
    members.delete(id);

    return { members: [...members.values()], listed: listed.length > 0 };
}

export function directChat(from: ChatMember, to: ChatMember, message: string, messageId: string): CoT {
    return new DirectChat({ from, to, message, messageId });
}

export function directReceipt(from: ChatMember, to: ChatMember, status: 'delivered' | 'read', messageId: string): CoT {
    return new DirectChatReceipt({ from, to, status, messageId });
}

export function broadcastChat(from: ChatMember, message: string, messageId: string): CoT {
    return new GroupChat({
        from,
        group: { id: BroadcastChatroom, name: BroadcastChatroom },
        parent: GroupChatParent.root,
        message,
        messageId,
    });
}

/**
 * GeoChat to the other members of a Group
 *
 * @param opts.owner - The sender created the Group so recipients replace its membership with this one
 */
export function groupChat(
    from: ChatMember,
    group: { id: string; name: string },
    members: Array<ChatMember>,
    external: ChatroomExternalMetadata,
    message: string,
    messageId: string,
    opts: { owner?: boolean; deleteChild?: string } = {},
): CoT {
    const others = members.filter((member) => member.uid !== from.uid);
    if (!others.length) throw new Error('Group Chatroom has no other members');

    const nested = !opts.owner && external.hierarchy && chatHierarchyGroup(external.hierarchy, group.id);

    return new GroupChat({
        from,
        group,
        members: others,
        hierarchy: nested ? external.hierarchy : undefined,
        parent: external.parent || GroupChatParent.user,
        groupOwner: opts.owner,
        deleteChild: opts.deleteChild,
        message,
        messageId,
    });
}

/** Tell the members of a Group that its owner deleted it - ATAK announces this to the parent Group */
export function groupDelete(
    from: ChatMember,
    group: { id: string; name: string },
    members: Array<ChatMember>,
    external: ChatroomExternalMetadata,
    messageId: string,
): CoT {
    const others = members.filter((member) => member.uid !== from.uid);
    if (!others.length) throw new Error('Group Chatroom has no other members');

    return new GroupChat({
        from,
        group: { id: external.parent || GroupChatParent.user, name: 'Groups' },
        members: others,
        parent: GroupChatParent.root,
        deleteChild: group.id,
        message: `Deleted group: ${group.name}`,
        messageId,
    });
}
