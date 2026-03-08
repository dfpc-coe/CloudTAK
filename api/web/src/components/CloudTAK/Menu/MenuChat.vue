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
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='d-flex flex-column h-100 overflow-hidden'
            >
                <div
                    ref='scrollContainer'
                    class='flex-grow-1 position-relative'
                    style='min-height: 0; overflow-y: auto;'
                    @scroll='onScroll'
                >
                    <GenericSelect
                        ref='select'
                        role='menu'
                        :disabled='!multiselect'
                        :items='chats'
                    >
                        <template #buttons='{disabled}'>
                            <TablerDelete
                                :disabled='disabled'
                                displaytype='icon'
                                @delete='deleteChats'
                            />
                        </template>
                        <template #item='{item}'>
                            <div class='w-100 d-flex my-2 px-2'>
                                <div
                                    v-if='item.sender_uid !== id'
                                    class='bg-blue px-2 py-2 rounded'
                                >
                                    <div v-text='item.message' />
                                    <div
                                        class='text-end'
                                        style='font-size: 0.75rem; opacity: 0.75;'
                                        v-text='formatTime(item.created)'
                                    />
                                </div>
                                <div
                                    v-else
                                    class='ms-auto bg-accent px-2 py-2 rounded'
                                >
                                    <div v-text='item.message' />
                                    <div
                                        class='text-end'
                                        style='font-size: 0.75rem; opacity: 0.75;'
                                        v-text='formatTime(item.created)'
                                    />
                                </div>
                            </div>
                        </template>
                    </GenericSelect>
                </div>
                <div class='flex-shrink-0 border-top position-relative pt-1'>
                    <button
                        v-if='chats.length && !atBottom'
                        class='btn btn-primary rounded-circle position-absolute start-50 p-1 scroll-bottom-btn'
                        style='z-index: 10; top: -56px; width: 44px; height: 44px;'
                        title='Scroll to bottom'
                        @click='scrollToBottom'
                    >
                        <IconArrowDown
                            :size='24'
                            stroke='2.5'
                        />
                    </button>
                    <div class='d-flex align-items-center mx-2 mb-2 mt-1'>
                        <div class='flex-grow-1 me-2'>
                            <TablerInput
                                v-model='message'
                                @keyup.enter='sendMessage'
                            />
                        </div>
                        <div>
                            <TablerIconButton
                                title='Send Message'
                                @click='sendMessage'
                            >
                                <IconSend
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup>
import { ref, onMounted, shallowRef, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import GenericSelect from '../util/GenericSelect.vue';
import { liveQuery } from 'dexie';
import {
    IconListCheck,
    IconSend,
    IconArrowDown,
} from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerDelete,
    TablerIconButton,
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';
import timeDiff from '../../../timediff.ts';
const mapStore = useMapStore();

const scrollContainer = ref(null);
const atBottom = ref(true);

function onScroll() {
    const el = scrollContainer.value;
    if (!el) return;
    atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
}

function scrollToBottom() {
    const el = scrollContainer.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
}

const route = useRoute();
const router = useRouter();

const id = ref('')
const callsign = ref('');
const loading = ref(true);
const select = ref(null);
const multiselect = ref(false);
const name = ref(route.params.chatroom === 'new' ? route.query.callsign : route.params.chatroom);
const room = shallowRef();

const chats = ref([]);
let subscription;

watch([room, () => route.params.chatroom], ([newRoom, chatroom]) => {
    if (subscription) {
        subscription.unsubscribe();
        subscription = null;
    }

    if (newRoom && chatroom !== 'new') {
        const obs = liveQuery(() => newRoom.chats.list());
        subscription = obs.subscribe({
            next: async (val) => {
                chats.value = val;
                if (atBottom.value) {
                    await nextTick();
                    scrollToBottom();
                }
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
    if (subscription) subscription.unsubscribe();
});

const message = ref('');

onMounted(async () => {
    const username = (await ProfileConfig.get('username'))?.value;
    const tak_callsign = (await ProfileConfig.get('tak_callsign'))?.value;

    if (!username) {
        throw new Error('Username not set in profile config');
    }

    id.value = `ANDROID-CloudTAK-${username}`
    callsign.value = tak_callsign || '';

    room.value = new Chatroom(name.value);

    await fetchChats();
});

watch(() => route.params.chatroom, async (newChatroom) => {
    if (newChatroom === 'new') {
        name.value = route.query.callsign;
    } else {
        name.value = newChatroom;
    }
    room.value = new Chatroom(name.value);
    await fetchChats();
});

async function sendMessage() {
    if (!message.value.trim().length) return;
    if (!room.value) return;

    let recipient;
    if (route.query.uid && route.query.callsign) {
        recipient = {
            uid: String(route.query.uid),
            callsign: String(route.query.callsign)
        }
    }

    await room.value.chats.send(
        message.value,
        { uid: id.value, callsign: callsign.value },
        mapStore.worker,
        recipient
    );

    message.value = ''

    if (route.params.chatroom === 'new') {
        await router.push({
            name: 'home-menu-chat',
            params: { chatroom: name.value }
        });
    }
}

async function deleteChats() {
    if (!select.value) return;
    if (!room.value) return;
    const selected = select.value.selected;

    loading.value = true;

    try {
        await room.value.deleteChats(Array.from(selected.values()));
    } catch (err) {
        loading.value = false;
        throw new Error(err.message, { cause: err });
    }

    await fetchChats();
}

async function fetchChats() {
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

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 86400000 && diff >= 0) {
        return timeDiff(iso);
    }

    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');

    return `${month} ${day}, ${hour}:${minute}`;
}
</script>

<style scoped>
@keyframes float {
    0% {
        transform: translateX(-50%) translateY(0);
    }
    50% {
        transform: translateX(-50%) translateY(-6px);
    }
    100% {
        transform: translateX(-50%) translateY(0);
    }
}

.scroll-bottom-btn {
    opacity: 0.9;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
    animation: float 2.5s ease-in-out infinite;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease, background-color 0.2s ease;
}

.scroll-bottom-btn:hover {
    opacity: 1;
    background-color: var(--bs-primary-dark, #0b5ed7);
    animation: none;
    transform: translateX(-50%) translateY(0);
}
</style>
