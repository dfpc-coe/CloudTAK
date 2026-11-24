<template>
    <MenuTemplate
        :name='name'
        :subtitle='subtitle'
        :loading='loading'
        :scroll='false'
    >
        <template #buttons>
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
                title='Select Chats'
                @click='multiselect = !multiselect'
            >
                <IconListCheck
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
            <div
                v-if='isGroup && showMembers'
                class='flex-shrink-0 border-bottom overflow-y-auto py-1'
                style='max-height: 40%;'
            >
                <TablerNone
                    v-if='!members.length'
                    label='No Known Members'
                    :create='false'
                    :compact='true'
                />
                <StandardItem
                    v-for='member in members'
                    :key='member.uid'
                    class='d-flex align-items-center gap-2 px-2 py-1'
                    @click='router.push(`/menu/chats/new?callsign=${encodeURIComponent(member.callsign)}&uid=${encodeURIComponent(member.uid)}`)'
                >
                    <IconUser
                        :size='20'
                        stroke='1'
                    />
                    <span
                        class='text-truncate'
                        v-text='member.callsign'
                    />
                </StandardItem>
            </div>
            <GenericChat
                :chats='chats'
                :my-u-i-d='id'
                :loading='loading'
                :can-send='true'
                :can-delete='true'
                :multiselect='multiselect'
                placeholder='Send Message...'
                @send='sendMessage'
                @delete='deleteChats'
                @retry='retryMessage'
                @at-bottom='onAtBottom'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import { BroadcastChatroom } from '../../../base/chatroom-chats.ts';
import type { Subscription } from 'dexie';
import { liveQuery } from '../../../database.ts';
import type { DBChatroom, DBChatroomChat } from '../../../database.ts';
import { IconListCheck, IconUser, IconUsers } from '@tabler/icons-vue';
import {
    TablerNone,
    TablerRefreshButton,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import GenericChat from '../util/GenericChat.vue';
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
const multiselect = ref(false);

const name = ref('');
const room = shallowRef<Chatroom | undefined>(undefined);

async function openRoom(): Promise<void> {
    const isNew = route.params.chatroom === 'new';

    const roomId = isNew
        ? normalizeRouteQuery(route.query.uid)
        : normalizeRouteParam(route.params.chatroom);

    if (!roomId) {
        room.value = undefined;
        loading.value = false;
        return;
    }

    room.value = await Chatroom.load(roomId, {
        name: isNew ? normalizeRouteQuery(route.query.callsign) : undefined
    });

    name.value = room.value.name;

    await fetchChats();
}

const detail = ref<DBChatroom | undefined>(undefined);
const showMembers = ref(false);
let detailSubscription: Subscription | undefined;

const isBroadcast = computed(() => detail.value?.id === BroadcastChatroom);
const isGroup = computed(() => detail.value?.type === 'group' && !isBroadcast.value);

const members = computed(() => {
    return [...(detail.value?.members ?? [])].sort((a, b) => a.callsign.localeCompare(b.callsign));
});

const subtitle = computed(() => {
    if (isBroadcast.value) return 'Everyone on your Channels';
    if (!isGroup.value) return '';

    return `${members.value.length} other ${members.value.length === 1 ? 'member' : 'members'}`;
});

watch(room, (newRoom) => {
    detailSubscription?.unsubscribe();
    detailSubscription = undefined;
    detail.value = undefined;
    showMembers.value = false;

    if (!newRoom) return;

    detailSubscription = Chatroom.live(newRoom.id).subscribe({
        next: (val) => {
            detail.value = val;
        },
        error: (err: unknown) => {
            console.error(err);
        }
    });
}, { immediate: true });

const chats = ref<DBChatroomChat[]>([]);
let subscription: Subscription | undefined;

watch([room, () => route.params.chatroom], ([newRoom, chatroom]) => {
    if (subscription) {
        subscription.unsubscribe();
        subscription = undefined;
    }

    if (newRoom && chatroom) {
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

onUnmounted(() => {
    if (subscription) subscription.unsubscribe();
    detailSubscription?.unsubscribe();
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
    if (chatroom === room.value?.chats.chatroom) return;
    await openRoom();
});

/**
 * Sending can move a Chatroom onto the UID behind it, and a new Chatroom gets its own URL
 */
async function followRoom(): Promise<void> {
    if (!room.value) return;

    const current = room.value.chats.chatroom;
    if (route.params.chatroom === current) return;

    // Replace so Back skips the previous entry
    await router.replace({
        name: 'home-menu-chat',
        params: { chatroom: current }
    });
}

async function retryMessage(messageId: string | number): Promise<void> {
    if (!room.value) return;

    await room.value.chats.retry(
        String(messageId),
        { uid: id.value, callsign: callsign.value },
        mapStore.worker
    );

    await followRoom();
}

async function sendMessage(message: string): Promise<void> {
    if (!message.trim().length) return;
    if (!room.value) return;

    await room.value.chats.send(
        message,
        { uid: id.value, callsign: callsign.value },
        mapStore.worker
    );

    await followRoom();
}

async function deleteChats(ids: Array<string | number>): Promise<void> {
    if (!room.value || !ids.length) return;

    loading.value = true;

    try {
        await room.value.deleteChats(ids.map(String));
    } catch (err) {
        loading.value = false;
        throw new Error(err instanceof Error ? err.message : String(err), { cause: err });
    }

    await fetchChats();
}

async function fetchChats(): Promise<void> {
    loading.value = true;

    if (room.value) {
        try {
            await room.value.chats.refresh();
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
