<template>
    <MenuTemplate
        :name='name'
        :loading='loading'
        :scroll='false'
    >
        <template #buttons>
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
                @at-bottom='onAtBottom'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang="ts">
import { ref, onMounted, shallowRef, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import { liveQuery, type Subscription } from 'dexie';
import type { DBChatroomChat } from '../../../base/database.ts';
import { IconListCheck } from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
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

const initialName = route.params.chatroom === 'new'
    ? normalizeRouteQuery(route.query.callsign)
    : normalizeRouteParam(route.params.chatroom);
const name = ref<string>(initialName);
const room = shallowRef<Chatroom | undefined>(undefined);

const chats = ref<DBChatroomChat[]>([]);
let subscription: Subscription | undefined;

watch([room, () => route.params.chatroom], ([newRoom, chatroom]) => {
    if (subscription) {
        subscription.unsubscribe();
        subscription = undefined;
    }

    const chatroomStr = Array.isArray(chatroom) ? (chatroom[0] ?? '') : chatroom;

    if (newRoom && chatroomStr !== 'new') {
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
});

onMounted(async () => {
    const username = (await ProfileConfig.get('username'))?.value;
    const tak_callsign = (await ProfileConfig.get('tak_callsign'))?.value;

    if (!username) {
        throw new Error('Username not set in profile config');
    }

    id.value = `ANDROID-CloudTAK-${username}`;
    callsign.value = String(tak_callsign ?? '');

    room.value = new Chatroom(name.value);

    await fetchChats();
});

watch(() => route.params.chatroom, async (newChatroom) => {
    if (newChatroom === 'new') {
        name.value = normalizeRouteQuery(route.query.callsign);
    } else {
        name.value = normalizeRouteParam(newChatroom);
    }
    room.value = new Chatroom(name.value);
    await fetchChats();
});

async function sendMessage(message: string): Promise<void> {
    if (!message.trim().length) return;
    if (!room.value) return;

    let recipient: { uid: string; callsign: string } | undefined;
    if (route.query.uid && route.query.callsign) {
        recipient = {
            uid: normalizeRouteQuery(route.query.uid),
            callsign: normalizeRouteQuery(route.query.callsign)
        };
    }

    await room.value.chats.send(
        message,
        { uid: id.value, callsign: callsign.value },
        mapStore.worker,
        recipient
    );

    if (route.params.chatroom === 'new') {
        await router.push({
            name: 'home-menu-chat',
            params: { chatroom: name.value }
        });
    }
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

    if (route.params.chatroom !== 'new' && room.value) {
        try {
            await Chatroom.load(room.value.name, { reload: false });
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
