<template>
    <MenuTemplate
        :name='name'
        :loading='loading'
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
                :my-u-i-d='myUID'
                :loading='loading'
                :can-send='true'
                :can-delete='true'
                :multiselect='multiselect'
                @send='onSend'
                @delete='onDelete'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, shallowRef, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import { liveQuery } from 'dexie';
import { IconListCheck } from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import GenericChat from '../util/GenericChat.vue';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';
import type { DBChatroomChat } from '../../../base/database.ts';

const mapStore = useMapStore();
const route = useRoute();
const router = useRouter();

const myUID = ref('');
const callsign = ref('');
const loading = ref(true);
const multiselect = ref(false);
const name = ref(route.params.chatroom === 'new' ? String(route.query.callsign) : String(route.params.chatroom));
const room = shallowRef<Chatroom | undefined>();
const chats = ref<DBChatroomChat[]>([]);

let liveSubscription: { unsubscribe: () => void } | null = null;

watch([room, () => route.params.chatroom], ([newRoom, chatroom]) => {
    if (liveSubscription) {
        liveSubscription.unsubscribe();
        liveSubscription = null;
    }

    if (newRoom && chatroom !== 'new') {
        const obs = liveQuery(() => (newRoom as Chatroom).chats.list());
        liveSubscription = obs.subscribe({
            next: async (val) => {
                chats.value = val;
                await (newRoom as Chatroom).chats.markRead();
            },
            error: (err) => {
                console.error(err);
            }
        });
    } else {
        chats.value = [];
    }
}, { immediate: true });

onUnmounted(() => {
    if (liveSubscription) liveSubscription.unsubscribe();
});

onMounted(async () => {
    const username = (await ProfileConfig.get('username'))?.value;
    const tak_callsign = (await ProfileConfig.get('tak_callsign'))?.value;

    if (!username) throw new Error('Username not set in profile config');

    myUID.value = `ANDROID-CloudTAK-${username}`;
    callsign.value = String(tak_callsign || '');

    room.value = new Chatroom(name.value);
    await fetchChats();
});

watch(() => route.params.chatroom, async (newChatroom) => {
    name.value = newChatroom === 'new' ? String(route.query.callsign) : String(newChatroom);
    room.value = new Chatroom(name.value);
    await fetchChats();
});

async function onSend(message: string): Promise<void> {
    if (!room.value) return;

    let recipient: { uid: string; callsign: string } | undefined;
    if (route.query.uid && route.query.callsign) {
        recipient = {
            uid: String(route.query.uid),
            callsign: String(route.query.callsign),
        };
    }

    await room.value.chats.send(
        message,
        { uid: myUID.value, callsign: callsign.value },
        mapStore.worker,
        recipient
    );

    if (route.params.chatroom === 'new') {
        await router.push({ name: 'home-menu-chat', params: { chatroom: name.value } });
    }
}

async function onDelete(ids: string[]): Promise<void> {
    if (!room.value) return;
    loading.value = true;
    try {
        await room.value.deleteChats(ids);
    } finally {
        loading.value = false;
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
}
</script>
