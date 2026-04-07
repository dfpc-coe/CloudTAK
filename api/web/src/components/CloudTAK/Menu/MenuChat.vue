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
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='d-flex flex-column flex-grow-1 overflow-hidden'
                style='min-height: 0'
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
                                    <div class='fw-bold small mb-1 d-flex align-items-center gap-1'>
                                        <IconUser
                                            :size='14'
                                            stroke='1.5'
                                        />
                                        <span v-text='item.sender || "Unknown"' />
                                    </div>
                                    <div v-text='item.message' />
                                    <div
                                        class='text-end'
                                        style='font-size: 0.75rem; opacity: 0.75;'
                                        v-text='formatTime(item.created)'
                                    />
                                </div>
                                <div
                                    v-else
                                    class='ms-auto cloudtak-accent px-2 py-2 rounded'
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

<script setup lang="ts">
import { ref, onMounted, shallowRef, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import GenericSelect from '../util/GenericSelect.vue';
import { liveQuery, type Subscription } from 'dexie';
import type { DBChatroomChat } from '../../../base/database.ts';
import {
    IconListCheck,
    IconSend,
    IconArrowDown,
    IconUser,
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

const scrollContainer = ref<HTMLElement | null>(null);
const atBottom = ref(true);

function normalizeRouteParam(param: string | string[]): string {
    return Array.isArray(param) ? (param[0] ?? '') : param;
}

function normalizeRouteQuery(query: string | null | (string | null)[]): string {
    if (Array.isArray(query)) return query[0] ?? '';
    return query ?? '';
}

function onScroll(): void {
    const el = scrollContainer.value;
    if (!el) return;
    const wasAtBottom = atBottom.value;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    atBottom.value = isAtBottom;
    if (!wasAtBottom && isAtBottom) {
        room.value?.chats.markRead();
    }
}

function scrollToBottom(): void {
    const el = scrollContainer.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.value = true;
    room.value?.chats.markRead();
}

const route = useRoute();
const router = useRouter();

interface GenericSelectRef {
    selected: Set<string | number>;
}

const id = ref('');
const callsign = ref('');
const loading = ref(true);
const select = ref<GenericSelectRef | null>(null);
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
                    scrollToBottom();
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

const message = ref('');

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

async function sendMessage(): Promise<void> {
    if (!message.value.trim().length) return;
    if (!room.value) return;

    let recipient: { uid: string; callsign: string } | undefined;
    if (route.query.uid && route.query.callsign) {
        recipient = {
            uid: normalizeRouteQuery(route.query.uid),
            callsign: normalizeRouteQuery(route.query.callsign)
        };
    }

    await room.value.chats.send(
        message.value,
        { uid: id.value, callsign: callsign.value },
        mapStore.worker,
        recipient
    );

    message.value = '';

    if (route.params.chatroom === 'new') {
        await router.push({
            name: 'home-menu-chat',
            params: { chatroom: name.value }
        });
    }
}

async function deleteChats(): Promise<void> {
    if (!select.value) return;
    if (!room.value) return;
    const selected = select.value.selected;

    loading.value = true;

    try {
        await room.value.deleteChats(Array.from(selected.values()).map(String));
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

    await nextTick();
    scrollToBottom();
}

function formatTime(iso: string): string {
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
