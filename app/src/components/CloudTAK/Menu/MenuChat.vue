<template>
    <MenuTemplate
        :name='detail?.name || name'
        :subtitle='subtitle'
        :loading='loading'
        :scroll='false'
    >
        <template #buttons>
            <TablerIconButton
                title='Search Messages'
                @click='toggleSearch'
            >
                <IconSearch
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='isGroup'
                title='Members'
                @click='showMembers = !showMembers'
            >
                <IconUsers
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='detail'
                :title='detail.muted ? "Unmute Notifications" : "Mute Notifications"'
                @click='toggleMute'
            >
                <IconBellOff
                    v-if='detail.muted'
                    :size='32'
                    stroke='1'
                />
                <IconBell
                    v-else
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchChats'
            />
        </template>
        <template #default>
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <div
                v-if='searching'
                class='flex-shrink-0 py-2'
            >
                <TablerInput
                    v-model='filter'
                    icon='search'
                    placeholder='Search Messages'
                    :autofocus='true'
                />
            </div>
            <div
                v-if='isGroup && showMembers'
                class='flex-shrink-0 border-bottom overflow-y-auto py-1'
                style='max-height: 40%;'
            >
                <div
                    v-if='detail?.role === "owner"'
                    class='d-flex justify-content-end px-2'
                >
                    <button
                        class='btn btn-sm btn-link p-0'
                        @click='editGroup = true'
                    >
                        Edit Group
                    </button>
                </div>
                <StandardItem
                    v-for='member in members'
                    :key='member.uid'
                    class='d-flex align-items-center gap-2 px-2 py-1'
                    @click='openDirect(member)'
                >
                    <IconUser
                        :size='20'
                        stroke='1'
                    />
                    <span
                        class='text-truncate flex-grow-1'
                        v-text='member.callsign'
                    />
                    <span
                        v-if='member.role === "owner"'
                        class='badge bg-blue-lt'
                    >Owner</span>
                    <span
                        v-if='!member.local'
                        class='badge bg-secondary-lt'
                        title='Reached through the TAK Server'
                    >TAK</span>
                </StandardItem>
            </div>
            <GenericChat
                :chats='filter.trim().length ? results : chats'
                :my-u-i-d='id'
                :loading='loading'
                :can-send='true'
                :rich='true'
                :more='more && !filter.trim().length'
                placeholder='Send Message...'
                @send='sendMessage'
                @retry='retryMessage'
                @older='loadOlder'
                @edit='editMessage'
                @remove='removeMessage'
                @react='reactMessage'
                @at-bottom='onAtBottom'
            />
        </template>
    </MenuTemplate>

    <MenuChatGroup
        v-if='editGroup && detail'
        :room='detail'
        :my-u-i-d='id'
        @close='editGroup = false'
        @saved='editGroup = false'
    />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import type { Subscription } from 'dexie';
import { liveQuery } from '../../../database.ts';
import type { DBChatroom, DBChatroomChat, DBChatroomMember } from '../../../database.ts';
import {
    IconBell,
    IconBellOff,
    IconSearch,
    IconUser,
    IconUsers,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerInput,
    TablerRefreshButton,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import GenericChat from '../util/GenericChat.vue';
import MenuChatGroup from './MenuChatGroup.vue';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';

const mapStore = useMapStore();
const atBottom = ref(true);

function normalizeRouteParam(param: string | string[]): string {
    return Array.isArray(param) ? (param[0] ?? '') : param;
}

function normalizeRouteQuery(query: string | null | (string | null)[]): string {
    if (Array.isArray(query)) return query[0] ?? '';
    return query ?? '';
}

function onAtBottom(isAtBottom: boolean): void {
    atBottom.value = isAtBottom;

    if (isAtBottom) {
        void room.value?.chats.markRead();
    }
}

const route = useRoute();
const router = useRouter();

const id = ref('');
const callsign = ref('');
const loading = ref(true);
const error = ref<Error | undefined>(undefined);

const name = ref('');
const room = shallowRef<Chatroom | undefined>(undefined);
const more = ref(false);

const detail = ref<DBChatroom | undefined>(undefined);
const showMembers = ref(false);
const editGroup = ref(false);
let detailSubscription: Subscription | undefined;

const searching = ref(false);
const filter = ref('');
const results = ref<DBChatroomChat[]>([]);

const isGroup = computed(() => detail.value?.type === 'group');

const members = computed<Array<DBChatroomMember>>(() => {
    return [...(detail.value?.members ?? [])]
        .filter((member) => member.uid !== id.value)
        .sort((a, b) => a.callsign.localeCompare(b.callsign));
});

const subtitle = computed(() => {
    if (detail.value?.type === 'broadcast') return 'Everyone on your Channels';
    if (!isGroup.value) return '';

    return `${members.value.length} other ${members.value.length === 1 ? 'member' : 'members'}`;
});

/**
 * A new Chatroom is opened by the UID & callsign of a Contact and then gets its own URL
 */
async function openRoom(): Promise<void> {
    error.value = undefined;

    try {
        if (route.params.chatroom === 'new') {
            const uid = normalizeRouteQuery(route.query.uid);
            if (!uid) throw new Error('A Contact is required to start a Chat');

            const opened = await Chatroom.direct({
                uid,
                callsign: normalizeRouteQuery(route.query.callsign) || uid
            });

            // Replace so Back skips the placeholder entry
            await router.replace({ name: 'home-menu-chat', params: { chatroom: opened.id } });
            return;
        }

        room.value = await Chatroom.from(normalizeRouteParam(route.params.chatroom));
        if (!room.value) throw new Error('Chatroom Not Found');

        name.value = room.value.name;
    } catch (err) {
        room.value = undefined;
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
        return;
    }

    await fetchChats();
}

watch(room, (newRoom) => {
    detailSubscription?.unsubscribe();
    detailSubscription = undefined;
    detail.value = undefined;
    showMembers.value = false;
    searching.value = false;
    filter.value = '';

    if (!newRoom) return;

    detailSubscription = Chatroom.live(newRoom.id).subscribe({
        next: (val) => {
            // The Chatroom was deleted or the user was removed from it
            if (!val && detail.value) void router.replace({ name: 'home-menu-chats' });
            detail.value = val;
        },
        error: (err: unknown) => {
            console.error(err);
        }
    });
}, { immediate: true });

const chats = ref<DBChatroomChat[]>([]);
let subscription: Subscription | undefined;

watch(room, (newRoom) => {
    if (subscription) {
        subscription.unsubscribe();
        subscription = undefined;
    }

    if (newRoom) {
        const obs = liveQuery(() => newRoom.chats.list());
        subscription = obs.subscribe({
            next: async (val) => {
                chats.value = val;
                if (atBottom.value) {
                    await nextTick();
                    await newRoom.chats.markRead();
                }
            },
            error: (err: unknown) => {
                console.error(err);
            }
        });
    } else {
        chats.value = [];
    }
}, { immediate: true });

let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(filter, (term) => {
    clearTimeout(searchTimer);

    if (!term.trim().length) {
        results.value = [];
        return;
    }

    searchTimer = setTimeout(async () => {
        try {
            results.value = await room.value?.chats.search(term.trim()) ?? [];
        } catch (err) {
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    }, 250);
});

function toggleSearch(): void {
    searching.value = !searching.value;
    if (!searching.value) filter.value = '';
}

onUnmounted(() => {
    if (subscription) subscription.unsubscribe();
    detailSubscription?.unsubscribe();
    clearTimeout(searchTimer);
});

onMounted(async () => {
    const username = (await ProfileConfig.get('username'))?.value;
    const tak_callsign = (await ProfileConfig.get('tak_callsign'))?.value;

    if (!username) {
        throw new Error('Username not set in profile config');
    }

    id.value = `ANDROID-CloudTAK-${username}`;
    callsign.value = String(tak_callsign ?? '');

    await openRoom();
});

watch(() => route.params.chatroom, async (chatroom) => {
    if (!chatroom || chatroom === room.value?.id) return;
    loading.value = true;
    await openRoom();
});

async function guard(action: () => Promise<void>): Promise<void> {
    try {
        error.value = undefined;
        await action();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function openDirect(member: DBChatroomMember): Promise<void> {
    await router.push({
        name: 'home-menu-chat',
        params: { chatroom: 'new' },
        query: { uid: member.uid, callsign: member.callsign }
    });
}

async function toggleMute(): Promise<void> {
    await guard(async () => {
        if (!room.value || !detail.value) return;
        await room.value.update({ muted: !detail.value.muted });
    });
}

async function retryMessage(messageId: string | number): Promise<void> {
    await room.value?.chats.retry(String(messageId));
}

async function sendMessage(message: string, opts: { reply_to?: string } = {}): Promise<void> {
    if (!message.trim().length) return;
    if (!room.value) return;

    const location = (await mapStore.worker.profile.location)?.coordinates;

    await room.value.chats.send(
        message,
        { uid: id.value, callsign: callsign.value },
        { reply_to: opts.reply_to, location }
    );
}

async function editMessage(messageId: string | number, message: string): Promise<void> {
    await guard(async () => await room.value?.chats.edit(String(messageId), message));
}

async function removeMessage(messageId: string | number): Promise<void> {
    await guard(async () => await room.value?.chats.remove(String(messageId)));
}

async function reactMessage(messageId: string | number, emoji: string, active: boolean): Promise<void> {
    await guard(async () => await room.value?.chats.react(String(messageId), emoji, active));
}

async function loadOlder(): Promise<void> {
    await guard(async () => {
        if (!room.value) return;
        await room.value.chats.older();
        more.value = room.value.chats.more;
    });
}

async function fetchChats(): Promise<void> {
    loading.value = true;

    if (room.value) {
        try {
            await room.value.chats.refresh();
            more.value = room.value.chats.more;
        } catch (err) {
            console.error(err);
        }
    }

    loading.value = false;

    if (atBottom.value) {
        await nextTick();
        await room.value?.chats.markRead();
    }
}
</script>
